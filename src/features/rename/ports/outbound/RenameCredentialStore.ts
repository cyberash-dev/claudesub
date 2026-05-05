export interface RenameCredentialStore {
  read(service: string): Promise<string>;
  write(service: string, blob: string): Promise<void>;
  delete(service: string): Promise<void>;
}
