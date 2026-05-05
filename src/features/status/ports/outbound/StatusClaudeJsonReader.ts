import type { OauthAccount } from "../../../../shared/domain/OauthAccount.js";

export interface StatusClaudeJsonView {
  oauthAccount: OauthAccount | undefined;
  userID: string | undefined;
}

export interface StatusClaudeJsonReader {
  read(): Promise<StatusClaudeJsonView | null>;
}
