// Bridge for keys.html: the page can only load and save the API key form.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("apiKeys", {
  load: () => ipcRenderer.invoke("api-keys:load"),
  save: (values) => ipcRenderer.invoke("api-keys:save", values),
  open: (url) => ipcRenderer.invoke("api-keys:open", url),
});
