import type { AddOutcome } from "../../domain/AddOutcome.js";

export interface AddCommandInput {
  name: string;
}

export interface AddCommand {
  execute(input: AddCommandInput): Promise<AddOutcome>;
}
