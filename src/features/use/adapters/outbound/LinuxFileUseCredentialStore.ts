import { mkdir, readFile, rename, writeFile, chmod, stat, open } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import type { UseCredentialStore } from "../../ports/outbound/UseCredentialStore.js";
import { serviceToProfileFileName } from "../../../../shared/domain/LinuxSlotMapping.js";

const LOCK_TIMEOUT_MS = 5_000;
const LOCK_POLL_MS = 50;

export class LinuxFileUseCredentialStore implements UseCredentialStore {
  constructor(
    private readonly liveCredentialsPath: string,
    private readonly slotDir: string,
  ) {}

  async readLive(): Promise<string> {
    return await readCredsFile(this.liveCredentialsPath, "live");
  }

  async writeLive(blob: string): Promise<void> {
    assertCredentialsShape(blob, "<live blob>");
    const lockPath = `${this.liveCredentialsPath}.csm.lock`;
    await acquireLock(lockPath, LOCK_TIMEOUT_MS);
    try {
      let mode = 0o600;
      try {
        mode = (await stat(this.liveCredentialsPath)).mode & 0o777;
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      }
      const tmp = `${this.liveCredentialsPath}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
      await writeFile(tmp, blob, { mode });
      await rename(tmp, this.liveCredentialsPath);
    } finally {
      await releaseLock(lockPath);
    }
  }

  async readProfile(service: string): Promise<string> {
    const path = join(this.slotDir, serviceToProfileFileName(service));
    return await readCredsFile(path, `slot "${service}"`);
  }

  async writeProfile(service: string, blob: string): Promise<void> {
    assertCredentialsShape(blob, `<slot ${service}>`);
    await mkdir(this.slotDir, { recursive: true, mode: 0o700 });
    await chmod(this.slotDir, 0o700).catch(() => {});
    const path = join(this.slotDir, serviceToProfileFileName(service));
    const tmp = `${path}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
    await writeFile(tmp, blob, { mode: 0o600 });
    await rename(tmp, path);
  }
}

async function readCredsFile(path: string, kind: string): Promise<string> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Credentials file for ${kind} not found at ${path}`);
    }
    throw err;
  }
  assertCredentialsShape(raw, path);
  return raw;
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

async function acquireLock(lockPath: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const handle = await open(lockPath, "wx");
      await handle.close();
      return;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
      if (Date.now() >= deadline) {
        throw new Error(`Failed to acquire ${lockPath} within ${timeoutMs}ms`);
      }
      await new Promise((resolve) => setTimeout(resolve, LOCK_POLL_MS));
    }
  }
}

async function releaseLock(lockPath: string): Promise<void> {
  const { unlink } = await import("node:fs/promises");
  await unlink(lockPath).catch(() => {});
}
