import type { UseCredentialStore } from "../../ports/outbound/UseCredentialStore.js";
import {
  wincredRead,
  wincredWrite,
  WincredEntryNotFound,
} from "../../../../shared/domain/WincredPowerShell.js";

export class WindowsCmUseCredentialStore implements UseCredentialStore {
  constructor(
    private readonly account: string,
    private readonly liveTarget: string,
  ) {}

  async readLive(): Promise<string> {
    return await this.read(this.liveTarget);
  }

  async writeLive(blob: string): Promise<void> {
    await wincredWrite(this.liveTarget, blob, this.account);
  }

  async readProfile(service: string): Promise<string> {
    return await this.read(service);
  }

  async writeProfile(service: string, blob: string): Promise<void> {
    await wincredWrite(service, blob, this.account);
  }

  private async read(target: string): Promise<string> {
    try {
      return await wincredRead(target);
    } catch (err) {
      if (err instanceof WincredEntryNotFound) {
        throw new Error(`Credential Manager entry "${target}" not found.`);
      }
      throw err;
    }
  }
}
