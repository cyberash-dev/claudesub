import { readFile } from "node:fs/promises";
import type { ListActiveMarker } from "../../ports/outbound/ListActiveMarker.js";

export class NodeListActiveMarker implements ListActiveMarker {
  constructor(private readonly markerPath: string) {}

  async read(): Promise<string | null> {
    try {
      const raw = await readFile(this.markerPath, "utf8");
      const trimmed = raw.trim();
      return trimmed.length > 0 ? trimmed : null;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }
}
