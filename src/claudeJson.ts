import { open, readFile, writeFile, rename, stat, unlink } from "node:fs/promises";
import { dirname, basename, join } from "node:path";
import { randomBytes } from "node:crypto";
import { claudeJsonPath } from "./paths.js";
import type { OauthAccount } from "./types.js";

const lockPath = `${claudeJsonPath}.csm.lock`;

export interface ClaudeJsonView {
  raw: Record<string, unknown>;
  oauthAccount: OauthAccount | undefined;
  userID: string | undefined;
}

export async function readClaudeJson(): Promise<ClaudeJsonView> {
  const raw = JSON.parse(await readFile(claudeJsonPath, "utf8")) as Record<string, unknown>;
  return {
    raw,
    oauthAccount: (raw.oauthAccount as OauthAccount | undefined),
    userID: typeof raw.userID === "string" ? raw.userID : undefined,
  };
}

async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const deadline = Date.now() + 5_000;
  while (true) {
    try {
      const handle = await open(lockPath, "wx");
      try {
        return await fn();
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

export async function patchClaudeJson(
  oauthAccount: OauthAccount,
  userID: string,
): Promise<void> {
  await withLock(async () => {
    const view = await readClaudeJson();
    view.raw.oauthAccount = oauthAccount;
    view.raw.userID = userID;
    const mode = (await stat(claudeJsonPath)).mode & 0o777;
    const dir = dirname(claudeJsonPath);
    const tmp = join(dir, `${basename(claudeJsonPath)}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`);
    await writeFile(tmp, JSON.stringify(view.raw, null, 2), { mode });
    await rename(tmp, claudeJsonPath);
  });
}
