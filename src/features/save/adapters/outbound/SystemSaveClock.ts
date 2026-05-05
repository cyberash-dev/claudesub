import type { SaveClock } from "../../ports/outbound/SaveClock.js";

export class SystemSaveClock implements SaveClock {
  nowIso(): string {
    return new Date().toISOString();
  }
}
