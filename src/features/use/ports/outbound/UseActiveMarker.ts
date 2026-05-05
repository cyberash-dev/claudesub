export interface UseActiveMarker {
  read(): Promise<string | null>;
  write(name: string): Promise<void>;
}
