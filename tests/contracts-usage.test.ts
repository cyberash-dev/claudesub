import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  renderHuman,
  renderJson,
} from "../src/features/usage/adapters/inbound/CliUsageHandler.js";
import {
  type UsageReport,
  BUCKET_ORDER,
} from "../src/features/usage/domain/UsageReport.js";

describe("CON-010 schema invariants", () => {
  // @covers csm:CON-010
  test("--json output parses, validates against the documented schema", () => {
    const report: UsageReport = {
      buckets: [
        { id: "five_hour",        utilizationPercent: 23, resetsAt: "2026-05-06T20:14:00.000Z" },
        { id: "seven_day",        utilizationPercent: 41, resetsAt: "2026-05-09T09:00:00.000Z" },
        { id: "seven_day_sonnet", utilizationPercent: 28, resetsAt: "2026-05-09T09:00:00.000Z" },
        { id: "seven_day_opus",   utilizationPercent: 12, resetsAt: "2026-05-09T09:00:00.000Z" },
      ],
      extra: { monthlyLimitUsdMinor: 2000, usedUsdMinor: 420 },
      fetchedAt: "2026-05-06T18:00:00.000Z",
    };

    const json = renderJson(report);
    const parsed = JSON.parse(json);

    assert.equal(typeof parsed.fetchedAt, "string");
    assert.ok(Array.isArray(parsed.buckets));
    for (const b of parsed.buckets) {
      assert.ok(BUCKET_ORDER.includes(b.id), `bucket id "${b.id}" not in enum`);
      assert.equal(typeof b.utilizationPercent, "number");
      assert.ok(b.utilizationPercent >= 0 && b.utilizationPercent <= 100);
      assert.equal(typeof b.resetsAt, "string");
    }
    assert.equal(typeof parsed.extra.monthlyLimitUsdMinor, "number");
    assert.equal(typeof parsed.extra.usedUsdMinor, "number");
  });

  // @covers csm:CON-010
  test("--json output ends with a single LF terminator", () => {
    const report: UsageReport = {
      buckets: [],
      extra: null,
      fetchedAt: "2026-05-06T18:00:00.000Z",
    };
    const json = renderJson(report);
    assert.ok(json.endsWith("\n"));
    assert.equal(json.endsWith("\n\n"), false);
  });
});

describe("BEH-011 human renderer", () => {
  // @covers csm:BEH-011
  test("preserves the documented bucket order regardless of input order", () => {
    const report: UsageReport = {
      buckets: [
        { id: "seven_day_opus",   utilizationPercent: 12, resetsAt: "2026-05-09T09:00:00.000Z" },
        { id: "five_hour",        utilizationPercent: 23, resetsAt: "2026-05-06T20:14:00.000Z" },
        { id: "seven_day_sonnet", utilizationPercent: 28, resetsAt: "2026-05-09T09:00:00.000Z" },
        { id: "seven_day",        utilizationPercent: 41, resetsAt: "2026-05-09T09:00:00.000Z" },
      ],
      extra: null,
      fetchedAt: "2026-05-06T18:00:00.000Z",
    };
    const out = renderHuman(report);
    const lines = out.trim().split("\n");
    assert.match(lines[0]!, /^5-hour:/);
    assert.match(lines[1]!, /^weekly:/);
    assert.match(lines[2]!, /^weekly Sonnet:/);
    assert.match(lines[3]!, /^weekly Opus:/);
  });

  // @covers csm:BEH-011
  test("renders 'resets in <H>h<MM>m' for resets within 24h", () => {
    const report: UsageReport = {
      buckets: [
        { id: "five_hour", utilizationPercent: 50, resetsAt: "2026-05-06T20:14:00.000Z" },
      ],
      extra: null,
      fetchedAt: "2026-05-06T18:00:00.000Z",
    };
    const out = renderHuman(report);
    assert.match(out, /resets in 2h14m/);
  });

  // @covers csm:BEH-011
  test("renders 'resets <Day> <HH:MM>' for resets beyond 24h", () => {
    const report: UsageReport = {
      buckets: [
        { id: "seven_day", utilizationPercent: 50, resetsAt: "2026-05-11T09:30:00.000Z" },
      ],
      extra: null,
      fetchedAt: "2026-05-06T18:00:00.000Z",
    };
    const out = renderHuman(report);
    assert.match(out, /resets [A-Z][a-z]{2} \d{2}:\d{2}/);
  });

  // @covers csm:BEH-011
  test("rounds utilizationPercent to nearest integer", () => {
    const report: UsageReport = {
      buckets: [
        { id: "five_hour", utilizationPercent: 23.6, resetsAt: "2026-05-06T20:14:00.000Z" },
      ],
      extra: null,
      fetchedAt: "2026-05-06T18:00:00.000Z",
    };
    const out = renderHuman(report);
    assert.match(out, /^5-hour: 24%/);
  });

  // @covers csm:BEH-011
  test("omits the extra-credits line when extra is null", () => {
    const report: UsageReport = {
      buckets: [
        { id: "five_hour", utilizationPercent: 1, resetsAt: "2026-05-06T20:14:00.000Z" },
      ],
      extra: null,
      fetchedAt: "2026-05-06T18:00:00.000Z",
    };
    const out = renderHuman(report);
    assert.equal(out.includes("extra credits"), false);
  });

  // @covers csm:BEH-011
  test("renders the extra-credits line in dollars from minor units", () => {
    const report: UsageReport = {
      buckets: [],
      extra: { monthlyLimitUsdMinor: 2000, usedUsdMinor: 420 },
      fetchedAt: "2026-05-06T18:00:00.000Z",
    };
    const out = renderHuman(report);
    assert.match(out, /extra credits: \$4\.20 \/ \$20\.00 used/);
  });

  // @covers csm:BEH-011
  test("extra block with monthlyLimit=null renders the limit as em-dash", () => {
    const report: UsageReport = {
      buckets: [],
      extra: { monthlyLimitUsdMinor: null, usedUsdMinor: 75 },
      fetchedAt: "2026-05-06T18:00:00.000Z",
    };
    const out = renderHuman(report);
    assert.match(out, /extra credits: \$0\.75 \/ \$— used/);
  });
});
