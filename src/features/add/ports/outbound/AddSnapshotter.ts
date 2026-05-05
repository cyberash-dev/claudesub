export interface AddSnapshotter {
  snapshot(name: string): Promise<void>;
}
