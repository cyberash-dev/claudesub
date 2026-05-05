import type { OauthAccount } from "../../../../shared/domain/OauthAccount.js";

export interface UseClaudeJsonWriter {
  patch(oauthAccount: OauthAccount, userID: string): Promise<void>;
}
