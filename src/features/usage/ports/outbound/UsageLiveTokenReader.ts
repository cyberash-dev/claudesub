export interface UsageLiveTokenReader {
  readAccessToken(): Promise<string>;
}

export class LiveAccessTokenMissing extends Error {
  constructor() {
    super(
      "Live store has no claudeAiOauth.accessToken — log in via `claude auth login` first.",
    );
    this.name = "LiveAccessTokenMissing";
  }
}
