import { parseArgs } from "node:util";
import { EXIT_OK, type CliExitCode } from "../../../../shared/domain/CliExitCode.js";
import type { ListCommand } from "../../ports/inbound/ListCommand.js";
import type { ListReport } from "../../domain/ListReport.js";

export class CliListHandler {
  constructor(private readonly command: ListCommand) {}

  async run(args: string[]): Promise<CliExitCode> {
    const { values } = parseArgs({
      args,
      options: { json: { type: "boolean", default: false } },
      strict: true,
    });
    const report = await this.command.execute();
    process.stdout.write(values.json ? renderJson(report) : renderHuman(report));
    return EXIT_OK;
  }
}

function renderJson(report: ListReport): string {
  return JSON.stringify({
    active: report.active,
    profiles: report.rows.map((r) => ({
      name: r.metadata.name,
      email: r.metadata.email,
      orgName: r.metadata.orgName,
      subscriptionType: r.metadata.subscriptionType,
      active: r.isActive,
      lastUsedAt: r.metadata.lastUsedAt,
    })),
  }, null, 2) + "\n";
}

function renderHuman(report: ListReport): string {
  if (report.rows.length === 0) {
    return "No profiles saved yet. Run `claude-sub save <name>` while logged in.\n";
  }
  const cells = report.rows.map((r) => ({
    mark: r.isActive ? "*" : " ",
    name: r.metadata.name,
    email: r.metadata.email || "-",
    org: r.metadata.orgName || "-",
    sub: r.metadata.subscriptionType || "-",
  }));
  const widths = {
    name: Math.max(4, ...cells.map((c) => c.name.length)),
    email: Math.max(5, ...cells.map((c) => c.email.length)),
    org: Math.max(3, ...cells.map((c) => c.org.length)),
    sub: Math.max(4, ...cells.map((c) => c.sub.length)),
  };
  const lines: string[] = [
    `  ${"NAME".padEnd(widths.name)}  ${"EMAIL".padEnd(widths.email)}  ${"ORG".padEnd(widths.org)}  ${"PLAN".padEnd(widths.sub)}`,
  ];
  for (const c of cells) {
    lines.push(`${c.mark} ${c.name.padEnd(widths.name)}  ${c.email.padEnd(widths.email)}  ${c.org.padEnd(widths.org)}  ${c.sub.padEnd(widths.sub)}`);
  }
  return lines.join("\n") + "\n";
}
