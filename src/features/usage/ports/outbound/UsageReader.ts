import type { UsageReport } from "../../domain/UsageReport.js";

export interface UsageReader {
  fetch(accessToken: string): Promise<UsageReport>;
}

export class TokenExpiredError extends Error {
  constructor() {
    super("Live access token rejected. Run `claude` once to refresh, then retry.");
    this.name = "TokenExpiredError";
  }
}

export class UsageEndpointUnavailable extends Error {
  constructor(reason: string) {
    super(`Anthropic usage endpoint unavailable: ${reason}`);
    this.name = "UsageEndpointUnavailable";
  }
}

export class UsageEndpointUnexpectedShape extends Error {
  constructor(detail: string) {
    super(`Anthropic usage endpoint returned an unexpected shape — see csm:OQ-006 (${detail})`);
    this.name = "UsageEndpointUnexpectedShape";
  }
}

export class UsageEndpointHttpError extends Error {
  constructor(public readonly status: number, body: string) {
    super(`Anthropic usage endpoint returned ${status}: ${body}`);
    this.name = "UsageEndpointHttpError";
  }
}
