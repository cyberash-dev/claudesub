import { ProfileName } from "../../../shared/domain/ProfileName.js";
import type { AddCommand, AddCommandInput } from "../ports/inbound/AddCommand.js";
import type { AddLogout } from "../ports/outbound/AddLogout.js";
import type { AddPrompt } from "../ports/outbound/AddPrompt.js";
import type { AddSnapshotter } from "../ports/outbound/AddSnapshotter.js";
import {
  AddDeclined,
  LogoutFailed,
  type AddOutcome,
} from "../domain/AddOutcome.js";

export class AddProfile implements AddCommand {
  constructor(
    private readonly logout: AddLogout,
    private readonly prompt: AddPrompt,
    private readonly snapshotter: AddSnapshotter,
  ) {}

  async execute(input: AddCommandInput): Promise<AddOutcome> {
    const name = ProfileName.parse(input.name);
    await this.prompt.printPlan(name.value);
    const proceed = await this.prompt.askYesNo("Continue? [y/N]: ");
    if (!proceed) throw new AddDeclined();

    const code = await this.logout.run();
    if (code !== 0) throw new LogoutFailed(code);

    await this.prompt.waitForEnter(
      "When the new account is logged in (run `claude auth login` interactively), press Enter to snapshot it: ",
    );
    await this.snapshotter.snapshot(name.value);
    return { name: name.value };
  }
}
