export interface ImportCredentialStore {
  writeProfile(service: string, blob: string): Promise<void>;
}
