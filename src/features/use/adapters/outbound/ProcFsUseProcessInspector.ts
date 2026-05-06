import { readdir, readFile } from "node:fs/promises";
import { basename } from "node:path";
import type {
  RunningClaudeProcess,
  UseProcessInspector,
} from "../../ports/outbound/UseProcessInspector.js";

const CLAUDE_RX = /(^|\/)(claude|Claude\.app)\b/;

export class ProcFsUseProcessInspector implements UseProcessInspector {
  constructor(private readonly procRoot: string = "/proc") {}

  async findRunning(): Promise<RunningClaudeProcess[]> {
    let entries: string[];
    try {
      entries = await readdir(this.procRoot);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error(`Linux procfs not mounted at ${this.procRoot}`);
      }
      throw err;
    }
    const self = process.pid;
    const out: RunningClaudeProcess[] = [];
    for (const name of entries) {
      const pid = Number.parseInt(name, 10);
      if (!Number.isFinite(pid) || pid <= 0 || pid === self) continue;
      let raw: Buffer;
      try {
        raw = await readFile(`${this.procRoot}/${name}/cmdline`);
      } catch {
        continue;
      }
      const argv = raw.toString("utf8").replace(/\0+$/, "").split("\0");
      const command = argv.join(" ").trim();
      if (!command) continue;
      if (!CLAUDE_RX.test(command)) continue;
      if (/(^|\/)claudesub(\s|$)/.test(command)) continue;
      if (/node\b.*claudesub/.test(command)) continue;
      const head = argv[0] ?? command;
      out.push({ pid, command: basename(head) || head });
    }
    return out;
  }
}
