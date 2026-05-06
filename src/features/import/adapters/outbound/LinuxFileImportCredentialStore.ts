import { mkdir, rename, writeFile, chmod } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import type { ImportCredentialStore } from "../../ports/outbound/ImportCredentialStore.js";
import { serviceToProfileFileName } from "../../../../shared/domain/LinuxSlotMapping.js";

export class LinuxFileImportCredentialStore implements ImportCredentialStore {
  constructor(private readonly slotDir: string) {}

  async writeProfile(service: string, blob: string): Promise<void> {
    await mkdir(this.slotDir, { recursive: true, mode: 0o700 });
    await chmod(this.slotDir, 0o700).catch(() => {});
    const path = join(this.slotDir, serviceToProfileFileName(service));
    const tmp = `${path}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
    await writeFile(tmp, blob, { mode: 0o600 });
    await rename(tmp, path);
  }
}
