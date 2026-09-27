/**
 * NIVEX desktop backend: embedded PostgreSQL + the Next.js standalone server.
 * Plain Node (no Electron APIs) so it can be tested on any OS:
 *   node backend.mjs <resourcesDir> <dataDir>
 */
import { execFile, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, appendFileSync } from "node:fs";
import { cp } from "node:fs/promises";
import { createServer } from "node:net";
import { networkInterfaces } from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";

const DB_NAME = "nivex";
const PG_PACKAGE = `@embedded-postgres/${process.platform === "win32" ? "windows" : process.platform}-${process.arch}`;
const DB_USER = "nivex";

function freePort(start) {
  return new Promise((resolve) => {
    const tryPort = (port) => {
      const srv = createServer();
      srv.once("error", () => tryPort(port + 1));
      srv.once("listening", () => srv.close(() => resolve(port)));
      srv.listen(port, "0.0.0.0");
    };
    tryPort(start);
  });
}

/** Local network addresses so phones on the same Wi-Fi can open the app. */
export function lanAddresses() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === "IPv4" && !i.internal && !i.address.startsWith("169.254."))
    .map((i) => i.address);
}

async function waitForHttp(url, timeoutMs, isAlive) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    if (!isAlive()) throw new Error("El servidor se ha detenido al arrancar (ver nivex.log)");
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (res.status < 500) return;
    } catch {
      /* not ready yet */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("El servidor tardó demasiado en arrancar");
}

function run(file, args, logFile) {
  return new Promise((resolve, reject) => {
    execFile(file, args, { windowsHide: true, timeout: 120_000 }, (err, stdout, stderr) => {
      const out = `${stdout}${stderr}`.trim();
      if (out) appendFileSync(logFile, `[pg_ctl] ${out}\n`);
      if (err) reject(new Error(out || err.message));
      else resolve(out);
    });
  });
}

function tail(file, lines = 15) {
  try {
    return readFileSync(file, "utf8").trim().split(/\r?\n/).slice(-lines).join("\n");
  } catch {
    return "";
  }
}

/** Loads the demo database dump (plain SQL) generated at build time. */
async function restoreDemo(client, dumpFile) {
  const sql = readFileSync(dumpFile, "utf8")
    .split("\n")
    .filter((l) => !l.startsWith("\\")) // psql meta-commands (\restrict, \connect…)
    .join("\n");
  await client.query(sql);
}

/**
 * Keeps the demo agenda current: shifts demo dates forward in whole weeks
 * (so weekdays still match each club's schedule) since the dump was made.
 */
async function refreshDemoDates(client, meta, state) {
  const weeks = Math.floor((Date.now() - new Date(meta.dumpedAt).getTime()) / (7 * 86400_000));
  const delta = weeks - (state.shiftedWeeks ?? 0);
  if (delta <= 0) return 0;
  const days = delta * 7;
  const cutoff = new Date(new Date(meta.dumpedAt).getTime() + (state.shiftedWeeks ?? 0) * 7 * 86400_000).toISOString();
  const shift = (col) => `"${col}" = "${col}" + interval '${days} days'`;
  await client.query("BEGIN");
  await client.query(`UPDATE "Event" SET ${shift("startsAt")}, ${shift("endsAt")}, ${shift("doorsAt")}, ${shift("createdAt")}, "reminderSentAt" = NULL WHERE "isDemo"`);
  for (const [table, cols] of [
    ["Post", ["createdAt", "updatedAt"]],
    ["Comment", ["createdAt"]],
    ["Photo", ["createdAt"]],
    ["Video", ["createdAt"]],
    ["Notification", ["createdAt"]],
    ["Review", ["createdAt", "updatedAt"]],
    ["Follow", ["createdAt"]],
    ["Like", ["createdAt"]],
  ]) {
    await client.query(`UPDATE "${table}" SET ${cols.map(shift).join(", ")} WHERE "createdAt" <= $1`, [cutoff]);
  }
  await client.query("COMMIT");
  state.shiftedWeeks = weeks;
  return days;
}

