export interface SaveActiveMarker {
  write(name: string): Promise<void>;
}
