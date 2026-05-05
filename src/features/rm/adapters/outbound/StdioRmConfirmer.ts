import { createInterface } from "node:readline/promises";
import type { RmConfirmer } from "../../ports/outbound/RmConfirmer.js";

export class StdioRmConfirmer implements RmConfirmer {
  async confirmName(name: string): Promise<boolean> {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
      const answer = (await rl.question(`Delete profile "${name}"? Type the name to confirm: `)).trim();
      return answer === name;
    } finally {
      rl.close();
    }
  }
}
