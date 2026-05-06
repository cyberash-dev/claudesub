import type { ExportClock } from "../../ports/outbound/ExportClock.js";

export class SystemExportClock implements ExportClock {
  nowIso(): string {
    return new Date().toISOString();
  }
}
