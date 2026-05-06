import { readFile } from "node:fs/promises";
import type { ImportActiveMarker } from "../../ports/outbound/ImportActiveMarker.js";

export class NodeImportActiveMarker implements ImportActiveMarker {
  constructor(private readonly markerPath: string) {}

  async read(): Promise<string | null> {
    let raw: string;
    try {
      raw = await readFile(this.markerPath, "utf8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
    const trimmed = raw.trim();
    return trimmed.length === 0 ? null : trimmed;
  }
}
