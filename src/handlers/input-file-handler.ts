import { ipcMain, dialog } from "electron";
import { parse } from "csv-parse/sync";
import * as fs from "fs";
import * as path from "path";
import { getMainWindow } from "../window";

export function setupInputFileHandler(): void {
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
} 