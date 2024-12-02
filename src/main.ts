import { app, BrowserWindow } from "electron";
import { createWindow } from "./window";
import { setupConfigHandlers } from "./handlers/config-handlers";
import { setupInputFileHandler } from "./handlers/input-file-handler";
import { setupDownloadReferralHandler } from "./handlers/download-referrals-handler";

app.whenReady().then(() => {
  createWindow();
  setupConfigHandlers();
  setupInputFileHandler();
  setupDownloadReferralHandler();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
