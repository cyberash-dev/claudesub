import type { ExportCredentialStore } from "../../ports/outbound/ExportCredentialStore.js";
import {
  wincredRead,
  WincredEntryNotFound,
} from "../../../../shared/domain/WincredPowerShell.js";

export class WindowsCmExportCredentialStore implements ExportCredentialStore {
  async readProfile(service: string): Promise<string> {
    try {
      return await wincredRead(service);
    } catch (err) {
      if (err instanceof WincredEntryNotFound) {
        throw new Error(`Profile Credential Manager entry "${service}" not found.`);
      }
      throw err;
    }
  }
}
