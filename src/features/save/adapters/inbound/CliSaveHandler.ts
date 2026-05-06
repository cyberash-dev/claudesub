import { parseArgs } from "node:util";
import {
  EXIT_OK,
  EXIT_RUNTIME,
  EXIT_USAGE,
  type CliExitCode,
} from "../../../../shared/domain/CliExitCode.js";
import { InvalidProfileName } from "../../../../shared/domain/ProfileName.js";
import {
  NotLoggedIn,
  ProfileAlreadyExists,
} from "../../domain/SaveOutcome.js";
import type { SaveCommand } from "../../ports/inbound/SaveCommand.js";

export class CliSaveHandler {
  constructor(private readonly command: SaveCommand) {}

  async run(args: string[]): Promise<CliExitCode> {
    const { values, positionals } = parseArgs({
      args,
      options: { overwrite: { type: "boolean", default: false } },
      allowPositionals: true,
      strict: true,
    });
    const name = positionals[0];
    if (!name) {
      process.stderr.write("Usage: claudesub save <name> [--overwrite]\n");
      return EXIT_USAGE;
    }
    try {
      const outcome = await this.command.execute({ name, overwrite: Boolean(values.overwrite) });
      const labelEmail = outcome.profile.email || "no email";
      const labelPlan = outcome.profile.subscriptionType || "unknown plan";
      process.stdout.write(`Saved profile "${outcome.profile.name}" (${labelEmail}, ${labelPlan}). Marked active.\n`);
      return EXIT_OK;
    } catch (err) {
      if (err instanceof InvalidProfileName) {
        process.stderr.write(err.message + "\n");
        return EXIT_USAGE;
      }
      if (err instanceof ProfileAlreadyExists || err instanceof NotLoggedIn) {
        process.stderr.write(err.message + "\n");
        return EXIT_RUNTIME;
      }
      throw err;
    }
  }
}
