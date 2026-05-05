import {
  findProfile,
  removeProfile,
} from "../../../shared/domain/ProfilesFile.js";
import { profileKeychainService } from "../../../shared/domain/ServiceNames.js";
import type { RmCommand, RmCommandInput } from "../ports/inbound/RmCommand.js";
import type { RmCredentialStore } from "../ports/outbound/RmCredentialStore.js";
import type { RmProfileRepository } from "../ports/outbound/RmProfileRepository.js";
import type { RmActiveMarker } from "../ports/outbound/RmActiveMarker.js";
import type { RmConfirmer } from "../ports/outbound/RmConfirmer.js";
import { RmAborted, UnknownProfile, type RmOutcome } from "../domain/RmOutcome.js";

export class RemoveProfile implements RmCommand {
  constructor(
    private readonly credentials: RmCredentialStore,
    private readonly repo: RmProfileRepository,
    private readonly marker: RmActiveMarker,
    private readonly confirmer: RmConfirmer,
  ) {}

  async execute(input: RmCommandInput): Promise<RmOutcome> {
    const file = await this.repo.read();
    if (!findProfile(file, input.name)) {
      throw new UnknownProfile(input.name);
    }
    if (!input.skipConfirmation) {
      const ok = await this.confirmer.confirmName(input.name);
      if (!ok) throw new RmAborted();
    }

    const wasMissing = !(await this.credentials.deleteProfile(profileKeychainService(input.name)));
    await this.repo.write(removeProfile(file, input.name));
    const active = await this.marker.read();
    let liveActiveCleared = false;
    if (active === input.name) {
      await this.marker.clear();
      liveActiveCleared = true;
    }
    return { removedName: input.name, keychainSlotWasMissing: wasMissing, liveActiveCleared };
  }
}
