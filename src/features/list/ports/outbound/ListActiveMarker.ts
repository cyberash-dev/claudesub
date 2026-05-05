export interface ListActiveMarker {
  read(): Promise<string | null>;
}
