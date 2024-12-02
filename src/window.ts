import { app, BrowserWindow } from "electron";
import * as path from "path";

let mainWindow: BrowserWindow;

export function createWindow() {
  mainWindow = new BrowserWindow({
    width: 700,
    height: 1200,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "../src/index.html"));

  if (process.env.NODE_ENV === "development") {
    mainWindow.webContents.openDevTools();
  }
}

export function getMainWindow(): BrowserWindow {
  return mainWindow;
} 