async function preparePostgres({ resourcesDir, dataDir, pgDir, pgPort, pg_ctl, databaseUrl, state, saveState, logFile, log, since }) {
  if (existsSync(pgDir) && !state.pgInitialized) {
    // Left over by an interrupted first run (unknown password): start over.
    log("Base de datos incompleta de un arranque anterior: recreándola");
    rmSync(pgDir, { recursive: true, force: true });
  }
  if (!existsSync(path.join(pgDir, "PG_VERSION"))) {
    log("Primera ejecución: creando base de datos…");
    const pgServer = new EmbeddedPostgres({
      databaseDir: pgDir,
      port: pgPort,
      user: DB_USER,
      password: state.dbPassword,
      persistent: true,
      // --no-sync: skip flushing the new cluster to disk (very slow on Windows).
      initdbFlags: ["--encoding=UTF8", "--locale=C", "--no-sync"],
      onLog: (m) => appendFileSync(logFile, `[pg] ${m}\n`),
      onError: (m) => appendFileSync(logFile, `[pg:err] ${m instanceof Error ? m.stack : m}\n`),
    });
    await pgServer.initialise();
    state.pgInitialized = true;
    saveState();
  }
  // pg_ctl (not postgres.exe directly): on Windows it drops administrator
  // rights, which PostgreSQL refuses to run with, and waits until it is ready.
  const pgLog = path.join(dataDir, "postgres.log");
  if (existsSync(path.join(pgDir, "postmaster.pid"))) {
    log("PostgreSQL no se cerró bien la última vez: deteniéndolo");
    await run(pg_ctl, ["stop", "-D", pgDir, "-m", "fast", "-w"], logFile).catch(() => {});
  }
  log(`Arrancando PostgreSQL en el puerto ${pgPort}`);
  try {
    // synchronous_commit=off: commits don't wait for the disk (a crash can lose the last
    // second of changes, never corrupt data) — much snappier on a laptop.
    await run(pg_ctl, ["start", "-D", pgDir, "-w", "-t", "90", "-l", pgLog, "-o", `-p ${pgPort} -c listen_addresses=localhost -c synchronous_commit=off`], logFile);
  } catch (err) {
    throw new Error(`PostgreSQL no pudo arrancar: ${err.message}\n${tail(pgLog)}`);
  }
  log(`PostgreSQL listo (${Date.now() - since} ms)`);

  const meta = JSON.parse(readFileSync(path.join(resourcesDir, "demo-meta.json"), "utf8"));
  const admin = new pg.Client({ connectionString: databaseUrl.replace(/\/[^/]+$/, "/postgres") });
  await admin.connect();
  const exists = (await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [DB_NAME])).rowCount > 0;
  const loadDemo = !exists || !state.demoLoaded;
  if (exists && loadDemo) await admin.query(`DROP DATABASE ${DB_NAME}`); // half-restored earlier
  if (loadDemo) await admin.query(`CREATE DATABASE ${DB_NAME}`);
  await admin.end();

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  if (loadDemo) {
    log("Cargando datos de demostración…");
    await restoreDemo(client, path.join(resourcesDir, "demo.sql"));
    state.shiftedWeeks = 0;
    state.demoLoaded = true;
    saveState();
  }
  const shifted = await refreshDemoDates(client, meta, state);
  if (shifted) log(`Fechas demo actualizadas (+${shifted} días)`);
  await client.end();
}

async function copyDemoMedia({ resourcesDir, storageDir, state, log }) {
  if (state.storageCopied) return;
  log("Copiando imágenes y vídeos de demostración…");
  await cp(path.join(resourcesDir, "storage"), storageDir, { recursive: true, force: true });
  state.storageCopied = true;
}

