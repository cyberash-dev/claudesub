import { readFile, unlink } from "node:fs/promises";
import type { RmActiveMarker } from "../../ports/outbound/RmActiveMarker.js";

export class NodeRmActiveMarker implements RmActiveMarker {
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

  async clear(): Promise<void> {
    await unlink(this.markerPath).catch((err: NodeJS.ErrnoException) => {
      if (err.code !== "ENOENT") throw err;
    });
  }
}
