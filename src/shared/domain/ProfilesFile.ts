import type { ProfileMetadata } from "./ProfileMetadata.js";

export interface ProfilesFile {
  version: 1;
  profiles: ProfileMetadata[];
}

export function emptyProfilesFile(): ProfilesFile {
  return { version: 1, profiles: [] };
}

export function findProfile(file: ProfilesFile, name: string): ProfileMetadata | undefined {
  return file.profiles.find((p) => p.name === name);
}

export function upsertProfile(file: ProfilesFile, profile: ProfileMetadata): ProfilesFile {
  const next = file.profiles.filter((p) => p.name !== profile.name);
  next.push(profile);
  next.sort((a, b) => a.name.localeCompare(b.name));
  return { version: 1, profiles: next };
}

export function removeProfile(file: ProfilesFile, name: string): ProfilesFile {
  return { version: 1, profiles: file.profiles.filter((p) => p.name !== name) };
}

export class UnsupportedProfilesFileVersion extends Error {
  constructor(public readonly observed: unknown) {
    super(`profiles.json has unsupported shape (version=${String(observed)})`);
    this.name = "UnsupportedProfilesFileVersion";
  }
}
