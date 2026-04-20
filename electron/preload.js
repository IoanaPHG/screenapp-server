const { contextBridge, ipcRenderer } = require("electron");
const signalingUrl = process.env.SCREENAPP_SIGNALING_URL || "https://screenapp-server.onrender.com";

contextBridge.exposeInMainWorld("screenAppDesktop", {
  isElectronDesktop: true,
  signalingUrl,
  getDisplays: () => ipcRenderer.invoke("remote-control:displays"),
  executeRemoteMouse: (payload) => ipcRenderer.invoke("remote-control:mouse", payload),
  executeRemoteKeyboard: (payload) => ipcRenderer.invoke("remote-control:keyboard", payload),
  executeRemoteScroll: (payload) => ipcRenderer.invoke("remote-control:scroll", payload),
  onDesktopLog: (callback) => {
    ipcRenderer.removeAllListeners("desktop-log");
    ipcRenderer.on("desktop-log", (_event, message) => callback(message));
  }
});
