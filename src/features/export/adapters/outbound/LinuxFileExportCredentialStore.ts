import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ExportCredentialStore } from "../../ports/outbound/ExportCredentialStore.js";
import { serviceToProfileFileName } from "../../../../shared/domain/LinuxSlotMapping.js";

export class LinuxFileExportCredentialStore implements ExportCredentialStore {
  constructor(private readonly slotDir: string) {}

  async readProfile(service: string): Promise<string> {
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
}
