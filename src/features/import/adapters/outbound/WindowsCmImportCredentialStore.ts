import type { ImportCredentialStore } from "../../ports/outbound/ImportCredentialStore.js";
import { wincredWrite } from "../../../../shared/domain/WincredPowerShell.js";

export class WindowsCmImportCredentialStore implements ImportCredentialStore {
  constructor(private readonly account: string) {}

  async writeProfile(service: string, blob: string): Promise<void> {
    await wincredWrite(service, blob, this.account);
  }
}
