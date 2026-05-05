import type { ProfilesFile } from "../../../../shared/domain/ProfilesFile.js";

export interface StatusProfileRepository {
  read(): Promise<ProfilesFile>;
}
