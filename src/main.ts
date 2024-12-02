import { app, BrowserWindow, ipcMain, dialog } from "electron";
import { parse } from "csv-parse/sync";
import * as fs from "fs";
import * as path from "path";
import { createWindow, getMainWindow } from "./window";
import { getOutputDir, saveOutputDir, saveCredentials, getCredentials, getOceanHost } from "./config";
import { downloadReferrals } from "./api";

app.whenReady().then(createWindow);

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

ipcMain.handle("select-input-file", async () => {
  const result = await dialog.showOpenDialog(getMainWindow(), {
    properties: ["openFile"],
    filters: [
      { name: "Referral Files", extensions: ["txt", "csv", "CSV"] },
    ],
  });

  try {
    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0];
      const content = fs.readFileSync(filePath, "utf-8");

      if (path.extname(filePath).toLowerCase() === ".csv") {
        const records = parse(content, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
          relaxColumnCount: true,
        });
        const refs = records.map((record: any) => Object.values(record)[0]);
        return { success: true, refs };
      } else {
        const refs = content
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
        return { success: true, refs };
      }
    }
    return { success: true, refs: [] };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Error processing file",
    };
  }
});

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

ipcMain.on("download-referrals", async (event, refs: string[]) => {
  try {
    const outputDir = getOutputDir();
    event.reply("download-start");

    const results = await downloadReferrals(refs, outputDir, (completed, total) => {
      event.reply("download-progress", {
        progress: (completed / total) * 100,
        total,
        completed,
      });
    });

    event.reply("download-complete", {
      total: refs.length,
      completed: refs.length,
      successful: results.successful.length,
      failed: results.failed,
      outputDir,
    });
  } catch (error: any) {
    event.reply("download-error", {
      error: error.message || "Unknown error occurred",
    });
  }
});
