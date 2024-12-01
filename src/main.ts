import { app, BrowserWindow, ipcMain, dialog } from "electron";
import * as path from "path";
import Store from "electron-store";
import * as fs from "fs";
import { parse } from "csv-parse/sync";

const oceanHost = "https://staging.cognisantmd.com";

interface Credentials {
  clientId: string;
  clientSecret: string;
}

interface StoreSchema {
  credentials?: Credentials;
  outputDir?: string;
}

let mainWindow: BrowserWindow;

const store = new Store<StoreSchema>();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 800,
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

// File handling// Update the file dialog filter to handle case-insensitive extensions
ipcMain.handle("select-input-file", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters: [
      { name: "Referral Files", extensions: ["txt", "csv", "CSV"] }, // Added CSV uppercase
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
        // Extract referral refs from the first column
        const refs = records.map((record: any) => Object.values(record)[0]);
        return { success: true, refs };
      } else {
        // For txt files, split by newline and filter empty lines
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

// Update the output directory handler to create the directory
ipcMain.handle("select-output-dir", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const outputDir = result.filePaths[0];
    store.set("outputDir", outputDir);
    return outputDir;
  }
  return null;
});

ipcMain.handle("get-output-dir", () => {
  return store.get("outputDir") || app.getPath("downloads");
});

// Ocean API configuration
ipcMain.on("save-credentials", async (event, credentials: Credentials) => {
  store.set("credentials", credentials);
  event.reply("credentials-saved");
});

ipcMain.on("load-credentials", (event) => {
  const credentials = store.get("credentials");
  event.reply("credentials-loaded", credentials);
});

// OAuth2 token management
async function getAccessToken(): Promise<string> {
  const credentials = store.get("credentials");
  if (!credentials) throw new Error("No credentials found");

  const authorization =
    "basic " +
    Buffer.from(credentials.clientId + ":" + credentials.clientSecret).toString(
      "base64"
    );
  const res = await fetch(
    oceanHost + "/svc/oauth2/token?grant_type=client_credentials",
    {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
    }
  );
  const token = await res.json();
  return token.access_token;
}

// Update the download handler for better progress and completion handling
ipcMain.on("download-referrals", async (event, refs: string[]) => {
  try {
    const token = await getAccessToken();
    const outputDir = store.get("outputDir") || app.getPath("downloads");
    const total = refs.length;
    let completed = 0;
    const results = {
      successful: [] as string[],
      failed: [] as { ref: string; error: string }[],
    };

    event.reply("download-start");
    ensureDirectoryExists(outputDir);
    for (const ref of refs) {
      const filePath = path.join(outputDir, `referral-${ref}.pdf`);
      if (fs.existsSync(filePath)) {
        // skip this file
        completed++;
        results.successful.push(ref);
        event.reply("download-progress", {
          ref,
          filePath,
          progress: (completed / total) * 100,
          total,
          completed,
        });
        continue;
      }
      try {
        if (ref.length < 10) {
          throw new Error("Invalid referral ref: " + ref);
        }
        const response = await fetch(
          oceanHost + `/svc/fhir/v1/ServiceRequest/${ref}/$letter`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const buffer = await response.arrayBuffer();
        fs.writeFileSync(filePath, Buffer.from(buffer));

        completed++;
        results.successful.push(ref);
        event.reply("download-progress", {
          progress: (completed / total) * 100,
          total,
          completed,
        });
      } catch (error: any) {
        results.failed.push({ ref, error: error.message });
        completed++;
        event.reply("download-error", { ref, error: error.message });
      }
    }

    function ensureDirectoryExists(dirPath: string): void {
      try {
        fs.mkdirSync(dirPath, { recursive: true });
      } catch (error: any) {
        if (error.code !== "EEXIST") {
          throw error;
        }
      }
    }

    event.reply("download-complete", {
      total,
      completed,
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
