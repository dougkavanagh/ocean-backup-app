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
    height: 600,
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

// File handling
ipcMain.handle("select-input-file", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters: [
      { name: "Text Files", extensions: ["txt"] },
      { name: "CSV Files", extensions: ["csv"] }
    ]
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    const content = fs.readFileSync(filePath, "utf-8");
    
    if (path.extname(filePath) === ".csv") {
      const records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });
      // Extract referral refs from the first column
      return records.map((record: any) => Object.values(record)[0]);
    } else {
      // For txt files, split by newline and filter empty lines
      return content.split("\n").map(line => line.trim()).filter(Boolean);
    }
  }
  return [];
});

// Output directory selection
ipcMain.handle("select-output-dir", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"]
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

  const authorization = "basic " + Buffer.from(credentials.clientId + ":" + credentials.clientSecret).toString("base64");
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

// PDF download handling with progress
ipcMain.on("download-referrals", async (event, refs: string[]) => {
  try {
    const token = await getAccessToken();
    const outputDir = store.get("outputDir") || app.getPath("downloads");
    const total = refs.length;
    let completed = 0;

    for (const ref of refs) {
      try {
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
        const filePath = path.join(outputDir, `referral-${ref}.pdf`);
        fs.writeFileSync(filePath, Buffer.from(buffer));
        
        completed++;
        event.reply("download-progress", {
          ref,
          filePath,
          progress: (completed / total) * 100,
          total,
          completed
        });
      } catch (error: any) {
        event.reply("download-error", { ref, error: error.message });
        // Continue with next referral even if one fails
        completed++;
      }
    }
    
    event.reply("download-complete", { total, completed });
  } catch (error: any) {
    event.reply("download-error", { error: error.message });
  }
});