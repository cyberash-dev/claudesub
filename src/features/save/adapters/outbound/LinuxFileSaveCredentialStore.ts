import { mkdir, readFile, rename, writeFile, chmod } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import type { SaveCredentialStore } from "../../ports/outbound/SaveCredentialStore.js";
import { serviceToProfileFileName } from "../../../../shared/domain/LinuxSlotMapping.js";

export class LinuxFileSaveCredentialStore implements SaveCredentialStore {
  constructor(
    private readonly liveCredentialsPath: string,
    private readonly slotDir: string,
  ) {}

  async readLive(): Promise<string> {
    let raw: string;
    try {
      raw = await readFile(this.liveCredentialsPath, "utf8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error(`Live credentials file "${this.liveCredentialsPath}" not found.`);
      }
      throw err;
    }
    assertCredentialsShape(raw, this.liveCredentialsPath);
    return raw;
  }

  async writeProfile(service: string, blob: string): Promise<void> {
    assertCredentialsShape(blob, "<profile blob>");
    await mkdir(this.slotDir, { recursive: true, mode: 0o700 });
    await chmod(this.slotDir, 0o700).catch(() => {});
    const path = join(this.slotDir, serviceToProfileFileName(service));
    const tmp = `${path}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
    await writeFile(tmp, blob, { mode: 0o600 });
    await rename(tmp, path);
  }
}

function assertCredentialsShape(raw: string, where: string): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Corrupt credentials file at ${where}: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!parsed || typeof parsed !== "object" || !("claudeAiOauth" in parsed)) {
    throw new Error(`Corrupt credentials file at ${where}: missing top-level claudeAiOauth`);
  }
}
