import { PassphraseMismatch } from "../../domain/ExportOutcome.js";
import type { ExportPassphrasePrompt } from "../../ports/outbound/ExportPassphrasePrompt.js";

const ETX = String.fromCharCode(0x03);
const DEL = String.fromCharCode(0x7f);
const BS = String.fromCharCode(0x08);

function readHidden(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    process.stdout.write(prompt);
    const stdin = process.stdin;
    if (typeof stdin.setRawMode !== "function") {
      reject(new Error("stdin does not support raw mode; cannot read passphrase securely"));
      return;
    }
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    let buf = "";
    const onData = (chunk: string): void => {
      for (const ch of chunk) {
        if (ch === ETX) {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener("data", onData);
          process.stdout.write("\n");
          reject(new Error("Aborted"));
          return;
        }
        if (ch === "\r" || ch === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener("data", onData);
          process.stdout.write("\n");
          resolve(buf);
          return;
        }
        if (ch === DEL || ch === BS) {
          buf = buf.slice(0, -1);
          continue;
        }
        buf += ch;
      }
    };
    stdin.on("data", onData);
  });
}

export class StdioExportPassphrasePrompt implements ExportPassphrasePrompt {
  async promptNew(): Promise<string> {
    const first = await readHidden("Passphrase: ");
    const second = await readHidden("Confirm passphrase: ");
    if (first !== second) {
      throw new PassphraseMismatch();
    }
    return first;
  }
}
