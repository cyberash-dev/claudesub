export interface RmConfirmer {
  /** Asks the user to type back the profile name; returns true on exact match. */
  confirmName(name: string): Promise<boolean>;
}
