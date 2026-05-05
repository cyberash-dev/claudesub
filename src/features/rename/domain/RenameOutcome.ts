export interface RenameOutcome {
  oldName: string;
  newName: string;
  activeMarkerUpdated: boolean;
}

export class RenameTargetExists extends Error {
  constructor(public readonly newName: string) {
    super(`Profile "${newName}" already exists.`);
    this.name = "RenameTargetExists";
  }
}

export class RenameSourceMissing extends Error {
  constructor(public readonly oldName: string) {
    super(`Unknown profile "${oldName}".`);
    this.name = "RenameSourceMissing";
  }
}
