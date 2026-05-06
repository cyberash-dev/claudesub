import { readFile } from "node:fs/promises";
import type { ImportFileReader } from "../../ports/outbound/ImportFileReader.js";

export class NodeImportFileReader implements ImportFileReader {
  async read(path: string): Promise<Uint8Array> {
    return readFile(path);
  }
}
