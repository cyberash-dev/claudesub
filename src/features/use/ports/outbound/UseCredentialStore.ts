export interface UseCredentialStore {
  readLive(): Promise<string>;
  writeLive(blob: string): Promise<void>;
  readProfile(service: string): Promise<string>;
  writeProfile(service: string, blob: string): Promise<void>;
}
