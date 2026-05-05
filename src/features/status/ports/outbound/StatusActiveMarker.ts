export interface StatusActiveMarker {
  read(): Promise<string | null>;
}
