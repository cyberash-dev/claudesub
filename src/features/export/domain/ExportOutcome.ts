export interface ExportOutcome {
  filePath: string;
  profileCount: number;
  exportedAt: string;
}

export class PassphraseMismatch extends Error {
  constructor() {
    super("Passphrases did not match");
    this.name = "PassphraseMismatch";
  }
}

export class NoProfilesToExport extends Error {
  constructor() {
    super("No profiles to export");
    this.name = "NoProfilesToExport";
  }
}

export class MissingProfileBlob extends Error {
  constructor(public readonly profileName: string) {
    super(`Keychain entry for profile "${profileName}" not found.`);
    this.name = "MissingProfileBlob";
  }
}
