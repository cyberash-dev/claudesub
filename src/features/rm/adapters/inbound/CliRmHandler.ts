import { parseArgs } from "node:util";
import {
  EXIT_OK,
  EXIT_RUNTIME,
  EXIT_USAGE,
  type CliExitCode,
} from "../../../../shared/domain/CliExitCode.js";
import { LIVE_KEYCHAIN_SERVICE } from "../../../../shared/domain/ServiceNames.js";
import { RmAborted, UnknownProfile } from "../../domain/RmOutcome.js";
import type { RmCommand } from "../../ports/inbound/RmCommand.js";

export class CliRmHandler {
  constructor(private readonly command: RmCommand) {}

  async run(args: string[]): Promise<CliExitCode> {
    const { values, positionals } = parseArgs({
      args,
      options: { yes: { type: "boolean", short: "y", default: false } },
      allowPositionals: true,
      strict: true,
    });
    const name = positionals[0];
    if (!name) {
      process.stderr.write("Usage: claude-sub rm <name> [--yes]\n");
      return EXIT_USAGE;
    }
    try {
      const outcome = await this.command.execute({ name, skipConfirmation: Boolean(values.yes) });
      if (outcome.keychainSlotWasMissing) {
        process.stderr.write(`Warning: keychain entry for "${outcome.removedName}" was already missing.\n`);
      }
      if (outcome.liveActiveCleared) {
        process.stdout.write(`Removed "${outcome.removedName}". Note: live keychain (${LIVE_KEYCHAIN_SERVICE}) was NOT touched.\n`);
      } else {
        process.stdout.write(`Removed "${outcome.removedName}".\n`);
      }
      return EXIT_OK;
    } catch (err) {
      if (err instanceof UnknownProfile || err instanceof RmAborted) {
        process.stderr.write(err.message + "\n");
        return EXIT_RUNTIME;
      }
      throw err;
    }
  }
}
