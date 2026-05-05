export interface RmOutcome {
  removedName: string;
  keychainSlotWasMissing: boolean;
  liveActiveCleared: boolean;
}

export class UnknownProfile extends Error {
  constructor(public readonly profileName: string) {
    super(`Unknown profile "${profileName}".`);
    this.name = "UnknownProfile";
  }
}

export class RmAborted extends Error {
  constructor() {
    super("Aborted.");
    this.name = "RmAborted";
  }
}
