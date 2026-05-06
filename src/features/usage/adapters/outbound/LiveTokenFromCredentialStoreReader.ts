import {
  LiveAccessTokenMissing,
  type UsageLiveTokenReader,
} from "../../ports/outbound/UsageLiveTokenReader.js";

interface LiveCredentialStoreReader {
  readLive(): Promise<string>;
}

export class LiveTokenFromCredentialStoreReader implements UsageLiveTokenReader {
  constructor(private readonly store: LiveCredentialStoreReader) {}

  async readAccessToken(): Promise<string> {
    let raw: string;
    try {
      raw = await this.store.readLive();
    } catch {
      throw new LiveAccessTokenMissing();
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new LiveAccessTokenMissing();
    }
    const oauth = (parsed as { claudeAiOauth?: { accessToken?: unknown } })?.claudeAiOauth;
    const token = oauth?.accessToken;
    if (typeof token !== "string" || token.length === 0) {
      throw new LiveAccessTokenMissing();
    }
    return token;
  }
}
