import { parseArgs } from "node:util";
import {
  EXIT_OK,
  EXIT_RUNTIME,
  EXIT_USAGE,
  type CliExitCode,
} from "../../../../shared/domain/CliExitCode.js";
import { InvalidProfileName } from "../../../../shared/domain/ProfileName.js";
import {
  RenameSourceMissing,
  RenameTargetExists,
} from "../../domain/RenameOutcome.js";
import type { RenameCommand } from "../../ports/inbound/RenameCommand.js";

export class CliRenameHandler {
  constructor(private readonly command: RenameCommand) {}

  async run(args: string[]): Promise<CliExitCode> {
    const { positionals } = parseArgs({
      args,
      allowPositionals: true,
      strict: true,
      options: {},
    });
    const [oldName, newName] = positionals;
    if (!oldName || !newName) {
      process.stderr.write("Usage: claudesub rename <old> <new>\n");
      return EXIT_USAGE;
    }
    try {
      const outcome = await this.command.execute({ oldName, newName });
      process.stdout.write(`Renamed "${outcome.oldName}" → "${outcome.newName}".\n`);
      return EXIT_OK;
    } catch (err) {
      if (err instanceof InvalidProfileName) {
        process.stderr.write(err.message + "\n");
        return EXIT_USAGE;
      }
      if (err instanceof RenameSourceMissing || err instanceof RenameTargetExists) {
        process.stderr.write(err.message + "\n");
        return EXIT_RUNTIME;
      }
      throw err;
    }
  }
}
