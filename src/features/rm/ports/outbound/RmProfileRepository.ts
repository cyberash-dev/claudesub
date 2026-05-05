import type { ProfilesFile } from "../../../../shared/domain/ProfilesFile.js";

export interface RmProfileRepository {
  read(): Promise<ProfilesFile>;
  write(file: ProfilesFile): Promise<void>;
}
