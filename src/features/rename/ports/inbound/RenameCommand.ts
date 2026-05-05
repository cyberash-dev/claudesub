import type { RenameOutcome } from "../../domain/RenameOutcome.js";

export interface RenameCommandInput {
  oldName: string;
  newName: string;
}

export interface RenameCommand {
  execute(input: RenameCommandInput): Promise<RenameOutcome>;
}
