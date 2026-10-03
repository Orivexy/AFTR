/**
 * (Nombre en proceso) for Windows, Linux and macOS — Electron shell. Starts the embedded backend
 * (backend.mjs), opens the app in a window and offers a QR code so phones on
 * the same Wi-Fi can use this computer as their server.
 */
import { app, BrowserWindow, Menu, Tray, clipboard, dialog, ipcMain, nativeImage, net, shell } from "electron";
import { spawn } from "node:child_process";
import path from "node:path";
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import QRCode from "qrcode";
import electronUpdater from "electron-updater";
import { readApiKeys, startBackend, writeApiKeys } from "./backend.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const resourcesDir = app.isPackaged ? process.resourcesPath : path.join(here, "resources");
/** Folder name used before the app was renamed: its data is kept on upgrade. */
// Data stays where earlier versions kept it, whatever the product name.
app.setPath("userData", path.join(app.getPath("appData"), "ORIVEXY NIGHTS"));
const LEGACY_FOLDER = "NIVEX";
const DATA_FOLDER = "ORIVEXY-NIGHTS";
const dataDir = pickDataDir();

/**
 * PostgreSQL for Windows cannot handle non-ASCII paths (e.g. a user folder
 * like C:\Users\José), so in that case the data lives in ProgramData.
 */
function dataDirCandidates(userData, folder) {
  const preferred = path.join(userData, "data");
  if (isAscii(preferred)) return [preferred];
  const id = createHash("sha256").update(preferred).digest("hex").slice(0, 12);
  const bases = [process.env.ProgramData, path.join(path.parse(preferred).root, `${folder}-data`)].filter((b) => b && isAscii(b));
  return bases.flatMap((b) => [path.join(b, folder, id), path.join(b, folder, `${id}-u`)]);
}

function pickDataDir() {
  // Upgrading from the previous name: keep the existing database and files.
  const legacy = dataDirCandidates(path.join(app.getPath("appData"), LEGACY_FOLDER), LEGACY_FOLDER).find((d) => existsSync(path.join(d, "state.json")));
  if (legacy) return legacy;
  const candidates = dataDirCandidates(app.getPath("userData"), DATA_FOLDER);
  if (candidates.length === 1) return candidates[0];
  // A folder created by an elevated run may be read-only for the user: skip it.
  return candidates.find(writable) ?? candidates[0];
}

function writable(dir) {
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, ".write-test"), "ok");
    return true;
  } catch {
    return false;
  }
}

function isAscii(p) {
  return /^[\x20-\x7e]*$/.test(p);
}

let backend = null;
let mainWindow = null;
let tray = null;
let quitting = false;
/** Started at login: stay in the tray, ready for an instant open. */
const startHidden = process.argv.includes("--hidden") || (process.platform === "darwin" && app.getLoginItemSettings().wasOpenedAsHidden);

if (!app.requestSingleInstanceLock()) app.quit();
// Opening (Nombre en proceso) again (shortcut, taskbar) just shows the running window: instant.
app.on("second-instance", () => showMain());
// macOS: clicking the Dock icon reopens the hidden window.
app.on("activate", () => showMain());

function showMain() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

const loginItem = () => app.getLoginItemSettings({ args: ["--hidden"] }).openAtLogin;
function setOpenAtLogin(enabled) {
  app.setLoginItemSettings({ openAtLogin: enabled, openAsHidden: true, args: ["--hidden"] });
  buildMenu();
}

/**
 * Closing the window keeps (Nombre en proceso) (and its database) running in the tray, so
 * reopening it is instant. "Salir" in the tray or the menu really quits.
 */
function createTray() {
  tray = new Tray(nativeImage.createFromPath(path.join(here, "build", process.platform === "win32" ? "icon.ico" : "icon.png")).resize({ width: 16, height: 16 }));
  tray.setToolTip("(Nombre en proceso)");
  tray.on("click", showMain);
  tray.on("double-click", showMain);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Abrir (Nombre en proceso)", click: showMain },
      { label: "Abrir en el móvil…", click: showMobile },
      { type: "separator" },
      { label: "Salir", click: () => app.quit() },
    ]),
  );
}

function splash() {
  const win = new BrowserWindow({ width: 420, height: 300, frame: false, resizable: false, backgroundColor: "#07070b", show: true });
  win.loadFile(path.join(here, "splash.html"));
  return win;
}

