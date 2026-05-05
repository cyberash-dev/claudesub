import type { ProfileMetadata } from "../../../shared/domain/ProfileMetadata.js";

export interface ListRow {
  metadata: ProfileMetadata;
  isActive: boolean;
}

export interface ListReport {
  active: string | null;
  rows: ListRow[];
}
