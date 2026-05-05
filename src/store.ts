import { mkdir, readFile, writeFile, rename, chmod, unlink } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { activePath, profilesPath, stateDir } from "./paths.js";
import type { ProfileMetadata, ProfilesFile } from "./types.js";

async function ensureStateDir(): Promise<void> {
  await mkdir(stateDir, { recursive: true, mode: 0o700 });
  await chmod(stateDir, 0o700).catch(() => {});
}

export async function readProfiles(): Promise<ProfilesFile> {
  try {
    const raw = await readFile(profilesPath, "utf8");
    const parsed = JSON.parse(raw) as ProfilesFile;
    if (parsed.version !== 1 || !Array.isArray(parsed.profiles)) {
      throw new Error(`profiles.json has unsupported shape (version=${parsed.version})`);
    }
    return parsed;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { version: 1, profiles: [] };
    }
    throw err;
  }
}

export async function writeProfiles(file: ProfilesFile): Promise<void> {
  await ensureStateDir();
  const tmp = `${profilesPath}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
  await writeFile(tmp, JSON.stringify(file, null, 2), { mode: 0o600 });
  await rename(tmp, profilesPath);
}

export async function readActive(): Promise<string | null> {
  try {
    const raw = await readFile(activePath, "utf8");
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function writeActive(name: string | null): Promise<void> {
  await ensureStateDir();
  if (name === null) {
    await unlink(activePath).catch((err: NodeJS.ErrnoException) => {
      if (err.code !== "ENOENT") throw err;
    });
    return;
  }
  const tmp = `${activePath}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
  await writeFile(tmp, name, { mode: 0o600 });
  await rename(tmp, activePath);
}

export function findProfile(file: ProfilesFile, name: string): ProfileMetadata | undefined {
  return file.profiles.find((p) => p.name === name);
}

export function upsertProfile(file: ProfilesFile, profile: ProfileMetadata): ProfilesFile {
  const next = file.profiles.filter((p) => p.name !== profile.name);
  next.push(profile);
  next.sort((a, b) => a.name.localeCompare(b.name));
  return { ...file, profiles: next };
}

export function removeProfile(file: ProfilesFile, name: string): ProfilesFile {
  return { ...file, profiles: file.profiles.filter((p) => p.name !== name) };
}

export function isValidProfileName(name: string): boolean {
  return /^[a-zA-Z0-9._-]{1,64}$/.test(name);
}

export { ensureStateDir };
