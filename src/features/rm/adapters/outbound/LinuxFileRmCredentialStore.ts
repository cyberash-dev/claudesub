import { unlink } from "node:fs/promises";
import { join } from "node:path";
import type { RmCredentialStore } from "../../ports/outbound/RmCredentialStore.js";
import { serviceToProfileFileName } from "../../../../shared/domain/LinuxSlotMapping.js";

export class LinuxFileRmCredentialStore implements RmCredentialStore {
  constructor(private readonly slotDir: string) {}

  async deleteProfile(service: string): Promise<boolean> {
    const path = join(this.slotDir, serviceToProfileFileName(service));
    try {
      await unlink(path);
      return true;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw err;
    }
  }
}
