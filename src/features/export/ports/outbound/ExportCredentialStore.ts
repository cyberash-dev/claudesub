export interface ExportCredentialStore {
  readProfile(service: string): Promise<string>;
}
