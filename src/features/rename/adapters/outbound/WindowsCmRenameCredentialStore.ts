import type { RenameCredentialStore } from "../../ports/outbound/RenameCredentialStore.js";
import {
  wincredRead,
  wincredWrite,
  wincredDelete,
  WincredEntryNotFound,
} from "../../../../shared/domain/WincredPowerShell.js";

export class WindowsCmRenameCredentialStore implements RenameCredentialStore {
  constructor(private readonly account: string) {}

  async read(service: string): Promise<string> {
    try {
      return await wincredRead(service);
    } catch (err) {
      if (err instanceof WincredEntryNotFound) {
        throw new Error(`Credential Manager entry "${service}" not found.`);
      }
      throw err;
    }
  }

  async write(service: string, blob: string): Promise<void> {
    await wincredWrite(service, blob, this.account);
  }

  async delete(service: string): Promise<void> {
    await wincredDelete(service);
  }
}
