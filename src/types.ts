export type OauthAccount = Record<string, unknown>;

export interface ProfileMetadata {
  name: string;
  oauthAccount: OauthAccount;
  userID: string;
  email: string;
  orgName: string;
  subscriptionType: string;
  createdAt: string;
  lastUsedAt: string;
}

export interface ProfilesFile {
  version: 1;
  profiles: ProfileMetadata[];
}
