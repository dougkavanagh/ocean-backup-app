import { app, BrowserWindow, ipcMain, dialog } from "electron";
import * as path from "path";
import Store from "electron-store";
import * as fs from "fs";
import { parse } from "csv-parse/sync";

const oceanHost = "https://ocean.cognisantmd.com";

// ... (previous interfaces and window setup code remains the same)

// Add this function to handle directory creation
function ensureDirectoryExists(dirPath: string): void {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
  } catch (error: any) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
}

// Update the output directory handler to create the directory
ipcMain.handle("select-output-dir", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"]
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    const outputDir = result.filePaths[0];
    ensureDirectoryExists(outputDir);
    store.set("outputDir", outputDir);
    return outputDir;
  }
  return null;
});

// Add a function to get and ensure output directory exists
function getOutputDirectory(): string {
  const outputDir = store.get("outputDir") || path.join(app.getPath("downloads"), "Ocean Referrals");
  ensureDirectoryExists(outputDir);
  return outputDir;
}

// Update the download handler to use the new directory handling
ipcMain.on("download-referrals", async (event, refs: string[]) => {
  try {
    const token = await getAccessToken();
    const outputDir = getOutputDirectory();
    const total = refs.length;
    let completed = 0;
    const results: DownloadResult[] = [];

    event.reply("download-start");

    for (const ref of refs) {
      try {
        if (!ref || typeof ref !== "string" || !ref.trim()) {
          throw new Error("Invalid Referral Reference format");
        }

        const buffer = await downloadReferral(ref, token);
        
        // Create year/month subfolder
        const date = new Date();
        const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        const subDir = path.join(outputDir, yearMonth);
        ensureDirectoryExists(subDir);
        
        // Save file with timestamp
        const timestamp = date.toISOString().replace(/[:.]/g, "-");
        const filePath = path.join(subDir, `${ref}-${timestamp}.pdf`);
        fs.writeFileSync(filePath, Buffer.from(buffer));
        
        results.push({ ref, success: true, filePath });
      } catch (error: any) {
        results.push({ 
          ref, 
          success: false, 
          error: error.message || "Unknown error"
        });
      } finally {
        completed++;
        event.reply("download-progress", {
          progress: (completed / total) * 100,
          total,
          completed,
          ref
        });
      }
    }
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    event.reply("download-complete", {
      total,
      completed,
      successful: successful.length,
      failed: failed.map(f => ({ ref: f.ref, error: f.error })),
      outputDir
    });
  } catch (error: any) {
    event.reply("download-error", { 
      error: error.message || "Unknown error occurred"
    });
  }
});