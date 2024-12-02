import { ipcMain, dialog } from "electron";
import { getMainWindow } from "../window";
import { 
  getOutputDir, 
  saveOutputDir, 
  saveCredentials, 
  getCredentials, 
  getOceanHost 
} from "../config";

export function setupConfigHandlers(): void {
  ipcMain.handle("select-download-dir", async () => {
    const result = await dialog.showOpenDialog(getMainWindow(), {
      properties: ["openDirectory"],
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const outputDir = result.filePaths[0];
      saveOutputDir(outputDir);
      return outputDir;
    }
    return null;
  });

  ipcMain.handle("get-output-dir", () => {
    return getOutputDir();
  });

  ipcMain.on("save-credentials", async (event, data) => {
    saveCredentials(data.credentials, data.oceanHost);
    event.reply("credentials-saved");
  });

  ipcMain.on("load-credentials", (event) => {
    const credentials = getCredentials();
    const oceanHost = getOceanHost();
    event.reply("credentials-loaded", { credentials, oceanHost });
  });
} 