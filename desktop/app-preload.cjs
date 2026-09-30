// Bridge for the main window: window controls for the macOS-style title bar
// (custom traffic lights on Windows/Linux; native ones on macOS). Nothing else
// of Electron or Node is exposed to the page.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("orivexyDesktop", {
  platform: process.platform,
  minimize: () => ipcRenderer.invoke("window:minimize"),
  toggleMaximize: () => ipcRenderer.invoke("window:toggle-maximize"),
  toggleFullScreen: () => ipcRenderer.invoke("window:toggle-fullscreen"),
  close: () => ipcRenderer.invoke("window:close"),
  state: () => ipcRenderer.invoke("window:state"),
  onState: (cb) => {
    const listener = (_e, s) => cb(s);
    ipcRenderer.on("window:state", listener);
    return () => ipcRenderer.removeListener("window:state", listener);
  },
});
