import type { SaveCredentialStore } from "../../ports/outbound/SaveCredentialStore.js";
import {
  wincredRead,
  wincredWrite,
  WincredEntryNotFound,
} from "../../../../shared/domain/WincredPowerShell.js";

export class WindowsCmSaveCredentialStore implements SaveCredentialStore {
  constructor(
    private readonly account: string,
    private readonly liveTarget: string,
  ) {}

  async readLive(): Promise<string> {
    try {
      return await wincredRead(this.liveTarget);
    } catch (err) {
      if (err instanceof WincredEntryNotFound) {
        throw new Error(`Live Credential Manager entry "${this.liveTarget}" not found.`);
      }
      throw err;
    }
  }

  async writeProfile(service: string, blob: string): Promise<void> {
    await wincredWrite(service, blob, this.account);
  }
}
