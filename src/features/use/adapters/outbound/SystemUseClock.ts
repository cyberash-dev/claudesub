import type { UseClock } from "../../ports/outbound/UseClock.js";

export class SystemUseClock implements UseClock {
  nowIso(): string {
    return new Date().toISOString();
  }
}
