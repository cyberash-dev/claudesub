import type { StatusReport } from "../../domain/StatusReport.js";

export interface StatusCommand {
  execute(): Promise<StatusReport>;
}
