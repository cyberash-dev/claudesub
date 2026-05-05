import type { ProfileMetadata } from "../../../shared/domain/ProfileMetadata.js";

export interface SaveOutcome {
  profile: ProfileMetadata;
}

export class ProfileAlreadyExists extends Error {
  constructor(public readonly profileName: string) {
    super(`Profile "${profileName}" already exists. Pass --overwrite to replace it.`);
    this.name = "ProfileAlreadyExists";
  }
}

export class NotLoggedIn extends Error {
  constructor() {
    super("~/.claude.json has no oauthAccount/userID — looks like you're not logged in. Run `claude auth login` first.");
    this.name = "NotLoggedIn";
  }
}
