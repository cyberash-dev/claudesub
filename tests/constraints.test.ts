import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..");
const SRC = join(REPO_ROOT, "src");

interface PackageJson {
  engines?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  type?: string;
}

async function readPackageJson(): Promise<PackageJson> {
  return JSON.parse(await readFile(join(REPO_ROOT, "package.json"), "utf8")) as PackageJson;
}

describe("CST-001 macOS-only", () => {
  // @covers csm:CST-001
  test("source code spawns /usr/bin/security and /usr/bin/pgrep (macOS-pinned absolute paths)", async () => {
    const securityHits: string[] = [];
    const pgrepHits: string[] = [];
    for (const file of await walk(SRC)) {
      const code = await readFile(file, "utf8");
      if (code.includes("/usr/bin/security")) securityHits.push(file);
      if (code.includes("/usr/bin/pgrep")) pgrepHits.push(file);
    }
    assert.ok(securityHits.length > 0, "no /usr/bin/security mentions found in src");
    assert.ok(pgrepHits.length > 0, "no /usr/bin/pgrep mentions found in src");
  });
});

describe("CST-002 Node >= 18.17", () => {
  // @covers csm:CST-002
  test("package.json#engines.node equals '>=18.17'", async () => {
    const pkg = await readPackageJson();
    assert.equal(pkg.engines?.node, ">=18.17");
  });
});

describe("CST-003 zero runtime dependencies", () => {
  // @covers csm:CST-003
  test("package.json#dependencies is absent or empty", async () => {
    const pkg = await readPackageJson();
    const deps = pkg.dependencies ?? {};
    assert.equal(Object.keys(deps).length, 0, `unexpected runtime deps: ${JSON.stringify(deps)}`);
  });

  // @covers csm:CST-003
  test("devDependencies is a subset of {typescript, @types/node}", async () => {
    const pkg = await readPackageJson();
    const allowed = new Set(["typescript", "@types/node"]);
    const dev = pkg.devDependencies ?? {};
    for (const name of Object.keys(dev)) {
      assert.ok(allowed.has(name), `unexpected devDependency "${name}"`);
    }
  });
});

describe("CST-004 Vertical Slice + Hexagonal layout", () => {
  // @covers csm:CST-004
  test("src/ has exactly cli.ts at the top + features/ + shared/ (no global layer folders)", async () => {
    const entries = await readdir(SRC, { withFileTypes: true });
    const names = entries.map((e) => e.name).sort();
    assert.deepEqual(names, ["cli.ts", "features", "shared"]);
    for (const e of entries) {
      if (e.isFile()) assert.equal(e.name, "cli.ts");
    }
  });

  // @covers csm:CST-004
  test("each slice under src/features/<name>/ has the canonical sub-tree", async () => {
    const expectedSlices = ["add", "export", "import", "list", "rename", "rm", "save", "status", "usage", "use"];
    const expectedSub = ["adapters", "application", "domain", "ports"];
    const slices = (await readdir(join(SRC, "features"), { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
    assert.deepEqual(slices, expectedSlices);

    for (const slice of slices) {
      const sub = (await readdir(join(SRC, "features", slice), { withFileTypes: true }))
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort();
      for (const required of expectedSub) {
        assert.ok(sub.includes(required), `slice ${slice} is missing sub-folder ${required}`);
      }
      for (const direction of ["inbound", "outbound"]) {
        const ports = (await readdir(join(SRC, "features", slice, "ports", direction), { withFileTypes: true })).map((e) => e.name);
        assert.ok(ports.length > 0, `slice ${slice} has no ports/${direction}/`);
        const adapters = (await readdir(join(SRC, "features", slice, "adapters", direction), { withFileTypes: true })).map((e) => e.name);
        assert.ok(adapters.length > 0, `slice ${slice} has no adapters/${direction}/`);
      }
    }
  });

  // @covers csm:CST-004
  test("no slice imports another slice's internals", async () => {
    const slices = (await readdir(join(SRC, "features"), { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
    for (const slice of slices) {
      const files = await walk(join(SRC, "features", slice));
      for (const file of files) {
        if (!file.endsWith(".ts")) continue;
        const code = await readFile(file, "utf8");
        for (const otherSlice of slices) {
          if (otherSlice === slice) continue;
          const forbiddenImport = `features/${otherSlice}/`;
          assert.equal(
            code.includes(forbiddenImport), false,
            `${file} imports from another slice (${otherSlice})`,
          );
        }
      }
    }
  });

  // @covers csm:CST-004
  test("shared/ holds only domain primitives (no slice use cases or adapters)", async () => {
    const sharedRoot = join(SRC, "shared");
    const dirs = (await readdir(sharedRoot, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);
    for (const d of dirs) {
      assert.equal(d, "domain", `unexpected non-domain folder in shared/: ${d}`);
    }
  });
});

async function walk(dir: string, acc: string[] = []): Promise<string[]> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, acc);
    else acc.push(full);
  }
  return acc;
}
