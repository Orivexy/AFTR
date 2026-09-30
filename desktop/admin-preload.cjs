// Bridge for admin.html: the page can only read the admin email and set its password.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("adminAccount", {
  load: () => ipcRenderer.invoke("admin:load"),
  save: (password) => ipcRenderer.invoke("admin:save", password),
});
