import { spawn } from "node:child_process";
import type {
  UseAuthVerifier,
  UseAuthVerifierResult,
} from "../../ports/outbound/UseAuthVerifier.js";

interface AuthStatusPayload {
  loggedIn?: boolean;
  email?: string;
  subscriptionType?: string;
}

export class ChildProcessUseAuthVerifier implements UseAuthVerifier {
  verify(): Promise<UseAuthVerifierResult> {
    return new Promise((resolve) => {
      const child = spawn("claude", ["auth", "status", "--json"], {
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (c: Buffer) => { stdout += c.toString("utf8"); });
      child.stderr.on("data", (c: Buffer) => { stderr += c.toString("utf8"); });
      child.on("error", (err) => resolve({ ok: false, summary: `cannot exec claude: ${err.message}` }));
      child.on("close", (code) => {
        if (code !== 0) {
          resolve({ ok: false, summary: `exit ${code}: ${stderr.trim() || stdout.trim()}` });
          return;
        }
        try {
          const parsed = JSON.parse(stdout) as AuthStatusPayload;
          if (!parsed.loggedIn) {
            resolve({ ok: false, summary: "loggedIn=false" });
            return;
          }
          resolve({ ok: true, summary: `loggedIn as ${parsed.email ?? "?"} (${parsed.subscriptionType ?? "?"})` });
        } catch (err) {
          resolve({ ok: false, summary: `cannot parse: ${(err as Error).message}` });
        }
      });
    });
  }
}
