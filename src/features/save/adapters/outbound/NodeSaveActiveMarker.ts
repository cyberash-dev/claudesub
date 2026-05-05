import { mkdir, writeFile, rename, chmod } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import type { SaveActiveMarker } from "../../ports/outbound/SaveActiveMarker.js";

export class NodeSaveActiveMarker implements SaveActiveMarker {
  constructor(
    private readonly stateDir: string,
    private readonly markerPath: string,
  ) {}

  async write(name: string): Promise<void> {
    await mkdir(this.stateDir, { recursive: true, mode: 0o700 });
    await chmod(this.stateDir, 0o700).catch(() => {});
    const tmp = `${this.markerPath}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
    await writeFile(tmp, name, { mode: 0o600 });
    await rename(tmp, this.markerPath);
  }
}
