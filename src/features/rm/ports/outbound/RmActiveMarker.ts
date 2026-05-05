export interface RmActiveMarker {
  read(): Promise<string | null>;
  clear(): Promise<void>;
}
