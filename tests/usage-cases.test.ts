import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { GetUsage } from "../src/features/usage/application/GetUsage.js";
import { CliUsageHandler } from "../src/features/usage/adapters/inbound/CliUsageHandler.js";
import {
  TokenExpiredError,
  UsageEndpointUnavailable,
  UsageEndpointUnexpectedShape,
  UsageEndpointHttpError,
} from "../src/features/usage/ports/outbound/UsageReader.js";
import {
  LiveAccessTokenMissing,
} from "../src/features/usage/ports/outbound/UsageLiveTokenReader.js";
import { FakeUsageLiveTokenReader, FakeUsageReader } from "./_fakes.js";

const FIXED_FETCHED_AT = "2026-05-06T18:00:00.000Z";

function fourBucketReport() {
  return {
    buckets: [
      { id: "five_hour" as const,        utilizationPercent: 23, resetsAt: "2026-05-06T20:14:00.000Z" },
      { id: "seven_day" as const,        utilizationPercent: 41, resetsAt: "2026-05-09T09:00:00.000Z" },
      { id: "seven_day_sonnet" as const, utilizationPercent: 28, resetsAt: "2026-05-09T09:00:00.000Z" },
      { id: "seven_day_opus" as const,   utilizationPercent: 12, resetsAt: "2026-05-09T09:00:00.000Z" },
    ],
    extra: null,
    fetchedAt: FIXED_FETCHED_AT,
  };
}

describe("BEH-011 GetUsage use case", () => {
  // @covers csm:BEH-011
  test("reads token from store and forwards to UsageReader", async () => {
    const tokenReader = new FakeUsageLiveTokenReader();
    tokenReader.token = "abc-123";
    const usageReader = new FakeUsageReader();
    usageReader.report = fourBucketReport();
    const cmd = new GetUsage(tokenReader, usageReader);

    const out = await cmd.execute();

    assert.deepEqual(usageReader.receivedTokens, ["abc-123"]);
    assert.equal(out.buckets.length, 4);
    assert.equal(out.fetchedAt, FIXED_FETCHED_AT);
  });

  // @covers csm:BEH-011
  test("propagates LiveAccessTokenMissing when the live store has no token", async () => {
    const tokenReader = new FakeUsageLiveTokenReader();
    tokenReader.token = null;
    const usageReader = new FakeUsageReader();
    const cmd = new GetUsage(tokenReader, usageReader);

    await assert.rejects(cmd.execute(), LiveAccessTokenMissing);
    assert.deepEqual(usageReader.receivedTokens, []);
  });

  // @covers csm:BEH-011
  test("propagates TokenExpiredError from the reader", async () => {
    const tokenReader = new FakeUsageLiveTokenReader();
    const usageReader = new FakeUsageReader();
    usageReader.throwOnFetch = new TokenExpiredError();
    const cmd = new GetUsage(tokenReader, usageReader);

    await assert.rejects(cmd.execute(), TokenExpiredError);
  });
});

