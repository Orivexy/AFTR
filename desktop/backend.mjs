/**
 * NIVEX desktop backend: embedded PostgreSQL + the Next.js standalone server.
 * Plain Node (no Electron APIs) so it can be tested on any OS:
 *   node backend.mjs <resourcesDir> <dataDir>
 */
import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { createServer } from "node:net";
import { networkInterfaces } from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";

const DB_NAME = "nivex";
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
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("El servidor tardó demasiado en arrancar");
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

/**
 * @param {{ resourcesDir: string, dataDir: string, nodeBinary: string, nodeEnv?: Record<string,string>, log?: (m: string) => void }} opts
 */
export async function startBackend(opts) {
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

  // ── PostgreSQL ────────────────────────────────────────────────────────────
  const pgDir = path.join(dataDir, "pgdata");
  const firstRun = !existsSync(path.join(pgDir, "PG_VERSION"));
  const pgPort = await freePort(54330);
  const pgServer = new EmbeddedPostgres({
    databaseDir: pgDir,
    port: pgPort,
    user: DB_USER,
    password: state.dbPassword,
    persistent: true,
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    postgresFlags: ["-c", "listen_addresses=localhost"],
    onLog: (m) => appendFileSync(logFile, `[pg] ${m}\n`),
    onError: (m) => appendFileSync(logFile, `[pg:err] ${m instanceof Error ? m.stack : m}\n`),
  });
  if (firstRun) {
    log("Primera ejecución: creando base de datos…");
    await pgServer.initialise();
  }
  log(`Arrancando PostgreSQL en el puerto ${pgPort}`);
  await pgServer.start();

  const databaseUrl = `postgresql://${DB_USER}:${state.dbPassword}@localhost:${pgPort}/${DB_NAME}`;
  const meta = JSON.parse(readFileSync(path.join(resourcesDir, "demo-meta.json"), "utf8"));
  const admin = new pg.Client({ connectionString: `postgresql://${DB_USER}:${state.dbPassword}@localhost:${pgPort}/postgres` });
  await admin.connect();
  const exists = (await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [DB_NAME])).rowCount > 0;
  if (!exists) await admin.query(`CREATE DATABASE ${DB_NAME}`);
  await admin.end();

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  if (!exists) {
    log("Cargando datos de demostración…");
    await restoreDemo(client, path.join(resourcesDir, "demo.sql"));
    state.shiftedWeeks = 0;
  }
  const shifted = await refreshDemoDates(client, meta, state);
  if (shifted) log(`Fechas demo actualizadas (+${shifted} días)`);
  await client.end();

  // ── Media files ───────────────────────────────────────────────────────────
  const storageDir = path.join(dataDir, "storage");
  if (!existsSync(storageDir)) {
    log("Copiando imágenes y vídeos de demostración…");
    cpSync(path.join(resourcesDir, "storage"), storageDir, { recursive: true });
  }
  writeFileSync(stateFile, JSON.stringify(state, null, 2));

  // ── Next.js server ────────────────────────────────────────────────────────
  const port = await freePort(3000);
  const appDir = path.join(resourcesDir, "server");
  const bin = (name) => {
    const p = path.join(resourcesDir, "bin", process.platform === "win32" ? `${name}.exe` : name);
    return existsSync(p) ? p : "";
  };
  const env = {
    ...process.env,
    ...opts.nodeEnv,
    NODE_ENV: "production",
    PORT: String(port),
    HOSTNAME: "0.0.0.0",
    APP_URL: `http://localhost:${port}`,
    DATABASE_URL: databaseUrl,
    STORAGE_DRIVER: "local",
    STORAGE_LOCAL_DIR: storageDir,
    FFMPEG_PATH: bin("ffmpeg"),
    FFPROBE_PATH: bin("ffprobe"),
    CRON_SECRET: state.cronSecret,
    ENABLE_INPROCESS_JOBS: "true",
    EVENT_MODERATION: "off",
    RATE_LIMIT_SCALE: "20",
    NEXT_TELEMETRY_DISABLED: "1",
  };
  log(`Arrancando NIVEX en el puerto ${port}`);
  const server = spawn(nodeBinary, [path.join(appDir, "server.js")], { cwd: appDir, env, windowsHide: true });
  let alive = true;
  server.stdout.on("data", (d) => appendFileSync(logFile, `[app] ${d}`));
  server.stderr.on("data", (d) => appendFileSync(logFile, `[app:err] ${d}`));
  server.on("exit", (code) => {
    alive = false;
    log(`Servidor detenido (código ${code})`);
  });

  const url = `http://localhost:${port}`;
  await waitForHttp(`${url}/api/auth/me`, 90_000, () => alive);
  log(`Listo: ${url}`);

  return {
    url,
    port,
    lanUrls: lanAddresses().map((ip) => `http://${ip}:${port}`),
    logFile,
    async stop() {
      if (alive) {
        server.kill();
        await new Promise((r) => setTimeout(r, 800));
      }
      await pgServer.stop().catch(() => {});
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
