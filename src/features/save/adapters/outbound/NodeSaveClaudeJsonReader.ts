import { readFile } from "node:fs/promises";
import type { OauthAccount } from "../../../../shared/domain/OauthAccount.js";
import type {
  SaveClaudeJsonReader,
  SaveClaudeJsonView,
} from "../../ports/outbound/SaveClaudeJsonReader.js";

export class NodeSaveClaudeJsonReader implements SaveClaudeJsonReader {
  constructor(private readonly claudeJsonPath: string) {}

  async read(): Promise<SaveClaudeJsonView> {
    const raw = JSON.parse(await readFile(this.claudeJsonPath, "utf8")) as Record<string, unknown>;
    return {
      oauthAccount: (raw.oauthAccount as OauthAccount | undefined),
      userID: typeof raw.userID === "string" ? raw.userID : undefined,
    };
  }
}
