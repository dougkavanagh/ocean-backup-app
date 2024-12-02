import { ipcMain } from "electron";
import { getOutputDir } from "../config";
import { downloadReferrals } from "../api";

export function setupDownloadReferralHandler(): void {
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
} 