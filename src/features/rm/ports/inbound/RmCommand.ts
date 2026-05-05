import type { RmOutcome } from "../../domain/RmOutcome.js";

export interface RmCommandInput {
  name: string;
  skipConfirmation: boolean;
}

export interface RmCommand {
  execute(input: RmCommandInput): Promise<RmOutcome>;
}
