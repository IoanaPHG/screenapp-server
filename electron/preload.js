const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("screenAppDesktop", {
  isElectronDesktop: true,
  executeRemoteMouse: (payload) => ipcRenderer.invoke("remote-control:mouse", payload),
  executeRemoteKeyboard: (payload) => ipcRenderer.invoke("remote-control:keyboard", payload)
});
