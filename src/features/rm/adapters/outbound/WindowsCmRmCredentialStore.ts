import type { RmCredentialStore } from "../../ports/outbound/RmCredentialStore.js";
import { wincredDelete } from "../../../../shared/domain/WincredPowerShell.js";

export class WindowsCmRmCredentialStore implements RmCredentialStore {
  async deleteProfile(service: string): Promise<boolean> {
    return await wincredDelete(service);
  }
}
