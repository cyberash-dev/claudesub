import type { ProfileMetadata } from "../../../shared/domain/ProfileMetadata.js";
import type { RunningClaudeProcess } from "../ports/outbound/UseProcessInspector.js";

export interface SwitchOutcome {
  target: ProfileMetadata;
  authVerificationSummary: string | null;
}

export class UnknownProfile extends Error {
  constructor(public readonly profileName: string) {
    super(`Unknown profile "${profileName}". Run \`claudesub list\` to see available profiles.`);
    this.name = "UnknownProfile";
  }
}

export class ClaudeIsRunning extends Error {
  constructor(public readonly processes: RunningClaudeProcess[]) {
    super("Refusing to switch: claude is currently running.");
    this.name = "ClaudeIsRunning";
  }
}

export class AuthVerificationFailed extends Error {
  constructor(public readonly summary: string) {
    super(`claude auth status check failed: ${summary}`);
    this.name = "AuthVerificationFailed";
  }
}
