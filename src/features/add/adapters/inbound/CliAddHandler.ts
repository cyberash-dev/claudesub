import { parseArgs } from "node:util";
import {
  EXIT_OK,
  EXIT_RUNTIME,
  EXIT_USAGE,
  type CliExitCode,
} from "../../../../shared/domain/CliExitCode.js";
import { InvalidProfileName } from "../../../../shared/domain/ProfileName.js";
import { AddDeclined, LogoutFailed } from "../../domain/AddOutcome.js";
import type { AddCommand } from "../../ports/inbound/AddCommand.js";

export class CliAddHandler {
  constructor(private readonly command: AddCommand) {}

  async run(args: string[]): Promise<CliExitCode> {
    const { positionals } = parseArgs({
      args,
      allowPositionals: true,
      strict: true,
      options: {},
    });
    const name = positionals[0];
    if (!name) {
      process.stderr.write("Usage: claudesub add <name>\n");
      return EXIT_USAGE;
    }
    try {
      await this.command.execute({ name });
      return EXIT_OK;
    } catch (err) {
      if (err instanceof InvalidProfileName) {
        process.stderr.write(err.message + "\n");
        return EXIT_USAGE;
      }
      if (err instanceof AddDeclined || err instanceof LogoutFailed) {
        process.stderr.write(err.message + "\n");
        return EXIT_RUNTIME;
      }
      throw err;
    }
  }
}
