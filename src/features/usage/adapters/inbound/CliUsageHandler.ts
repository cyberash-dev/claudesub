import { parseArgs } from "node:util";
import { EXIT_OK, EXIT_RUNTIME, type CliExitCode } from "../../../../shared/domain/CliExitCode.js";
import type { UsageCommand } from "../../ports/inbound/UsageCommand.js";
import {
  type UsageReport,
  BUCKET_ORDER,
  BUCKET_LABEL,
} from "../../domain/UsageReport.js";
import { LiveAccessTokenMissing } from "../../ports/outbound/UsageLiveTokenReader.js";
import {
  TokenExpiredError,
  UsageEndpointUnavailable,
  UsageEndpointUnexpectedShape,
  UsageEndpointHttpError,
} from "../../ports/outbound/UsageReader.js";

export class CliUsageHandler {
  constructor(private readonly command: UsageCommand) {}

  async run(args: string[]): Promise<CliExitCode> {
    const { values } = parseArgs({
      args,
      options: { json: { type: "boolean", default: false } },
      strict: true,
    });

    let report: UsageReport;
    try {
      report = await this.command.execute();
    } catch (err) {
      if (
        err instanceof LiveAccessTokenMissing ||
        err instanceof TokenExpiredError ||
        err instanceof UsageEndpointUnavailable ||
        err instanceof UsageEndpointUnexpectedShape ||
        err instanceof UsageEndpointHttpError
      ) {
        process.stderr.write(err.message + "\n");
        return EXIT_RUNTIME;
      }
      throw err;
    }

    process.stdout.write(values.json ? renderJson(report) : renderHuman(report));
    return EXIT_OK;
  }
}

export function renderJson(report: UsageReport): string {
  return JSON.stringify(report, null, 2) + "\n";
}

export function renderHuman(report: UsageReport): string {
  const sorted = BUCKET_ORDER.flatMap((id) => {
    const found = report.buckets.find((b) => b.id === id);
    return found ? [found] : [];
  });
  if (sorted.length === 0 && report.extra === null) {
    return "No usage data returned.\n";
  }
  const lines: string[] = [];
  const now = Date.parse(report.fetchedAt);
  for (const b of sorted) {
    lines.push(`${BUCKET_LABEL[b.id]}: ${formatPercent(b.utilizationPercent)} (${formatReset(b.resetsAt, now)})`);
  }
  if (report.extra) {
    const used = formatUsd(report.extra.usedUsdMinor);
    const limit = report.extra.monthlyLimitUsdMinor !== null
      ? formatUsd(report.extra.monthlyLimitUsdMinor)
      : "—";
    lines.push(`extra credits: $${used} / $${limit} used`);
  }
  return lines.join("\n") + "\n";
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

function formatReset(resetsAt: string, now: number): string {
  const reset = Date.parse(resetsAt);
  if (!Number.isFinite(reset)) return `resets ${resetsAt}`;
  const deltaMs = reset - now;
  if (!Number.isFinite(now) || deltaMs <= 0) {
    const d = new Date(reset);
    return `resets ${weekday(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  const totalMin = Math.floor(deltaMs / 60_000);
  if (totalMin < 60 * 24) {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `resets in ${h}h${pad(m)}m`;
  }
  const d = new Date(reset);
  return `resets ${weekday(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function weekday(d: Date): string {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()] ?? "";
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatUsd(minor: number): string {
  const major = Math.floor(minor / 100);
  const cents = minor % 100;
  return `${major}.${pad(cents)}`;
}
