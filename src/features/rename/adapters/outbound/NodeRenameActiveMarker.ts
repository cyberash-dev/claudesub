import { mkdir, readFile, writeFile, rename, chmod } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import type { RenameActiveMarker } from "../../ports/outbound/RenameActiveMarker.js";

export class NodeRenameActiveMarker implements RenameActiveMarker {
  constructor(
    private readonly stateDir: string,
    private readonly markerPath: string,
  ) {}

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

  async write(name: string): Promise<void> {
    await mkdir(this.stateDir, { recursive: true, mode: 0o700 });
    await chmod(this.stateDir, 0o700).catch(() => {});
    const tmp = `${this.markerPath}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
    await writeFile(tmp, name, { mode: 0o600 });
    await rename(tmp, this.markerPath);
  }
}
