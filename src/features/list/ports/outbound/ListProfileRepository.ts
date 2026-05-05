import type { ProfilesFile } from "../../../../shared/domain/ProfilesFile.js";

export interface ListProfileRepository {
  read(): Promise<ProfilesFile>;
}
