import { mkdir, readFile, writeFile, rename, chmod } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import {
  emptyProfilesFile,
  UnsupportedProfilesFileVersion,
  type ProfilesFile,
} from "../../../../shared/domain/ProfilesFile.js";
import type { ImportProfileRepository } from "../../ports/outbound/ImportProfileRepository.js";

export class NodeImportProfileRepository implements ImportProfileRepository {
  constructor(
    private readonly stateDir: string,
    private readonly profilesPath: string,
  ) {}

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

  async write(file: ProfilesFile): Promise<void> {
    await mkdir(this.stateDir, { recursive: true, mode: 0o700 });
    await chmod(this.stateDir, 0o700).catch(() => {});
    const tmp = `${this.profilesPath}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
    await writeFile(tmp, JSON.stringify(file, null, 2), { mode: 0o600 });
    await rename(tmp, this.profilesPath);
  }
}
