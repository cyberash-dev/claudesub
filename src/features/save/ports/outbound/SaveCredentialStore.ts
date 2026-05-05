export interface SaveCredentialStore {
  readLive(): Promise<string>;
  writeProfile(name: string, blob: string): Promise<void>;
}
