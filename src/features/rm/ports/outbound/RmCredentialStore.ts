export interface RmCredentialStore {
  /** Returns true if a profile slot was deleted; false if it was already absent. */
  deleteProfile(service: string): Promise<boolean>;
}