function startServer({ resourcesDir, dataDir, nodeBinary, nodeEnv, port, databaseUrl, storageDir, cronSecret, logFile, log }) {
  const appDir = path.join(resourcesDir, "server");
  const bin = (name) => {
    const p = path.join(resourcesDir, "bin", process.platform === "win32" ? `${name}.exe` : name);
    return existsSync(p) ? p : "";
  };
  const env = {
    ...process.env,
    ...nodeEnv,
    NODE_ENV: "production",
    // Node caches compiled JavaScript here: every launch after the first boots faster.
    NODE_COMPILE_CACHE: path.join(dataDir, "cache", "node-compile"),
    PORT: String(port),
    HOSTNAME: "0.0.0.0",
    APP_URL: `http://localhost:${port}`,
    DATABASE_URL: databaseUrl,
    STORAGE_DRIVER: "local",
    STORAGE_LOCAL_DIR: storageDir,
    FFMPEG_PATH: bin("ffmpeg"),
    FFPROBE_PATH: bin("ffprobe"),
    CRON_SECRET: cronSecret,
    ENABLE_INPROCESS_JOBS: "true",
    EVENT_MODERATION: "off",
    RATE_LIMIT_SCALE: "20",
    NEXT_TELEMETRY_DISABLED: "1",
  };
  log(`Arrancando NIVEX en el puerto ${port}`);
  const child = spawn(nodeBinary, [path.join(appDir, "server.js")], { cwd: appDir, env, windowsHide: true });
  let alive = true;
  child.stdout.on("data", (d) => appendFileSync(logFile, `[app] ${d}`));
  child.stderr.on("data", (d) => appendFileSync(logFile, `[app:err] ${d}`));
  child.on("exit", (code) => {
    alive = false;
    log(`Servidor detenido (código ${code})`);
  });
  // /api/health answers without touching the database.
  const ready = waitForHttp(`http://localhost:${port}/api/health`, 90_000, () => alive);
  return { ready, alive: () => alive, kill: () => child.kill() };
}

/**
 * @param {{ resourcesDir: string, dataDir: string, nodeBinary: string, nodeEnv?: Record<string,string>, log?: (m: string) => void }} opts
 */
export async function startBackend(opts) {
  const t0 = Date.now();
  const { resourcesDir, dataDir, nodeBinary } = opts;
  mkdirSync(dataDir, { recursive: true });
  const logFile = path.join(dataDir, "nivex.log");
  const log = (m) => {
    const line = `[${new Date().toISOString()}] ${m}\n`;
    appendFileSync(logFile, line);
    opts.log?.(m);
  };

  const stateFile = path.join(dataDir, "state.json");
  const state = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, "utf8")) : {};
  state.dbPassword ??= randomBytes(18).toString("hex");
  state.cronSecret ??= randomBytes(24).toString("hex");
  const saveState = () => writeFileSync(stateFile, JSON.stringify(state, null, 2));
  saveState(); // before initdb: the cluster's password must never get lost

  // PostgreSQL and the Next.js server start in parallel: the server only
  // needs the database once the first page is requested.
  const [pgPort, port] = await Promise.all([freePort(54330), freePort(3000)]);
  const databaseUrl = `postgresql://${DB_USER}:${state.dbPassword}@localhost:${pgPort}/${DB_NAME}`;
  const storageDir = path.join(dataDir, "storage");
  const { pg_ctl } = await import(PG_PACKAGE);
  const pgDir = path.join(dataDir, "pgdata");
  const stopPostgres = () => run(pg_ctl, ["stop", "-D", pgDir, "-m", "fast", "-w"], logFile).catch(() => {});

  const server = startServer({ resourcesDir, dataDir, nodeBinary, nodeEnv: opts.nodeEnv, port, databaseUrl, storageDir, cronSecret: state.cronSecret, logFile, log });
  try {
    await Promise.all([
      preparePostgres({ resourcesDir, dataDir, pgDir, pgPort, pg_ctl, databaseUrl, state, saveState, logFile, log, since: t0 }),
      copyDemoMedia({ resourcesDir, storageDir, state, log }),
      server.ready,
    ]);
  } catch (err) {
    server.kill();
    await stopPostgres();
    throw err;
  }
  saveState();
  const url = `http://localhost:${port}`;
  log(`Listo en ${Date.now() - t0} ms: ${url}`);
  // Warm up the main sections in the background so the first clicks are instant.
  for (const p of ["/", "/map", "/discover"]) fetch(`${url}${p}`).catch(() => {});

  return {
    url,
    port,
    lanUrls: lanAddresses().map((ip) => `http://${ip}:${port}`),
    logFile,
    async stop() {
      if (server.alive()) {
        server.kill();
        await new Promise((r) => setTimeout(r, 800));
      }
      await stopPostgres();
    },
  };
}

// CLI for testing: node backend.mjs <resourcesDir> <dataDir>
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const [resourcesDir, dataDir] = process.argv.slice(2);
  const backend = await startBackend({ resourcesDir, dataDir, nodeBinary: process.execPath, log: console.log });
  console.log("URLs:", backend.url, backend.lanUrls.join(" "));
  const shutdown = async () => {
    await backend.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
