import Store from "electron-store";
import { app } from "electron";

export interface Credentials {
  clientId: string;
  clientSecret: string;
}

interface StoreSchema {
  credentials?: Credentials;
  outputDir?: string;
  oceanHost?: string;
}

export const store = new Store<StoreSchema>();

export function getOutputDir(): string {
  return store.get("outputDir") || app.getPath("downloads");
}

export function getOceanHost(): string {
  return store.get("oceanHost") || "https://staging.cognisantmd.com";
}

export function getCredentials(): Credentials | undefined {
  return store.get("credentials");
}

export function saveCredentials(credentials: Credentials, oceanHost: string): void {
  store.set("credentials", credentials);
  store.set("oceanHost", oceanHost);
}

export function saveOutputDir(outputDir: string): void {
  store.set("outputDir", outputDir);
} 