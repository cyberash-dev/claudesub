import { parseArgs } from "node:util";
import { EXIT_OK, type CliExitCode } from "../../../../shared/domain/CliExitCode.js";
import type { StatusCommand } from "../../ports/inbound/StatusCommand.js";
import type { StatusReport } from "../../domain/StatusReport.js";

export class CliStatusHandler {
  constructor(private readonly command: StatusCommand) {}

  async run(args: string[]): Promise<CliExitCode> {
    const { values } = parseArgs({
      args,
      options: { json: { type: "boolean", default: false } },
      strict: true,
    });
    const report = await this.command.execute();
    process.stdout.write(values.json ? renderJson(report) : renderHuman(report));
    if (report.desyncReason && !values.json) {
      process.stdout.write(`WARNING: ${report.desyncReason}\n`);
    }
    return EXIT_OK;
  }
}

function renderJson(report: StatusReport): string {
  return JSON.stringify({
    active: report.active,
    profileKnown: report.profileKnown,
    claudeJson: report.claudeJson,
    desynced: report.desyncReason ? { reason: report.desyncReason } : null,
    authStatus: report.authStatus,
  }, null, 2) + "\n";
}

function renderHuman(report: StatusReport): string {
  const lines: string[] = [];
  if (report.active) {
    const suffix = report.profileKnown ? "" : " (not in profiles.json — desynced)";
    lines.push(`Active profile: ${report.active}${suffix}`);
  } else {
    lines.push("Active profile: <none recorded>");
  }
  const auth = report.authStatus;
  if (auth.error) {
    lines.push(`claude auth status: error — ${auth.error}`);
  } else {
    lines.push(`claude auth status: loggedIn=${auth.loggedIn ?? false} email=${auth.email ?? "?"} plan=${auth.subscriptionType ?? "?"}`);
  }
  return lines.join("\n") + "\n";
}
