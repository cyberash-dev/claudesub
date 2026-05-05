import { readFile } from "node:fs/promises";
import type { OauthAccount } from "../../../../shared/domain/OauthAccount.js";
import type {
  StatusClaudeJsonReader,
  StatusClaudeJsonView,
} from "../../ports/outbound/StatusClaudeJsonReader.js";

export class NodeStatusClaudeJsonReader implements StatusClaudeJsonReader {
  constructor(private readonly claudeJsonPath: string) {}

  async read(): Promise<StatusClaudeJsonView | null> {
    let raw: string;
    try {
      raw = await readFile(this.claudeJsonPath, "utf8");
    } catch {
      return null;
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
    return {
      oauthAccount: (parsed.oauthAccount as OauthAccount | undefined),
      userID: typeof parsed.userID === "string" ? parsed.userID : undefined,
    };
  }
}
