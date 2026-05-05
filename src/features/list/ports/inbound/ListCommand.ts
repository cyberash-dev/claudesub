import type { ListReport } from "../../domain/ListReport.js";

export interface ListCommand {
  execute(): Promise<ListReport>;
}
