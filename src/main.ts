import { app, BrowserWindow, ipcMain, dialog } from "electron";
import * as path from "path";
import Store from "electron-store";
import * as fs from "fs";

const oceanHost = "https://staging.cognisantmd.com";

interface Credentials {
  clientId: string;
  clientSecret: string;
}

let mainWindow: BrowserWindow;

const store = new Store<{
  credentials?: Credentials;
  outputDir?: string;
}>();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  // Enable debugging port for renderer process
  app.commandLine.appendSwitch("remote-debugging-port", "9222");

  mainWindow.loadFile(path.join(__dirname, "../src/index.html"));

  // Open DevTools automatically if in development
  if (process.env.NODE_ENV === "development") {
    mainWindow.webContents.openDevTools();
  }

  // Add this after creating the window
  mainWindow.webContents.on("did-finish-load", () => {
    debugger; // This will pause execution when hit
    console.log("Window loaded!");
  });
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

// PDF download handling
ipcMain.on("download-referrals", async (event, refs: string[]) => {
  try {
    const token = await getAccessToken();
    const outputDir = store.get("outputDir") || app.getPath("downloads");

    for (const ref of refs) {
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
      event.reply("referral-downloaded", { ref, filePath });
    }
  } catch (error: any) {
    event.reply("download-error", error.message);
  }
});
