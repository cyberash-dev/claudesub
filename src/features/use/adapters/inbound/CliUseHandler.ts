import { parseArgs } from "node:util";
import {
  EXIT_OK,
  EXIT_RUNTIME,
  EXIT_USAGE,
  type CliExitCode,
} from "../../../../shared/domain/CliExitCode.js";
import {
  AuthVerificationFailed,
  ClaudeIsRunning,
  UnknownProfile,
} from "../../domain/SwitchOutcome.js";
import type { UseCommand } from "../../ports/inbound/UseCommand.js";

export class CliUseHandler {
  constructor(private readonly command: UseCommand) {}

  async run(args: string[]): Promise<CliExitCode> {
    const { values, positionals } = parseArgs({
      args,
      options: {
        force: { type: "boolean", default: false },
        "no-verify": { type: "boolean", default: false },
      },
      allowPositionals: true,
      strict: true,
    });
    const name = positionals[0];
    if (!name) {
      process.stderr.write("Usage: claudesub use <name> [--force] [--no-verify]\n");
      return EXIT_USAGE;
    }
    try {
      const outcome = await this.command.execute({
        name,
        force: Boolean(values.force),
        noVerify: Boolean(values["no-verify"]),
      });
      process.stdout.write(`Switched to "${outcome.target.name}" (${outcome.target.email || "no email"}).\n`);
      if (outcome.authVerificationSummary) {
        process.stdout.write(`claude auth status: ${outcome.authVerificationSummary}\n`);
      }
      return EXIT_OK;
    } catch (err) {
      if (err instanceof UnknownProfile) {
        process.stderr.write(err.message + "\n");
        return EXIT_RUNTIME;
      }
      if (err instanceof ClaudeIsRunning) {
        process.stderr.write(err.message + "\n");
        for (const r of err.processes) {
          process.stderr.write(`  pid=${r.pid}  ${r.command}\n`);
        }
        process.stderr.write("Quit those sessions and retry, or pass --force.\n");
        return EXIT_RUNTIME;
      }
      if (err instanceof AuthVerificationFailed) {
        process.stderr.write(err.message + "\n");
        return EXIT_RUNTIME;
      }
      throw err;
    }
  }
}
