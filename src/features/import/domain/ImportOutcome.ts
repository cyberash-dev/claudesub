export interface ImportOutcome {
  imported: string[];
  overwritten: string[];
  skipped: string[];
  skippedActive: string[];
}

export class BadPassphrase extends Error {
  constructor() {
    super("Wrong passphrase or corrupted file");
    this.name = "BadPassphrase";
  }
}

export class MalformedBundle extends Error {
  constructor(reason: string) {
    super(`Malformed export bundle: ${reason}`);
    this.name = "MalformedBundle";
  }
}

export class UnsupportedBundleVersion extends Error {
  constructor(public readonly observed: unknown) {
    super(`Unsupported export format (version=${String(observed)})`);
    this.name = "UnsupportedBundleVersion";
  }
}

export class AllSkippedActive extends Error {
  constructor(public readonly names: string[]) {
    super(
      `All bundle profiles match the active profile and were skipped. ` +
        `Pass --overwrite-active to replace, or run \`claudesub use <other>\` first.`,
    );
    this.name = "AllSkippedActive";
  }
}
