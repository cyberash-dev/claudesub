import { parseArgs } from "node:util";
import {
  EXIT_OK,
  EXIT_RUNTIME,
  EXIT_USAGE,
  type CliExitCode,
} from "../../../../shared/domain/CliExitCode.js";
import {
  MissingProfileBlob,
  NoProfilesToExport,
  PassphraseMismatch,
} from "../../domain/ExportOutcome.js";
import type { ExportCommand } from "../../ports/inbound/ExportCommand.js";

export class CliExportHandler {
  constructor(private readonly command: ExportCommand) {}

  async run(args: string[]): Promise<CliExitCode> {
    const { positionals } = parseArgs({
      args,
      options: {},
      allowPositionals: true,
      strict: true,
    });
    const file = positionals[0];
    if (!file) {
      process.stderr.write("Usage: claudesub export <file>\n");
      return EXIT_USAGE;
    }
    try {
      const outcome = await this.command.execute({ file });
      process.stdout.write(`Exported ${outcome.profileCount} profile(s) to ${outcome.filePath}\n`);
      return EXIT_OK;
    } catch (err) {
      if (
        err instanceof NoProfilesToExport ||
        err instanceof PassphraseMismatch ||
        err instanceof MissingProfileBlob
      ) {
        process.stderr.write(err.message + "\n");
        return EXIT_RUNTIME;
      }
      throw err;
    }
  }
}
