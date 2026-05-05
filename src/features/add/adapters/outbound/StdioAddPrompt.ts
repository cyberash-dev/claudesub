import { createInterface } from "node:readline/promises";
import type { AddPrompt } from "../../ports/outbound/AddPrompt.js";

export class StdioAddPrompt implements AddPrompt {
  async printPlan(name: string): Promise<void> {
    process.stdout.write(`Adding profile "${name}". This will:\n`);
    process.stdout.write("  1) log out of the currently active Claude account\n");
    process.stdout.write("  2) ask you to run `claude auth login` interactively (browser will open)\n");
    process.stdout.write(`  3) snapshot the new credentials into profile "${name}"\n\n`);
  }

  async askYesNo(question: string): Promise<boolean> {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
      const answer = (await rl.question(question)).trim().toLowerCase();
      return answer === "y" || answer === "yes";
    } finally {
      rl.close();
    }
  }

  async waitForEnter(question: string): Promise<void> {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
      await rl.question(question);
    } finally {
      rl.close();
    }
  }
}
