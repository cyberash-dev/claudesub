export interface ExportFileWriter {
  write(path: string, bytes: Uint8Array): Promise<void>;
}
