import {
  findProfile,
  removeProfile,
  upsertProfile,
} from "../../../shared/domain/ProfilesFile.js";
import { ProfileName } from "../../../shared/domain/ProfileName.js";
import { profileKeychainService } from "../../../shared/domain/ServiceNames.js";
import type {
  RenameCommand,
  RenameCommandInput,
} from "../ports/inbound/RenameCommand.js";
import type { RenameCredentialStore } from "../ports/outbound/RenameCredentialStore.js";
import type { RenameProfileRepository } from "../ports/outbound/RenameProfileRepository.js";
import type { RenameActiveMarker } from "../ports/outbound/RenameActiveMarker.js";
import {
  RenameSourceMissing,
  RenameTargetExists,
  type RenameOutcome,
} from "../domain/RenameOutcome.js";

export class RenameProfile implements RenameCommand {
  constructor(
    private readonly credentials: RenameCredentialStore,
    private readonly repo: RenameProfileRepository,
    private readonly marker: RenameActiveMarker,
  ) {}

  async execute(input: RenameCommandInput): Promise<RenameOutcome> {
    const newName = ProfileName.parse(input.newName);
    const file = await this.repo.read();
    const source = findProfile(file, input.oldName);
    if (!source) throw new RenameSourceMissing(input.oldName);
    if (findProfile(file, newName.value)) throw new RenameTargetExists(newName.value);

    const blob = await this.credentials.read(profileKeychainService(input.oldName));
    await this.credentials.write(profileKeychainService(newName.value), blob);
    await this.credentials.delete(profileKeychainService(input.oldName));

    const renamed = { ...source, name: newName.value };
    const intermediate = removeProfile(file, input.oldName);
    await this.repo.write(upsertProfile(intermediate, renamed));

    const active = await this.marker.read();
    let activeMarkerUpdated = false;
    if (active === input.oldName) {
      await this.marker.write(newName.value);
      activeMarkerUpdated = true;
    }
    return { oldName: input.oldName, newName: newName.value, activeMarkerUpdated };
  }
}
