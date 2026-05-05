import type { OauthAccount } from "../../../../shared/domain/OauthAccount.js";

export interface SaveClaudeJsonView {
  oauthAccount: OauthAccount | undefined;
  userID: string | undefined;
}

export interface SaveClaudeJsonReader {
  read(): Promise<SaveClaudeJsonView>;
}
