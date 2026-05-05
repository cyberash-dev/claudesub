export interface RenameActiveMarker {
  read(): Promise<string | null>;
  write(name: string): Promise<void>;
}
