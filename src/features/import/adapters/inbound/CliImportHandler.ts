import { parseArgs } from "node:util";
import {
  EXIT_OK,
  EXIT_RUNTIME,
  EXIT_USAGE,
  type CliExitCode,
} from "../../../../shared/domain/CliExitCode.js";
import { InvalidProfileName } from "../../../../shared/domain/ProfileName.js";
import {
  AllSkippedActive,
  BadPassphrase,
  MalformedBundle,
  UnsupportedBundleVersion,
} from "../../domain/ImportOutcome.js";
import type { ImportConflictPolicy } from "../../domain/ImportConflictPolicy.js";
import type { ImportCommand } from "../../ports/inbound/ImportCommand.js";

export class CliImportHandler {
  constructor(private readonly command: ImportCommand) {}

  async run(args: string[]): Promise<CliExitCode> {
    const { values, positionals } = parseArgs({
      args,
      options: {
        overwrite: { type: "boolean", default: false },
        "overwrite-active": { type: "boolean", default: false },
      },
      allowPositionals: true,
      strict: true,
    });
    const file = positionals[0];
    if (!file) {
      process.stderr.write("Usage: claude-sub import <file> [--overwrite] [--overwrite-active]\n");
      return EXIT_USAGE;
    }

    const policy: ImportConflictPolicy = values["overwrite-active"]
      ? "overwriteIncludingActive"
      : values.overwrite
        ? "overwriteAll"
        : "skipExisting";

    try {
      const outcome = await this.command.execute({ file, policy });
      const summary =
        `imported: ${outcome.imported.length}, ` +
        `overwritten: ${outcome.overwritten.length}, ` +
        `skipped: ${outcome.skipped.length}, ` +
        `skipped-active: ${outcome.skippedActive.length}`;
      for (const name of outcome.imported) {
        process.stdout.write(`imported "${name}"\n`);
      }
      for (const name of outcome.overwritten) {
        process.stdout.write(`overwrote "${name}"\n`);
      }
      for (const name of outcome.skipped) {
        process.stdout.write(`skipped "${name}" (already exists; pass --overwrite to replace)\n`);
      }
      for (const name of outcome.skippedActive) {
        process.stderr.write(
          `Profile "${name}" is currently active; pass --overwrite-active to replace its keychain entry. ` +
            `Otherwise run \`claude-sub use <other>\` first, then re-import.\n`,
        );
      }
      process.stdout.write(summary + "\n");
      return EXIT_OK;
    } catch (err) {
      if (
        err instanceof BadPassphrase ||
        err instanceof MalformedBundle ||
        err instanceof UnsupportedBundleVersion ||
        err instanceof InvalidProfileName ||
        err instanceof AllSkippedActive
      ) {
        process.stderr.write(err.message + "\n");
        return EXIT_RUNTIME;
      }
      throw err;
    }
  }
}