describe("BEH-011 CliUsageHandler", () => {
  // @covers csm:BEH-011
  // @covers csm:CON-010
  // @covers csm:DELTA-006
  test("--json round-trips a UsageReport with the documented shape", async () => {
    const tokenReader = new FakeUsageLiveTokenReader();
    const usageReader = new FakeUsageReader();
    usageReader.report = fourBucketReport();
    const handler = new CliUsageHandler(new GetUsage(tokenReader, usageReader));

    const out = await captureStdout(() => handler.run(["--json"]));

    assert.equal(out.exitCode, 0);
    const parsed = JSON.parse(out.stdout);
    assert.equal(parsed.fetchedAt, FIXED_FETCHED_AT);
    assert.equal(parsed.buckets.length, 4);
    assert.deepEqual(
      parsed.buckets.map((b: { id: string }) => b.id),
      ["five_hour", "seven_day", "seven_day_sonnet", "seven_day_opus"],
    );
    assert.equal(parsed.extra, null);
  });

  // @covers csm:BEH-011
  test("default human format prints one line per bucket in the documented order", async () => {
    const tokenReader = new FakeUsageLiveTokenReader();
    const usageReader = new FakeUsageReader();
    usageReader.report = fourBucketReport();
    const handler = new CliUsageHandler(new GetUsage(tokenReader, usageReader));

    const out = await captureStdout(() => handler.run([]));

    assert.equal(out.exitCode, 0);
    const lines = out.stdout.trim().split("\n");
    assert.equal(lines.length, 4);
    assert.match(lines[0]!, /^5-hour: 23% \(/);
    assert.match(lines[1]!, /^weekly: 41% \(/);
    assert.match(lines[2]!, /^weekly Sonnet: 28% \(/);
    assert.match(lines[3]!, /^weekly Opus: 12% \(/);
  });

  // @covers csm:BEH-011
  test("renders the extra-credits line when extra is present", async () => {
    const tokenReader = new FakeUsageLiveTokenReader();
    const usageReader = new FakeUsageReader();
    usageReader.report = {
      ...fourBucketReport(),
      extra: { monthlyLimitUsdMinor: 2000, usedUsdMinor: 420 },
    };
    const handler = new CliUsageHandler(new GetUsage(tokenReader, usageReader));

    const out = await captureStdout(() => handler.run([]));

    assert.equal(out.exitCode, 0);
    assert.match(out.stdout, /extra credits: \$4\.20 \/ \$20\.00 used\n$/);
  });

  // @covers csm:BEH-011
  test("token-missing exits 1 with the documented hint and never throws", async () => {
    const tokenReader = new FakeUsageLiveTokenReader();
    tokenReader.token = null;
    const usageReader = new FakeUsageReader();
    const handler = new CliUsageHandler(new GetUsage(tokenReader, usageReader));

    const out = await captureStdout(() => handler.run([]));

    assert.equal(out.exitCode, 1);
    assert.match(out.stderr, /Live store has no claudeAiOauth\.accessToken/);
    assert.match(out.stderr, /claude auth login/);
    assert.equal(out.stdout, "");
  });

  // @covers csm:BEH-011
  test("401 exits 1 with the run-claude-once hint", async () => {
    const tokenReader = new FakeUsageLiveTokenReader();
    const usageReader = new FakeUsageReader();
    usageReader.throwOnFetch = new TokenExpiredError();
    const handler = new CliUsageHandler(new GetUsage(tokenReader, usageReader));

    const out = await captureStdout(() => handler.run([]));

    assert.equal(out.exitCode, 1);
    assert.match(out.stderr, /Live access token rejected/);
    assert.match(out.stderr, /Run `claude` once to refresh/);
  });

  // @covers csm:BEH-011
  test("network/5xx error exits 1 with the unavailable message", async () => {
    const tokenReader = new FakeUsageLiveTokenReader();
    const usageReader = new FakeUsageReader();
    usageReader.throwOnFetch = new UsageEndpointUnavailable("HTTP 502");
    const handler = new CliUsageHandler(new GetUsage(tokenReader, usageReader));

    const out = await captureStdout(() => handler.run([]));

    assert.equal(out.exitCode, 1);
    assert.match(out.stderr, /Anthropic usage endpoint unavailable: HTTP 502/);
  });

  // @covers csm:BEH-011
  test("malformed-response error exits 1 with the unexpected-shape message", async () => {
    const tokenReader = new FakeUsageLiveTokenReader();
    const usageReader = new FakeUsageReader();
    usageReader.throwOnFetch = new UsageEndpointUnexpectedShape("body is not valid JSON");
    const handler = new CliUsageHandler(new GetUsage(tokenReader, usageReader));

    const out = await captureStdout(() => handler.run([]));

    assert.equal(out.exitCode, 1);
    assert.match(out.stderr, /unexpected shape/);
    assert.match(out.stderr, /OQ-006/);
  });

  // @covers csm:BEH-011
  test("4xx (other) http error exits 1 carrying status code", async () => {
    const tokenReader = new FakeUsageLiveTokenReader();
    const usageReader = new FakeUsageReader();
    usageReader.throwOnFetch = new UsageEndpointHttpError(403, "forbidden");
    const handler = new CliUsageHandler(new GetUsage(tokenReader, usageReader));

    const out = await captureStdout(() => handler.run([]));

    assert.equal(out.exitCode, 1);
    assert.match(out.stderr, /returned 403/);
  });

  // @covers csm:BEH-011
  test("rejects unknown flag (parseArgs strict mode)", async () => {
    const tokenReader = new FakeUsageLiveTokenReader();
    const usageReader = new FakeUsageReader();
    usageReader.report = fourBucketReport();
    const handler = new CliUsageHandler(new GetUsage(tokenReader, usageReader));

    await assert.rejects(handler.run(["--bogus"]));
  });

  // @covers csm:POL-001
  // @covers csm:POL-005
  // @covers csm:POL-006
  test("bearer token never appears in stdout or stderr", async () => {
    const SECRET = "BEARER-SENTINEL-XYZZY-9001";
    const tokenReader = new FakeUsageLiveTokenReader();
    tokenReader.token = SECRET;
    const usageReader = new FakeUsageReader();
    usageReader.report = fourBucketReport();
    const handler = new CliUsageHandler(new GetUsage(tokenReader, usageReader));

    const out = await captureStdout(() => handler.run(["--json"]));

    assert.equal(out.exitCode, 0);
    assert.equal(out.stdout.includes(SECRET), false, "stdout must not contain the bearer");
    assert.equal(out.stderr.includes(SECRET), false, "stderr must not contain the bearer");
  });
});

interface CaptureResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

async function captureStdout(fn: () => Promise<number>): Promise<CaptureResult> {
  const out: string[] = [];
  const err: string[] = [];
  const origStdout = process.stdout.write.bind(process.stdout);
  const origStderr = process.stderr.write.bind(process.stderr);
  process.stdout.write = ((c: string | Uint8Array) => {
    out.push(typeof c === "string" ? c : Buffer.from(c).toString("utf8"));
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((c: string | Uint8Array) => {
    err.push(typeof c === "string" ? c : Buffer.from(c).toString("utf8"));
    return true;
  }) as typeof process.stderr.write;
  try {
    const exitCode = await fn();
    return { exitCode, stdout: out.join(""), stderr: err.join("") };
  } finally {
    process.stdout.write = origStdout;
    process.stderr.write = origStderr;
  }
}
