import {
  findProfile,
  upsertProfile,
} from "../../../shared/domain/ProfilesFile.js";
import { profileKeychainService } from "../../../shared/domain/ServiceNames.js";
import type { UseCommand, UseCommandInput } from "../ports/inbound/UseCommand.js";
import type { UseCredentialStore } from "../ports/outbound/UseCredentialStore.js";
import type { UseProfileRepository } from "../ports/outbound/UseProfileRepository.js";
import type { UseActiveMarker } from "../ports/outbound/UseActiveMarker.js";
import type { UseClaudeJsonWriter } from "../ports/outbound/UseClaudeJsonWriter.js";
import type { UseProcessInspector } from "../ports/outbound/UseProcessInspector.js";
import type { UseAuthVerifier } from "../ports/outbound/UseAuthVerifier.js";
import type { UseClock } from "../ports/outbound/UseClock.js";
import {
  AuthVerificationFailed,
  ClaudeIsRunning,
  UnknownProfile,
  type SwitchOutcome,
} from "../domain/SwitchOutcome.js";

export interface AutoSnapshotWarning {
  profileName: string;
  reason: string;
}

export interface SwitchProfileEvents {
  onAutoSnapshotWarning?(w: AutoSnapshotWarning): void;
}

export class SwitchProfile implements UseCommand {
  constructor(
    private readonly credentials: UseCredentialStore,
    private readonly repo: UseProfileRepository,
    private readonly marker: UseActiveMarker,
    private readonly claudeJson: UseClaudeJsonWriter,
    private readonly inspector: UseProcessInspector,
    private readonly auth: UseAuthVerifier,
    private readonly clock: UseClock,
    private readonly events: SwitchProfileEvents = {},
  ) {}

  async execute(input: UseCommandInput): Promise<SwitchOutcome> {
    const file = await this.repo.read();
    const target = findProfile(file, input.name);
    if (!target) throw new UnknownProfile(input.name);

    if (!input.force) {
      const running = await this.inspector.findRunning();
      if (running.length > 0) throw new ClaudeIsRunning(running);
    }

    const active = await this.marker.read();
    if (active && active !== input.name) {
      const activeProfile = findProfile(file, active);
      if (activeProfile) {
        try {
          const currentBlob = await this.credentials.readLive();
          await this.credentials.writeProfile(profileKeychainService(active), currentBlob);
          const refreshed = { ...activeProfile, lastUsedAt: this.clock.nowIso() };
          await this.repo.write(upsertProfile(file, refreshed));
        } catch (err) {
          this.events.onAutoSnapshotWarning?.({ profileName: active, reason: (err as Error).message });
        }
      }
    }

    const targetBlob = await this.credentials.readProfile(profileKeychainService(input.name));
    await this.credentials.writeLive(targetBlob);
    await this.claudeJson.patch(target.oauthAccount, target.userID);

    const fileAfter = await this.repo.read();
    const updated = { ...target, lastUsedAt: this.clock.nowIso() };
    await this.repo.write(upsertProfile(fileAfter, updated));
    await this.marker.write(input.name);

    let summary: string | null = null;
    if (!input.noVerify) {
      const verdict = await this.auth.verify();
      if (!verdict.ok) throw new AuthVerificationFailed(verdict.summary);
      summary = verdict.summary;
    }
    return { target: updated, authVerificationSummary: summary };
  }
}
