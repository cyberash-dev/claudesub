import {
  extractSubscriptionType,
  readString,
} from "../../../shared/domain/OauthAccount.js";
import {
  findProfile,
  upsertProfile,
} from "../../../shared/domain/ProfilesFile.js";
import { ProfileName } from "../../../shared/domain/ProfileName.js";
import { profileKeychainService } from "../../../shared/domain/ServiceNames.js";
import type { ProfileMetadata } from "../../../shared/domain/ProfileMetadata.js";
import type { SaveCommand, SaveCommandInput } from "../ports/inbound/SaveCommand.js";
import type { SaveCredentialStore } from "../ports/outbound/SaveCredentialStore.js";
import type { SaveProfileRepository } from "../ports/outbound/SaveProfileRepository.js";
import type { SaveActiveMarker } from "../ports/outbound/SaveActiveMarker.js";
import type { SaveClaudeJsonReader } from "../ports/outbound/SaveClaudeJsonReader.js";
import type { SaveClock } from "../ports/outbound/SaveClock.js";
import {
  NotLoggedIn,
  ProfileAlreadyExists,
  type SaveOutcome,
} from "../domain/SaveOutcome.js";

export class SaveProfile implements SaveCommand {
  constructor(
    private readonly credentials: SaveCredentialStore,
    private readonly repo: SaveProfileRepository,
    private readonly marker: SaveActiveMarker,
    private readonly claudeJson: SaveClaudeJsonReader,
    private readonly clock: SaveClock,
  ) {}

  async execute(input: SaveCommandInput): Promise<SaveOutcome> {
    const name = ProfileName.parse(input.name);
    const file = await this.repo.read();
    const existing = findProfile(file, name.value);
    if (existing && !input.overwrite) {
      throw new ProfileAlreadyExists(name.value);
    }

    const view = await this.claudeJson.read();
    if (!view.oauthAccount || !view.userID) {
      throw new NotLoggedIn();
    }

    const blob = await this.credentials.readLive();
    await this.credentials.writeProfile(profileKeychainService(name.value), blob);

    const now = this.clock.nowIso();
    const profile: ProfileMetadata = {
      name: name.value,
      oauthAccount: view.oauthAccount,
      userID: view.userID,
      email: readString(view.oauthAccount, "emailAddress"),
      orgName: readString(view.oauthAccount, "organizationName"),
      subscriptionType: extractSubscriptionType(view.oauthAccount),
      createdAt: existing?.createdAt ?? now,
      lastUsedAt: now,
    };

    await this.repo.write(upsertProfile(file, profile));
    await this.marker.write(name.value);

    return { profile };
  }
}
