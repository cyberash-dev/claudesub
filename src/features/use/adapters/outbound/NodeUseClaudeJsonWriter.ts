import { open, readFile, writeFile, rename, stat, unlink } from "node:fs/promises";
import { dirname, basename, join } from "node:path";
import { randomBytes } from "node:crypto";
import type { OauthAccount } from "../../../../shared/domain/OauthAccount.js";
import type { UseClaudeJsonWriter } from "../../ports/outbound/UseClaudeJsonWriter.js";

export class NodeUseClaudeJsonWriter implements UseClaudeJsonWriter {
  constructor(private readonly claudeJsonPath: string) {}

  async patch(oauthAccount: OauthAccount, userID: string): Promise<void> {
    const lockPath = `${this.claudeJsonPath}.csm.lock`;
    await this.withLock(lockPath, async () => {
      const raw = JSON.parse(await readFile(this.claudeJsonPath, "utf8")) as Record<string, unknown>;
      raw.oauthAccount = oauthAccount;
      raw.userID = userID;
      const mode = (await stat(this.claudeJsonPath)).mode & 0o777;
      const dir = dirname(this.claudeJsonPath);
      const tmp = join(dir, `${basename(this.claudeJsonPath)}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`);
      await writeFile(tmp, JSON.stringify(raw, null, 2), { mode });
      await rename(tmp, this.claudeJsonPath);
    });
  }

  private async withLock(lockPath: string, fn: () => Promise<void>): Promise<void> {
    const deadline = Date.now() + 5_000;
    while (true) {
      try {
        const handle = await open(lockPath, "wx");
        try {
          await fn();
          return;
        } finally {
          await handle.close();
          await unlink(lockPath).catch(() => {});
        }
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
        if (Date.now() > deadline) {
          throw new Error(`Could not acquire lock ${lockPath} after 5s. Stale lock? Remove manually if no other claude-sub is running.`);
        }
        await new Promise((r) => setTimeout(r, 50));
      }
    }
  }
}
