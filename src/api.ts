import * as fs from "fs";
import * as path from "path";
import { getCredentials, getOceanHost } from "./config";

export interface DownloadResult {
  successful: string[];
  failed: { ref: string; error: string }[];
}

async function getAccessToken(): Promise<string> {
  const credentials = getCredentials();
  const oceanHost = getOceanHost();
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

export function ensureDirectoryExists(dirPath: string): void {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
  } catch (error: any) {
    if (error.code !== "EEXIST") {
      throw error;
    }
  }
}

export async function downloadReferral(
  ref: string,
  outputDir: string,
  token: string
): Promise<void> {
  const oceanHost = getOceanHost();
  const filePath = path.join(outputDir, `referral-${ref}.pdf`);

  if (fs.existsSync(filePath)) {
    return;
  }

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
}

export async function downloadReferrals(
  refs: string[],
  outputDir: string,
  progressCallback: (completed: number, total: number) => void
): Promise<DownloadResult> {
  const token = await getAccessToken();
  const total = refs.length;
  let completed = 0;
  const results: DownloadResult = {
    successful: [],
    failed: [],
  };

  ensureDirectoryExists(outputDir);

  for (const ref of refs) {
    try {
      await downloadReferral(ref, outputDir, token);
      results.successful.push(ref);
    } catch (error: any) {
      results.failed.push({ ref, error: error.message });
    }
    completed++;
    progressCallback(completed, total);
  }

  return results;
} 