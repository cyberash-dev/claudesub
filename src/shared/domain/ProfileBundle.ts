import type { ProfileMetadata } from "./ProfileMetadata.js";

export interface ProfileBundle {
  version: 1;
  exportedAt: string;
  profiles: ProfileMetadata[];
  keychainBlobs: Record<string, string>;
}
