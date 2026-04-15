const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("screenAppDesktop", {
  isElectronDesktop: true,
  executeRemoteMouse: (payload) => ipcRenderer.invoke("remote-control:mouse", payload),
  executeRemoteKeyboard: (payload) => ipcRenderer.invoke("remote-control:keyboard", payload),
  executeRemoteScroll: (payload) => ipcRenderer.invoke("remote-control:scroll", payload),
  onDesktopLog: (callback) => {
    ipcRenderer.removeAllListeners("desktop-log");
    ipcRenderer.on("desktop-log", (_event, message) => callback(message));
  }
});
