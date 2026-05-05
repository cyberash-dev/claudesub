import type { ProfilesFile } from "../../../../shared/domain/ProfilesFile.js";

export interface SaveProfileRepository {
  read(): Promise<ProfilesFile>;
  write(file: ProfilesFile): Promise<void>;
}
