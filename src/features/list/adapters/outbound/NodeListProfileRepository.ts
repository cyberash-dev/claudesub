import { readFile } from "node:fs/promises";
import {
  emptyProfilesFile,
  UnsupportedProfilesFileVersion,
  type ProfilesFile,
} from "../../../../shared/domain/ProfilesFile.js";
import type { ListProfileRepository } from "../../ports/outbound/ListProfileRepository.js";

export class NodeListProfileRepository implements ListProfileRepository {
  constructor(private readonly profilesPath: string) {}

  async read(): Promise<ProfilesFile> {
    let raw: string;
    try {
      raw = await readFile(this.profilesPath, "utf8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return emptyProfilesFile();
      }
      throw err;
    }
    const parsed = JSON.parse(raw) as ProfilesFile;
    if (parsed.version !== 1 || !Array.isArray(parsed.profiles)) {
      throw new UnsupportedProfilesFileVersion(parsed.version);
    }
    return parsed;
  }
}
