import type { SaveOutcome } from "../../domain/SaveOutcome.js";

export interface SaveCommandInput {
  name: string;
  overwrite: boolean;
}

export interface SaveCommand {
  execute(input: SaveCommandInput): Promise<SaveOutcome>;
}
