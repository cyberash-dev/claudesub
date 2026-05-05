import { spawn } from "node:child_process";
import type {
  RunningClaudeProcess,
  UseProcessInspector,
} from "../../ports/outbound/UseProcessInspector.js";

interface PgrepResult {
  code: number;
  stdout: string;
  stderr: string;
}

function runPgrep(args: string[]): Promise<PgrepResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("/usr/bin/pgrep", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c: Buffer) => { stdout += c.toString("utf8"); });
    child.stderr.on("data", (c: Buffer) => { stderr += c.toString("utf8"); });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? -1, stdout, stderr }));
  });
}

export class ChildProcessUseProcessInspector implements UseProcessInspector {
  async findRunning(): Promise<RunningClaudeProcess[]> {
    const res = await runPgrep(["-lf", "(^|/)(claude|Claude\\.app)"]);
    if (res.code === 1) return [];
    if (res.code !== 0) {
      throw new Error(`pgrep failed (exit ${res.code}): ${res.stderr.trim()}`);
    }
    const self = process.pid;
    const out: RunningClaudeProcess[] = [];
    for (const line of res.stdout.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const space = trimmed.indexOf(" ");
      if (space < 0) continue;
      const pid = Number.parseInt(trimmed.slice(0, space), 10);
      const command = trimmed.slice(space + 1);
      if (!Number.isFinite(pid) || pid === self) continue;
      if (/(^|\/)claude-sub(\s|$)/.test(command)) continue;
      if (/node\b.*claude-sub/.test(command)) continue;
      out.push({ pid, command: command.split(" ")[0] ?? command });
    }
    return out;
  }
}
