import { findProfile } from "../../../shared/domain/ProfilesFile.js";
import { readAccountUuid } from "../../../shared/domain/OauthAccount.js";
import type { StatusCommand } from "../ports/inbound/StatusCommand.js";
import type { StatusProfileRepository } from "../ports/outbound/StatusProfileRepository.js";
import type { StatusActiveMarker } from "../ports/outbound/StatusActiveMarker.js";
import type { StatusClaudeJsonReader } from "../ports/outbound/StatusClaudeJsonReader.js";
import type { StatusAuthInspector } from "../ports/outbound/StatusAuthInspector.js";
import type { StatusReport } from "../domain/StatusReport.js";

export class GetStatus implements StatusCommand {
  constructor(
    private readonly repo: StatusProfileRepository,
    private readonly marker: StatusActiveMarker,
    private readonly claudeJson: StatusClaudeJsonReader,
    private readonly auth: StatusAuthInspector,
  ) {}

  async execute(): Promise<StatusReport> {
    const active = await this.marker.read();
    const file = await this.repo.read();
    const profile = active ? findProfile(file, active) : undefined;
    const view = await this.claudeJson.read();
    const authStatus = await this.auth.fetch();

    let desyncReason: string | null = null;
    if (profile && view?.oauthAccount) {
      const expected = readAccountUuid(profile.oauthAccount);
      const actual = readAccountUuid(view.oauthAccount);
      if (expected && actual && expected !== actual) {
        desyncReason = `~/.claude.json accountUuid (${actual}) does not match active profile's recorded accountUuid (${expected}).`;
      }
    }

    return {
      active,
      profileKnown: Boolean(profile),
      claudeJson: view ? {
        userID: view.userID ?? null,
        accountUuid: view.oauthAccount ? (readAccountUuid(view.oauthAccount) ?? null) : null,
        emailAddress: view.oauthAccount && typeof view.oauthAccount.emailAddress === "string" ? view.oauthAccount.emailAddress : null,
      } : null,
      desyncReason,
      authStatus,
    };
  }
}
