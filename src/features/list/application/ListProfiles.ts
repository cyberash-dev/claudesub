import type { ListCommand } from "../ports/inbound/ListCommand.js";
import type { ListProfileRepository } from "../ports/outbound/ListProfileRepository.js";
import type { ListActiveMarker } from "../ports/outbound/ListActiveMarker.js";
import type { ListReport } from "../domain/ListReport.js";

export class ListProfiles implements ListCommand {
  constructor(
    private readonly repo: ListProfileRepository,
    private readonly marker: ListActiveMarker,
  ) {}

  async execute(): Promise<ListReport> {
    const file = await this.repo.read();
    const active = await this.marker.read();
    const rows = file.profiles
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((metadata) => ({ metadata, isActive: metadata.name === active }));
    return { active, rows };
  }
}
