import type { ProfilesFile } from "../../../../shared/domain/ProfilesFile.js";

export interface ExportProfileRepository {
  read(): Promise<ProfilesFile>;
}
