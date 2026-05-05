export interface AddOutcome {
  name: string;
}

export class AddDeclined extends Error {
  constructor() {
    super("Aborted.");
    this.name = "AddDeclined";
  }
}

export class LogoutFailed extends Error {
  constructor(public readonly exitCode: number) {
    super(`claude auth logout exited with code ${exitCode}. Aborting.`);
    this.name = "LogoutFailed";
  }
}
