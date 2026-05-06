import type { ExportOutcome } from "../../domain/ExportOutcome.js";

export interface ExportCommandInput {
  file: string;
}

export interface ExportCommand {
  execute(input: ExportCommandInput): Promise<ExportOutcome>;
}
