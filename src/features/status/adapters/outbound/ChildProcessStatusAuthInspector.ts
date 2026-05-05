import { spawn } from "node:child_process";
import type {
  StatusAuthInspector,
  StatusAuthInspectorResult,
} from "../../ports/outbound/StatusAuthInspector.js";

export class ChildProcessStatusAuthInspector implements StatusAuthInspector {
  fetch(): Promise<StatusAuthInspectorResult> {
    return new Promise((resolve) => {
      const child = spawn("claude", ["auth", "status", "--json"], {
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (c: Buffer) => { stdout += c.toString("utf8"); });
      child.stderr.on("data", (c: Buffer) => { stderr += c.toString("utf8"); });
      child.on("error", (err) => resolve({ error: `cannot exec claude: ${err.message}` }));
      child.on("close", (code) => {
        if (code !== 0) {
          resolve({ error: `exit ${code}: ${stderr.trim() || stdout.trim()}` });
          return;
        }
        try {
          resolve(JSON.parse(stdout) as StatusAuthInspectorResult);
        } catch (err) {
          resolve({ error: `parse failed: ${(err as Error).message}`, raw: stdout });
        }
      });
    });
  }
}
