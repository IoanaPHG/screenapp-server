const { app, BrowserWindow, desktopCapturer, ipcMain, session, shell } = require("electron");
const { executeRemoteKeyboard, executeRemoteMouse } = require("./remote-control");

const APP_URL = process.env.SCREENAPP_URL || "https://screenapp-server.onrender.com";
const windows = new Set();

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    autoHideMenuBar: true,
    backgroundColor: "#f4efe6",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: require("path").join(__dirname, "preload.js")
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("did-finish-load", () => {
    logDesktopEvent("Desktop window ready");
  });

  mainWindow.on("closed", () => {
    windows.delete(mainWindow);
  });

  windows.add(mainWindow);
  mainWindow.loadURL(APP_URL);
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === "media" || permission === "display-capture") {
      callback(true);
      return;
    }

    callback(false);
  });

  session.defaultSession.setDisplayMediaRequestHandler(
    async (request, callback) => {
      try {
        const sources = await desktopCapturer.getSources({
          types: ["screen", "window"]
        });

        callback({
          video: sources[0],
          audio: "loopback"
        });
      } catch (error) {
        console.error("Nu s-a putut obtine sursa pentru screen share:", error);
        callback({});
      }
    },
    { useSystemPicker: true }
  );

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

ipcMain.handle("remote-control:mouse", async (event, payload) => {
  logDesktopEvent(`Mouse ${payload.eventType} -> ${payload.x},${payload.y}`);

  try {
    const result = await executeRemoteMouse(payload);
    logDesktopEvent(`Mouse executed (${result.action})`);
    return result;
  } catch (error) {
    logDesktopEvent(`Mouse failed: ${error.message}`);
    throw error;
  }
});

ipcMain.handle("remote-control:keyboard", async (event, payload) => {
  logDesktopEvent(`Keyboard ${payload.eventType} -> ${payload.key}`);

  try {
    const result = await executeRemoteKeyboard(payload);
    logDesktopEvent(`Keyboard executed (${result.action})`);
    return result;
  } catch (error) {
    logDesktopEvent(`Keyboard failed: ${error.message}`);
    throw error;
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

function logDesktopEvent(message) {
  console.log(`[desktop] ${message}`);

  windows.forEach((windowInstance) => {
    if (!windowInstance.isDestroyed()) {
      windowInstance.webContents.send("desktop-log", message);
    }
  });
}
