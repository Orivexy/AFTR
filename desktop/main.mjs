/**
 * NIVEX for Windows — Electron shell. Starts the embedded backend
 * (backend.mjs), opens the app in a window and offers a QR code so phones on
 * the same Wi-Fi can use this computer as their server.
 */
import { app, BrowserWindow, Menu, Tray, dialog, nativeImage, shell } from "electron";
import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import QRCode from "qrcode";
import { startBackend } from "./backend.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const resourcesDir = app.isPackaged ? process.resourcesPath : path.join(here, "resources");
const dataDir = pickDataDir();

/**
 * PostgreSQL for Windows cannot handle non-ASCII paths (e.g. a user folder
 * like C:\Users\José), so in that case the data lives in ProgramData.
 */
function pickDataDir() {
  const preferred = path.join(app.getPath("userData"), "data");
  if (isAscii(preferred)) return preferred;
  const id = createHash("sha256").update(preferred).digest("hex").slice(0, 12);
  const bases = [process.env.ProgramData, path.join(path.parse(preferred).root, "NIVEX-data")].filter((b) => b && isAscii(b));
  // A folder created by an elevated run may be read-only for the user: skip it.
  const candidates = bases.flatMap((b) => [path.join(b, "NIVEX", id), path.join(b, "NIVEX", `${id}-u`)]);
  return candidates.find(writable) ?? candidates[0] ?? preferred;
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
/** Started by Windows at login: stay in the tray, ready for an instant open. */
const startHidden = process.argv.includes("--hidden");

if (!app.requestSingleInstanceLock()) app.quit();
// Opening NIVEX again (shortcut, taskbar) just shows the running window: instant.
app.on("second-instance", () => showMain());

function showMain() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

const loginItem = () => app.getLoginItemSettings({ args: ["--hidden"] }).openAtLogin;
function setOpenAtLogin(enabled) {
  app.setLoginItemSettings({ openAtLogin: enabled, args: ["--hidden"] });
  buildMenu();
}

/**
 * Closing the window keeps NIVEX (and its database) running in the tray, so
 * reopening it is instant. "Salir" in the tray or the menu really quits.
 */
function createTray() {
  tray = new Tray(nativeImage.createFromPath(path.join(here, "build", process.platform === "win32" ? "icon.ico" : "icon.png")).resize({ width: 16, height: 16 }));
  tray.setToolTip("NIVEX");
  tray.on("click", showMain);
  tray.on("double-click", showMain);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Abrir NIVEX", click: showMain },
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
  encodeURIComponent(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>NIVEX en tu móvil</title>
<style>body{margin:0;background:#07070b;color:#f4f4f7;font:15px/1.5 system-ui,sans-serif;padding:28px}h1{font-size:22px;margin:0 0 6px}
p{color:#a1a1b3;margin:6px 0}.qr{background:#fff;border-radius:16px;padding:12px;display:inline-block;margin:14px 0}
code{background:#17171f;padding:4px 8px;border-radius:8px;color:#d7ff3a;font-size:16px}ol{color:#a1a1b3;padding-left:18px}li{margin:4px 0}</style></head><body>${body}</body></html>`);

async function showMobile() {
  if (!backend) return;
  const urls = backend.lanUrls;
  const win = new BrowserWindow({ width: 460, height: 720, title: "NIVEX en tu móvil", backgroundColor: "#07070b", autoHideMenuBar: true, icon: path.join(here, "build", "icon.png") });
  if (!urls.length) {
    win.loadURL(html(`<h1>Sin red local</h1><p>Conecta este ordenador a una red Wi-Fi para abrir NIVEX desde el móvil.</p>`));
    return;
  }
  const qr = await QRCode.toDataURL(urls[0], { margin: 1, width: 280 });
  win.loadURL(
    html(`<h1>Abre NIVEX en tu móvil</h1>
<p>El móvil debe estar en la <b>misma red Wi-Fi</b> que este ordenador y NIVEX debe seguir abierto aquí.</p>
<div class="qr"><img src="${qr}" width="280" height="280" alt="QR"></div>
<p>O escribe en el navegador del móvil:</p><p><code>${urls[0]}</code></p>
${urls.length > 1 ? `<p>Otras direcciones: ${urls.slice(1).map((u) => `<code>${u}</code>`).join(" ")}</p>` : ""}
<h1 style="margin-top:20px;font-size:17px">Instalar como app</h1>
<ol><li><b>Android (Chrome):</b> menú ⋮ → “Añadir a pantalla de inicio”.</li>
<li><b>iPhone (Safari):</b> botón compartir → “Añadir a pantalla de inicio”.</li>
<li>Si no carga, permite NIVEX en el Firewall de Windows (redes privadas).</li></ol>`),
  );
}

async function resetDemo() {
  const { response } = await dialog.showMessageBox({
    type: "warning",
    buttons: ["Cancelar", "Reiniciar datos"],
    defaultId: 0,
    message: "¿Reiniciar los datos de demostración?",
    detail: "Se borrarán las cuentas, publicaciones y eventos creados en este ordenador.",
  });
  if (response !== 1) return;
  quitting = true;
  await backend?.stop();
  rmSync(dataDir, { recursive: true, force: true });
  app.relaunch();
  app.exit(0);
}

function buildMenu() {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: "NIVEX",
        submenu: [
          { label: "Abrir en el móvil…", accelerator: "CmdOrCtrl+M", click: showMobile },
          { label: "Abrir en el navegador", click: () => backend && shell.openExternal(backend.url) },
          { type: "separator" },
          { label: "Iniciar con Windows (abre al instante)", type: "checkbox", checked: loginItem(), click: (item) => setOpenAtLogin(item.checked) },
          { label: "Ver carpeta de datos", click: () => shell.openPath(dataDir) },
          { label: "Reiniciar datos de demostración…", click: resetDemo },
          { type: "separator" },
          { role: "quit", label: "Salir" },
        ],
      },
      { label: "Ver", submenu: [{ role: "reload", label: "Recargar" }, { role: "togglefullscreen", label: "Pantalla completa" }, { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" }, { type: "separator" }, { role: "toggleDevTools", label: "Herramientas de desarrollo" }] },
    ]),
  );
}

app.whenReady().then(async () => {
  const loading = startHidden ? null : splash();
  try {
    if (!isAscii(resourcesDir)) {
      throw new Error(`NIVEX está instalado en una carpeta con acentos o caracteres especiales:\n${resourcesDir}\n\nReinstálalo en una carpeta sin ellos, por ejemplo C:\\Program Files\\NIVEX.`);
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
    dialog.showErrorBox("NIVEX no pudo arrancar", `${message}\n\nRegistro: ${path.join(dataDir, "nivex.log")}`);
    app.exit(1);
    return;
  }

  buildMenu();
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 380,
    minHeight: 600,
    title: "NIVEX",
    backgroundColor: "#07070b",
    show: false,
    icon: path.join(here, "build", "icon.png"),
    webPreferences: { contextIsolation: true, sandbox: true },
  });
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
    if (!startHidden) mainWindow.show();
  });
  mainWindow.on("close", (e) => {
    if (quitting) return;
    e.preventDefault();
    mainWindow.hide();
    if (!trayHintShown && process.platform === "win32") {
      trayHintShown = true;
      tray?.displayBalloon({ title: "NIVEX sigue abierto", content: "Está en la bandeja del sistema para abrirse al instante. Clic derecho → Salir para cerrarlo del todo.", iconType: "info" });
    }
  });
  createTray();
  await mainWindow.loadURL(backend.url);
});

app.on("before-quit", async (e) => {
  if (quitting || !backend) return;
  e.preventDefault();
  quitting = true;
  await backend.stop();
  app.exit(0);
});

let trayHintShown = false;

// Windows are only hidden (tray); quitting happens from the tray/menu.
app.on("window-all-closed", () => {
  if (quitting) app.quit();
});
