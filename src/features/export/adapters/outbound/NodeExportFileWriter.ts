import { writeFile, rename } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import type { ExportFileWriter } from "../../ports/outbound/ExportFileWriter.js";

export class NodeExportFileWriter implements ExportFileWriter {
  async write(path: string, bytes: Uint8Array): Promise<void> {
    const tmp = `${path}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
    await writeFile(tmp, bytes, { mode: 0o600 });
    await rename(tmp, path);
  }
}
