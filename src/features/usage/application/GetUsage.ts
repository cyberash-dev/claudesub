import type { UsageCommand } from "../ports/inbound/UsageCommand.js";
import type { UsageLiveTokenReader } from "../ports/outbound/UsageLiveTokenReader.js";
import type { UsageReader } from "../ports/outbound/UsageReader.js";
import type { UsageReport } from "../domain/UsageReport.js";

export class GetUsage implements UsageCommand {
  constructor(
    private readonly tokenReader: UsageLiveTokenReader,
    private readonly usageReader: UsageReader,
  ) {}

  async execute(): Promise<UsageReport> {
    const token = await this.tokenReader.readAccessToken();
    return await this.usageReader.fetch(token);
  }
}
