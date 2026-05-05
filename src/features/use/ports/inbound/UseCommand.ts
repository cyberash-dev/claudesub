import type { SwitchOutcome } from "../../domain/SwitchOutcome.js";

export interface UseCommandInput {
  name: string;
  force: boolean;
  noVerify: boolean;
}

export interface UseCommand {
  execute(input: UseCommandInput): Promise<SwitchOutcome>;
}
