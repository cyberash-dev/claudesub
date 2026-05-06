import { spawn } from "node:child_process";
import type {
  RunningClaudeProcess,
  UseProcessInspector,
} from "../../ports/outbound/UseProcessInspector.js";

interface TaskResult {
  code: number;
  stdout: string;
  stderr: string;
}

function runTasklist(args: string[]): Promise<TaskResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("tasklist.exe", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c: Buffer) => { stdout += c.toString("utf8"); });
    child.stderr.on("data", (c: Buffer) => { stderr += c.toString("utf8"); });
    child.on("error", (err) => {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        reject(new Error("tasklist.exe not found on PATH."));
      } else {
        reject(err);
      }
    });
    child.on("close", (code) => resolve({ code: code ?? -1, stdout, stderr }));
  });
}

export class WindowsTasklistUseProcessInspector implements UseProcessInspector {
  async findRunning(): Promise<RunningClaudeProcess[]> {
    const res = await runTasklist(["/FO", "CSV", "/NH", "/V"]);
    if (res.code !== 0) {
      throw new Error(`tasklist failed (exit ${res.code}): ${res.stderr.trim()}`);
    }
    const self = process.pid;
    const out: RunningClaudeProcess[] = [];
    for (const line of res.stdout.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const cols = parseCsvRow(line);
      const image = (cols[0] ?? "").toLowerCase();
      const pidStr = cols[1] ?? "";
      const title = cols[cols.length - 1] ?? "";
      const pid = Number.parseInt(pidStr, 10);
      if (!Number.isFinite(pid) || pid === self) continue;
      const matchesImage = image.startsWith("claude") && !image.startsWith("claudesub");
      const matchesTitle = /\bclaude\b/i.test(title) && !/\bclaudesub\b/i.test(title);
      if (!matchesImage && !matchesTitle) continue;
      out.push({ pid, command: cols[0] ?? title });
    }
    return out;
  }
}

function parseCsvRow(line: string): string[] {
  const cols: string[] = [];
  let buf = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { buf += '"'; i++; }
        else { inQuotes = false; }
      } else {
        buf += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cols.push(buf);
      buf = "";
    } else {
      buf += ch;
    }
  }
  cols.push(buf);
  return cols;
}
