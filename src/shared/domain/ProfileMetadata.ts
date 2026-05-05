import type { OauthAccount } from "./OauthAccount.js";

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