const html = (body) =>
  "data:text/html;charset=utf-8," +
  encodeURIComponent(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>(Nombre en proceso) en tu móvil</title>
<style>body{margin:0;background:#07070b;color:#f4f4f7;font:15px/1.5 system-ui,sans-serif;padding:28px}h1{font-size:22px;margin:0 0 6px}
p{color:#a1a1b3;margin:6px 0}.qr{background:#fff;border-radius:16px;padding:12px;display:inline-block;margin:14px 0}
code{background:#17171f;padding:4px 8px;border-radius:8px;color:#d7ff3a;font-size:16px}ol{color:#a1a1b3;padding-left:18px}li{margin:4px 0}</style></head><body>${body}</body></html>`);

async function showMobile() {
  if (!backend) return;
  const urls = backend.lanUrls;
  const win = new BrowserWindow({ width: 460, height: 720, title: "(Nombre en proceso) en tu móvil", backgroundColor: "#07070b", autoHideMenuBar: true, icon: path.join(here, "build", "icon.png") });
  if (!urls.length) {
    win.loadURL(html(`<h1>Sin red local</h1><p>Conecta este ordenador a una red Wi-Fi para abrir (Nombre en proceso) desde el móvil.</p>`));
    return;
  }
  const qr = await QRCode.toDataURL(urls[0], { margin: 1, width: 280 });
  win.loadURL(
    html(`<h1>Abre (Nombre en proceso) en tu móvil</h1>
<p>El móvil debe estar en la <b>misma red Wi-Fi</b> que este ordenador y (Nombre en proceso) debe seguir abierto aquí.</p>
<div class="qr"><img src="${qr}" width="280" height="280" alt="QR"></div>
<p>O escribe en el navegador del móvil:</p><p><code>${urls[0]}</code></p>
${urls.length > 1 ? `<p>Otras direcciones: ${urls.slice(1).map((u) => `<code>${u}</code>`).join(" ")}</p>` : ""}
<h1 style="margin-top:20px;font-size:17px">Instalar como app</h1>
<ol><li><b>Android (Chrome):</b> menú ⋮ → “Añadir a pantalla de inicio”.</li>
<li><b>iPhone (Safari):</b> botón compartir → “Añadir a pantalla de inicio”.</li>
<li>Si no carga, permite (Nombre en proceso) en el firewall del ordenador (redes privadas).</li></ol>`),
  );
}

let keysWindow = null;

/** Menu → "Claves de API…": optional keys (Ticketmaster, Google, map style, email), stored locally. */
function showApiKeys() {
  if (keysWindow) return keysWindow.focus();
  keysWindow = new BrowserWindow({
    width: 560,
    height: 760,
    title: "Claves de API · (Nombre en proceso)",
    backgroundColor: "#07070b",
    autoHideMenuBar: true,
    icon: path.join(here, "build", "icon.png"),
    webPreferences: { preload: path.join(here, "keys-preload.cjs"), contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  keysWindow.on("closed", () => (keysWindow = null));
  keysWindow.loadFile(path.join(here, "keys.html"));
}

ipcMain.handle("api-keys:load", () => readApiKeys(dataDir));
ipcMain.handle("api-keys:open", (_e, url) => {
  if (typeof url === "string" && url.startsWith("https://")) shell.openExternal(url);
});
ipcMain.handle("api-keys:save", async (_e, values) => {
  writeApiKeys(dataDir, values);
  // The server reads the keys at start: restart the whole app (1–2 s).
  quitting = true;
  await backend?.stop();
  app.relaunch({ args: process.argv.slice(1).filter((a) => a !== "--hidden") });
  app.exit(0);
});

async function resetData() {
  const { response } = await dialog.showMessageBox({
    type: "warning",
    buttons: ["Cancelar", "Borrar todo"],
    defaultId: 0,
    message: "¿Borrar todos los datos de (Nombre en proceso) en este ordenador?",
    detail: "Se eliminarán las cuentas, publicaciones, fotos, eventos y locales guardados aquí. No se puede deshacer.",
  });
  if (response !== 1) return;
  quitting = true;
  await backend?.stop();
  rmSync(dataDir, { recursive: true, force: true });
  app.relaunch();
  app.exit(0);
}

const prefsFile = () => path.join(dataDir, "window.json");
function readPrefs() {
  try {
    return JSON.parse(readFileSync(prefsFile(), "utf8"));
  } catch {
    return {};
  }
}
function writePrefs(p) {
  try {
    writeFileSync(prefsFile(), JSON.stringify(p));
  } catch {
    /* not critical */
  }
}

// Window controls for the app's own title bar.
ipcMain.handle("window:minimize", () => mainWindow?.minimize());
ipcMain.handle("window:toggle-maximize", () => (mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize()));
ipcMain.handle("window:toggle-fullscreen", () => mainWindow?.setFullScreen(!mainWindow.isFullScreen()));
ipcMain.handle("window:close", () => mainWindow?.close());
ipcMain.handle("window:state", () => ({ fullscreen: Boolean(mainWindow?.isFullScreen()), maximized: Boolean(mainWindow?.isMaximized()), platform: process.platform }));

let adminWindow = null;
function showAdminPassword() {
  if (adminWindow) return adminWindow.focus();
  adminWindow = new BrowserWindow({
    width: 460,
    height: 440,
    title: "Contraseña de administrador · (Nombre en proceso)",
    backgroundColor: "#07070b",
    autoHideMenuBar: true,
    resizable: false,
    parent: mainWindow ?? undefined,
    icon: path.join(here, "build", "icon.png"),
    webPreferences: { preload: path.join(here, "admin-preload.cjs"), contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  adminWindow.on("closed", () => (adminWindow = null));
  adminWindow.loadFile(path.join(here, "admin.html"));
}
ipcMain.handle("admin:load", () => ({ email: backend?.admin?.email ?? "" }));
ipcMain.handle("admin:save", async (_e, password) => {
  if (!backend || typeof password !== "string" || password.length < 4 || password.length > 128) return { ok: false, error: "Mínimo 4 caracteres" };
  try {
    return await backend.setAdminPassword(password);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No se pudo guardar" };
  }
});

/** Administrator of this installation (generated on first launch, kept only on this computer). */
async function showAdminCredentials() {
  if (!backend?.admin) return;
  const { email, password } = backend.admin;
  const { response } = await dialog.showMessageBox(mainWindow ?? undefined, {
    type: "info",
    title: "Cuenta de administrador",
    message: "Tu cuenta de administrador de (Nombre en proceso)",
    detail: `Email: ${email}\nContraseña: ${password}\n\nEntra con ella en «Entrar». Puedes elegir otra en el menú (Nombre en proceso) → Cambiar contraseña de administrador.`,
    buttons: ["Elegir mi contraseña", "Copiar contraseña", "Aceptar"],
    defaultId: 2,
  });
  if (response === 0) showAdminPassword();
  if (response === 1) clipboard.writeText(password);
  backend.markAdminShown();
}

function buildMenu() {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: "(Nombre en proceso)",
        submenu: [
          { label: "Abrir en el móvil…", accelerator: "CmdOrCtrl+M", click: showMobile },
          { label: "Abrir en el navegador", click: () => backend && shell.openExternal(backend.url) },
          { type: "separator" },
          // Login items exist on Windows and macOS (not on Linux).
          ...(process.platform === "linux"
            ? []
            : [{ label: `Iniciar con ${process.platform === "darwin" ? "el Mac" : "Windows"} (abre al instante)`, type: "checkbox", checked: loginItem(), click: (item) => setOpenAtLogin(item.checked) }]),
          { label: "Buscar actualizaciones", click: checkForUpdatesNow },
          { label: "Credenciales de administrador…", click: showAdminCredentials },
          { label: "Cambiar contraseña de administrador…", click: showAdminPassword },
          { label: "Claves de API…", click: showApiKeys },
          { label: "Ver carpeta de datos", click: () => shell.openPath(dataDir) },
          { label: "Borrar datos locales…", click: resetData },
          { type: "separator" },
          { role: "quit", label: "Salir" },
        ],
      },
      { label: "Ver", submenu: [{ role: "reload", label: "Recargar" }, { role: "togglefullscreen", label: "Pantalla completa", accelerator: process.platform === "darwin" ? "Ctrl+Cmd+F" : "F11" }, { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" }, { type: "separator" }, { role: "toggleDevTools", label: "Herramientas de desarrollo" }] },
    ]),
  );
}

/** Downloads the latest installer and runs it (Windows); elsewhere opens the download page. */
async function reinstall() {
  const page = "https://github.com/Orivexy/ORIVEXY-Nights/releases/latest";
  if (process.platform !== "win32") return void (await shell.openExternal(page));
  const res = await net.fetch(`${page}/download/Nombre-en-proceso-Windows.exe`);
  if (!res.ok) throw new Error(`Descarga fallida (${res.status})`);
  const file = path.join(app.getPath("temp"), "Nombre-en-proceso-Windows.exe");
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  spawn(file, [], { detached: true, stdio: "ignore" }).unref();
}

app.whenReady().then(async () => {
  const loading = startHidden ? null : splash();
  try {
    if (process.platform === "win32" && !isAscii(resourcesDir)) {
      throw new Error(`(Nombre en proceso) está instalado en una carpeta con acentos o caracteres especiales:\n${resourcesDir}\n\nReinstálalo en una carpeta sin ellos, por ejemplo C:\\Program Files\\Nombre en proceso.`);
    }
    backend = await startBackend({
      resourcesDir,
      dataDir,
      // Electron doubles as Node.js for the server process.
      nodeBinary: process.execPath,
      nodeEnv: { ELECTRON_RUN_AS_NODE: "1" },
    });
  } catch (err) {
    loading?.destroy();
    const message = err instanceof Error ? err.message : String(err ?? "Error desconocido");
    // Files missing from the app itself: an update that did not finish. Reinstalling fixes it (data is kept).
    if (/Cannot find module|MODULE_NOT_FOUND/.test(message)) {
      const { response } = await dialog.showMessageBox({
        type: "error",
        title: "(Nombre en proceso) no pudo arrancar",
        message: "La instalación está incompleta (una actualización no terminó)",
        detail: "Reinstalar descarga la última versión y la instala. Tus datos se conservan.",
        buttons: ["Reinstalar", "Cerrar"],
        defaultId: 0,
      });
      if (response === 0) await reinstall().catch((e) => dialog.showErrorBox("No se pudo reinstalar", `${e?.message ?? e}\n\nDescárgala de https://github.com/Orivexy/ORIVEXY-Nights/releases/latest`));
      app.exit(1);
      return;
    }
    dialog.showErrorBox("(Nombre en proceso) no pudo arrancar", `${message}\n\nRegistro: ${path.join(dataDir, "orivexy-nights.log")}`);
    app.exit(1);
    return;
  }

  buildMenu();
  const prefs = readPrefs();
  const isMac = process.platform === "darwin";
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 380,
    minHeight: 600,
    title: "(Nombre en proceso)",
    backgroundColor: "#07070b",
    show: false,
    icon: path.join(here, "build", "icon.png"),
    // The app draws its own title bar, with Windows-style window buttons on the right (all systems).
    frame: false,
    webPreferences: { contextIsolation: true, sandbox: true, preload: path.join(here, "app-preload.cjs") },
  });
  // The web app renders its macOS-style interface for this window.
  mainWindow.webContents.setUserAgent(`${mainWindow.webContents.getUserAgent()} OrivexyDesktop/${isMac ? "mac" : process.platform === "win32" ? "win" : "linux"}`);
  const sendState = () =>
    mainWindow.webContents.send("window:state", { fullscreen: mainWindow.isFullScreen(), maximized: mainWindow.isMaximized(), platform: process.platform });
  for (const ev of ["enter-full-screen", "leave-full-screen", "maximize", "unmaximize"]) mainWindow.on(ev, sendState);
  mainWindow.on("enter-full-screen", () => writePrefs({ ...readPrefs(), fullscreen: true }));
  mainWindow.on("leave-full-screen", () => hidingFromFullScreen || writePrefs({ ...readPrefs(), fullscreen: false }));
  // Links to other sites open in the default browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(backend.url)) shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith(backend.url)) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });
  mainWindow.once("ready-to-show", () => {
    loading?.destroy();
    if (startHidden) return;
    mainWindow.show();
    // Full screen by default (F11 / Ctrl+Cmd+F or the window button to leave; the choice is remembered).
    if (prefs.fullscreen !== false) mainWindow.setFullScreen(true);
    if (backend.admin?.firstTime) setTimeout(() => void showAdminCredentials(), 1500);
  });
  mainWindow.on("close", (e) => {
    if (quitting) return;
    e.preventDefault();
    // A full-screen Mac window must leave full screen before hiding (it would leave a black Space).
    if (process.platform === "darwin" && mainWindow.isFullScreen()) {
      hidingFromFullScreen = true;
      mainWindow.once("leave-full-screen", () => {
        hidingFromFullScreen = false;
        mainWindow.hide();
      });
      mainWindow.setFullScreen(false);
      return;
    }
    mainWindow.hide();
    if (!trayHintShown && process.platform === "win32") {
      trayHintShown = true;
      tray?.displayBalloon({ title: "(Nombre en proceso) sigue abierto", content: "Está en la bandeja del sistema para abrirse al instante. Clic derecho → Salir para cerrarlo del todo.", iconType: "info" });
    }
  });
  createTray();
  setupAutoUpdates();
  await mainWindow.loadURL(backend.url);
});

app.on("before-quit", async (e) => {
  if (quitting || !backend) return;
  e.preventDefault();
  quitting = true;
  await backend.stop();
  // A downloaded update installs on the way out (silently) and the app reopens.
  if (updateReady) return electronUpdater.autoUpdater.quitAndInstall(true, true);
  app.exit(0);
});

// ─── Automatic updates ─────────────────────────────────────────────────────
// Every build published on GitHub reaches installed apps: they check at start
// and every 30 minutes, download in the background and install on restart.
// (Windows and Linux AppImage; unsigned Mac builds cannot self-update.)
let updateReady = false;
let manualCheck = false;
/** Shown in the window (bottom left): idle | checking | downloading | ready | latest | error | unsupported. */
let updateState = { status: !app.isPackaged || process.platform === "darwin" || (process.platform === "linux" && !process.env.APPIMAGE) ? "unsupported" : "idle", version: null, percent: 0 };
function setUpdateState(patch) {
  updateState = { ...updateState, ...patch };
  mainWindow?.webContents.send("update:state", updateState);
}
ipcMain.handle("update:state", () => updateState);
ipcMain.handle("update:check", () => {
  if (updateState.status === "unsupported") return void shell.openExternal("https://github.com/Orivexy/ORIVEXY-Nights/releases/latest");
  if (["checking", "downloading", "ready"].includes(updateState.status)) return;
  setUpdateState({ status: "checking" });
  electronUpdater.autoUpdater.checkForUpdates().catch((err) => setUpdateState({ status: "error", version: null, error: String(err?.message ?? err) }));
});
ipcMain.handle("update:install", () => {
  if (updateReady) app.quit();
});
function checkForUpdatesNow() {
  if (!app.isPackaged || process.platform === "darwin") {
    void shell.openExternal("https://github.com/Orivexy/ORIVEXY-Nights/releases/latest");
    return;
  }
  manualCheck = true;
  electronUpdater.autoUpdater.checkForUpdates().catch((err) => {
    manualCheck = false;
    void dialog.showMessageBox(mainWindow ?? undefined, { type: "warning", message: "No se pudo buscar actualizaciones", detail: String(err?.message ?? err), buttons: ["Aceptar"] });
  });
}
function setupAutoUpdates() {
  if (!app.isPackaged || process.platform === "darwin") return;
  if (process.platform === "linux" && !process.env.APPIMAGE) return;
  const { autoUpdater } = electronUpdater;
  const log = (m) => {
    try {
      appendFileSync(path.join(dataDir, "orivexy-nights.log"), `[${new Date().toISOString()}] Actualizaciones: ${m}\n`);
    } catch {
      /* not critical */
    }
  };
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false; // installed from before-quit, after PostgreSQL has stopped
  autoUpdater.on("checking-for-update", () => updateState.status !== "ready" && setUpdateState({ status: "checking" }));
  autoUpdater.on("update-available", (i) => {
    log(`versión ${i.version} disponible, descargando`);
    setUpdateState({ status: "downloading", version: i.version, percent: 0 });
  });
  autoUpdater.on("download-progress", (p) => setUpdateState({ status: "downloading", percent: Math.round(p.percent ?? 0) }));
  autoUpdater.on("update-not-available", () => {
    log("al día");
    setUpdateState({ status: "latest" });
    if (manualCheck) void dialog.showMessageBox(mainWindow ?? undefined, { type: "info", message: "(Nombre en proceso) está al día", detail: `Versión ${app.getVersion()}`, buttons: ["Aceptar"] });
    manualCheck = false;
  });
  autoUpdater.on("update-available", () => (manualCheck = false));
  autoUpdater.on("error", (err) => {
    log(`error: ${err?.message ?? err}`);
    if (updateState.status !== "ready") setUpdateState({ status: "error" });
  });
  autoUpdater.on("update-downloaded", (info) => {
    updateReady = true;
    log(`versión ${info.version} descargada`);
    tray?.setToolTip(`(Nombre en proceso) · nueva versión ${info.version} lista`);
    // The window shows an "Actualizar" button (bottom left); otherwise it installs on quit.
    setUpdateState({ status: "ready", version: info.version, percent: 100 });
  });
  const check = () => autoUpdater.checkForUpdates().catch((err) => log(`sin conexión: ${err?.message ?? err}`));
  setTimeout(check, 15_000);
  setInterval(check, 30 * 60_000).unref();
}

let trayHintShown = false;
let hidingFromFullScreen = false;

// Windows are only hidden (tray); quitting happens from the tray/menu.
app.on("window-all-closed", () => {
  if (quitting) app.quit();
});
