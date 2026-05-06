import type { ImportConflictPolicy } from "../../domain/ImportConflictPolicy.js";
import type { ImportOutcome } from "../../domain/ImportOutcome.js";

export interface ImportCommandInput {
  file: string;
  policy: ImportConflictPolicy;
}

export interface ImportCommand {
  execute(input: ImportCommandInput): Promise<ImportOutcome>;
}
