import type { ProfilesFile } from "../../../../shared/domain/ProfilesFile.js";

export interface ImportProfileRepository {
  read(): Promise<ProfilesFile>;
  write(file: ProfilesFile): Promise<void>;
}
