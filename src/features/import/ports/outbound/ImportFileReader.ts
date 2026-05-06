export interface ImportFileReader {
  read(path: string): Promise<Uint8Array>;
}
