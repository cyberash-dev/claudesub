import { request } from "node:https";
import {
  type UsageReader,
  TokenExpiredError,
  UsageEndpointHttpError,
  UsageEndpointUnavailable,
  UsageEndpointUnexpectedShape,
} from "../../ports/outbound/UsageReader.js";
import {
  type UsageReport,
  type UsageBucket,
  type ExtraUsageBucket,
  BUCKET_ORDER,
} from "../../domain/UsageReport.js";

const USAGE_URL = "https://api.anthropic.com/api/oauth/usage";
const BETA_HEADER = "oauth-2025-04-20";
const TIMEOUT_MS = 10_000;
const USER_AGENT = "claudesub/0.1.0";

interface HttpResponse {
  status: number;
  body: string;
}

export class HttpsAnthropicUsageReader implements UsageReader {
  async fetch(accessToken: string): Promise<UsageReport> {
    const res = await this.send(accessToken);
    if (res.status === 200) return parseResponse(res.body);
    if (res.status === 401) throw new TokenExpiredError();
    if (res.status >= 500) throw new UsageEndpointUnavailable(`HTTP ${res.status}`);
    throw new UsageEndpointHttpError(res.status, redactBearer(res.body));
  }

  private send(accessToken: string): Promise<HttpResponse> {
    return new Promise((resolve, reject) => {
      const url = new URL(USAGE_URL);
      const req = request(
        {
          method: "GET",
          hostname: url.hostname,
          path: url.pathname,
          headers: {
            authorization: `Bearer ${accessToken}`,
            "anthropic-beta": BETA_HEADER,
            accept: "application/json",
            "user-agent": USER_AGENT,
          },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c: Buffer) => chunks.push(c));
          res.on("end", () =>
            resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }),
          );
          res.on("error", (err) => reject(new UsageEndpointUnavailable(err.message)));
        },
      );
      req.on("error", (err) => {
        if ((err as NodeJS.ErrnoException).name === "AbortError") {
          reject(new UsageEndpointUnavailable(`timeout after ${TIMEOUT_MS}ms`));
        } else {
          reject(new UsageEndpointUnavailable(err.message));
        }
      });
      req.end();
    });
  }
}

function parseResponse(body: string): UsageReport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new UsageEndpointUnexpectedShape("body is not valid JSON");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new UsageEndpointUnexpectedShape("body is not a JSON object");
  }
  const root = parsed as Record<string, unknown>;
  const buckets: UsageBucket[] = [];
  for (const id of BUCKET_ORDER) {
    const node = root[id];
    if (!isBucketNode(node)) continue;
    const utilization = clampPercent(toNumber(node["utilization"]));
    const resetsAt = typeof node["resets_at"] === "string" ? node["resets_at"] : null;
    if (utilization === null || resetsAt === null) continue;
    buckets.push({ id, utilizationPercent: utilization, resetsAt });
  }
  return {
    buckets,
    extra: parseExtra(root["extra_usage"]),
    fetchedAt: new Date().toISOString(),
  };
}

function isBucketNode(node: unknown): node is Record<string, unknown> {
  return !!node && typeof node === "object" && !Array.isArray(node);
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function clampPercent(value: number | null): number | null {
  if (value === null) return null;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

function parseExtra(node: unknown): ExtraUsageBucket | null {
  if (!isBucketNode(node)) return null;
  const limit = toNumber(node["monthly_limit"]);
  const usedRaw = toNumber(node["used_credits"]);
  const used = usedRaw === null ? 0 : Math.max(0, Math.round(usedRaw));
  if (limit === null && used === 0) return null;
  return {
    monthlyLimitUsdMinor: limit === null ? null : Math.max(0, Math.round(limit)),
    usedUsdMinor: used,
  };
}

function redactBearer(body: string): string {
  return body.replace(/Bearer\s+\S+/gi, "Bearer <redacted>");
}
