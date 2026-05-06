import { mkdir, readFile, rename, writeFile, unlink, chmod } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import type { RenameCredentialStore } from "../../ports/outbound/RenameCredentialStore.js";
import { serviceToProfileFileName } from "../../../../shared/domain/LinuxSlotMapping.js";

export class LinuxFileRenameCredentialStore implements RenameCredentialStore {
  constructor(private readonly slotDir: string) {}

  async read(service: string): Promise<string> {
    const path = join(this.slotDir, serviceToProfileFileName(service));
    try {
      return await readFile(path, "utf8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error(`Profile slot file "${service}" not found at ${path}`);
      }
      throw err;
    }
  }

  async write(service: string, blob: string): Promise<void> {
    await mkdir(this.slotDir, { recursive: true, mode: 0o700 });
    await chmod(this.slotDir, 0o700).catch(() => {});
    const path = join(this.slotDir, serviceToProfileFileName(service));
    const tmp = `${path}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
    await writeFile(tmp, blob, { mode: 0o600 });
    await rename(tmp, path);
  }

  async delete(service: string): Promise<void> {
    const path = join(this.slotDir, serviceToProfileFileName(service));
    try {
      await unlink(path);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }
}
