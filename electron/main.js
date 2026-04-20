const { app, BrowserWindow, desktopCapturer, ipcMain, session, shell } = require("electron");
const path = require("path");
const {
  ensureNativeAgent,
  fetchAgentState,
  sendAgentCommand,
  stopNativeAgent
} = require("./agent-client");

const APP_ENTRY = path.join(__dirname, "..", "public", "index.html");
const windows = new Set();

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    autoHideMenuBar: true,
    fullscreenable: true,
    backgroundColor: "#f4efe6",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js")
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("did-finish-load", () => {
    logDesktopEvent("Desktop window ready");
  });

  mainWindow.on("enter-full-screen", () => {
    broadcastWindowState(mainWindow);
  });

  mainWindow.on("leave-full-screen", () => {
    broadcastWindowState(mainWindow);
  });

  mainWindow.on("maximize", () => {
    broadcastWindowState(mainWindow);
  });

  mainWindow.on("unmaximize", () => {
    broadcastWindowState(mainWindow);
  });

  mainWindow.on("closed", () => {
    windows.delete(mainWindow);
  });

  windows.add(mainWindow);
  mainWindow.loadFile(APP_ENTRY);
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

  ensureNativeAgent().catch((error) => {
    console.error("Nu s-a putut porni ScreenAppAgent:", error);
  });

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
    const result = await sendAgentCommand("/mouse", payload);
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
    const result = await sendAgentCommand("/keyboard", payload);
    logDesktopEvent(`Keyboard executed (${result.action})`);
    return result;
  } catch (error) {
    logDesktopEvent(`Keyboard failed: ${error.message}`);
    throw error;
  }
});

ipcMain.handle("remote-control:scroll", async (event, payload) => {
  logDesktopEvent(`Scroll -> ${payload.deltaY}`);

  try {
    const result = await sendAgentCommand("/scroll", payload);
    logDesktopEvent(`Scroll executed (${result.action})`);
    return result;
  } catch (error) {
    logDesktopEvent(`Scroll failed: ${error.message}`);
    throw error;
  }
});

ipcMain.handle("remote-control:displays", async () => {
  try {
    const result = await fetchAgentState("/displays");
    logDesktopEvent(`Displays loaded (${result.length})`);
    return result;
  } catch (error) {
    logDesktopEvent(`Displays failed: ${error.message}`);
    throw error;
  }
});

ipcMain.handle("window:toggle-fullscreen", (event) => {
  const targetWindow = BrowserWindow.fromWebContents(event.sender);

  if (!targetWindow) {
    return { ok: false, isFullscreen: false };
  }

  const nextState = !targetWindow.isFullScreen();
  targetWindow.setFullScreen(nextState);
  broadcastWindowState(targetWindow);

  return { ok: true, isFullscreen: targetWindow.isFullScreen() };
});

ipcMain.handle("window:get-state", (event) => {
  const targetWindow = BrowserWindow.fromWebContents(event.sender);

  if (!targetWindow) {
    return { isFullscreen: false, isMaximized: false };
  }

  return {
    isFullscreen: targetWindow.isFullScreen(),
    isMaximized: targetWindow.isMaximized()
  };
});

app.on("window-all-closed", () => {
  stopNativeAgent();
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

function broadcastWindowState(windowInstance) {
  if (windowInstance.isDestroyed()) {
    return;
  }

  windowInstance.webContents.send("window-state", {
    isFullscreen: windowInstance.isFullScreen(),
    isMaximized: windowInstance.isMaximized()
  });
}
