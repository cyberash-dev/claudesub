import type { UsageReport } from "../../domain/UsageReport.js";

export interface UsageCommand {
  execute(): Promise<UsageReport>;
}
