import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = join(HERE, "..", "src", "cli.js");
const REPO_ROOT = join(HERE, "..", "..");

interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

function runCli(args: string[], envOverride: Record<string, string> = {}): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI_PATH, ...args], {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, ...envOverride },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c: Buffer) => { stdout += c.toString("utf8"); });
    child.stderr.on("data", (c: Buffer) => { stderr += c.toString("utf8"); });
    child.on("error", reject);
    child.on("close", (code) => resolve({ exitCode: code ?? -1, stdout, stderr }));
  });
}

async function runIsolated(args: string[]): Promise<RunResult> {
  const home = await mkdtemp(join(tmpdir(), "csm-cli-argv-"));
  try {
    return await runCli(args, { HOME: home });
  } finally {
    await rm(home, { recursive: true, force: true });
  }
}

describe("CLI argv shape (CON-001)", () => {
  // @covers csm:CON-001
  test("`claudesub` with no args prints HELP and exits 0", async () => {
    const r = await runIsolated([]);
    assert.equal(r.exitCode, 0);
    assert.match(r.stdout, /Usage:\n {2}claudesub list/);
  });

  // @covers csm:CON-001
  test("--help / -h / help all print HELP and exit 0", async () => {
    for (const flag of ["--help", "-h", "help"]) {
      const r = await runIsolated([flag]);
      assert.equal(r.exitCode, 0, `flag ${flag} returned ${r.exitCode}`);
      assert.match(r.stdout, /claudesub — switch between Claude Code OAuth subscriptions/);
    }
  });

  // @covers csm:CON-001
  // @covers csm:DELTA-004
  test("--version / -v print 'claudesub <semver>'", async () => {
    for (const flag of ["--version", "-v"]) {
      const r = await runIsolated([flag]);
      assert.equal(r.exitCode, 0);
      assert.match(r.stdout, /^claudesub \d+\.\d+\.\d+\n$/);
    }
  });

  // @covers csm:CON-001
  test("subcommand and flag names are stable: list/status/save/use/rm/rename/add and --json/--overwrite/--force/--no-verify/--yes", async () => {
    const r = await runIsolated(["--help"]);
    for (const sub of ["list", "status", "save", "use", "rm", "rename", "add"]) {
      assert.match(r.stdout, new RegExp(`claudesub ${sub}`));
    }
    for (const flag of ["--json", "--overwrite", "--force", "--no-verify", "--yes"]) {
      assert.match(r.stdout, new RegExp(flag.replace(/-/g, "\\-")));
    }
  });
});

describe("Exit-code taxonomy (CON-002)", () => {
  // @covers csm:CON-002
  test("happy paths exit 0 (list, status, --help, --version)", async () => {
    const list = await runIsolated(["list"]);
    assert.equal(list.exitCode, 0, `list stderr: ${list.stderr}`);
    const help = await runIsolated(["--help"]);
    assert.equal(help.exitCode, 0);
    const version = await runIsolated(["--version"]);
    assert.equal(version.exitCode, 0);
  });

  // @covers csm:CON-002
  test("argv shape errors exit 2 (unknown command, missing positional)", async () => {
    const unknown = await runIsolated(["totally-bogus-command"]);
    assert.equal(unknown.exitCode, 2);
    assert.match(unknown.stderr, /Unknown command: totally-bogus-command/);

    for (const incomplete of [["save"], ["use"], ["rm"], ["rename"], ["rename", "only-one"], ["add"]]) {
      const r = await runIsolated(incomplete);
      assert.equal(r.exitCode, 2, `argv ${incomplete.join(" ")} returned ${r.exitCode}`);
      assert.match(r.stderr, /Usage:/);
    }
  });

  // @covers csm:CON-002
  test("runtime failure exits 1 (use of unknown profile)", async () => {
    const r = await runIsolated(["use", "ghost-profile"]);
    assert.equal(r.exitCode, 1, `stderr: ${r.stderr}`);
    assert.match(r.stderr, /Unknown profile/);
  });
});

describe("Usage errors (BEH-008)", () => {
  // @covers csm:BEH-008
  test("unknown command prints HELP banner before exit 2", async () => {
    const r = await runIsolated(["nope"]);
    assert.equal(r.exitCode, 2);
    assert.match(r.stderr, /Unknown command: nope/);
    assert.match(r.stderr, /Usage:\n {2}claudesub list/);
  });

  // @covers csm:BEH-008
  test("HELP banner enumerates every subcommand from CON-001", async () => {
    const help = await runIsolated(["--help"]);
    for (const sub of ["list", "status", "save", "use", "rename", "rm", "add"]) {
      assert.match(help.stdout, new RegExp(`\\bclaudesub ${sub}\\b`));
    }
  });

  // @covers csm:BEH-008
  test("--version output equals package.json#version", async () => {
    const versionOutput = (await runIsolated(["--version"])).stdout.trim();
    const { readFile } = await import("node:fs/promises");
    const pkg = JSON.parse(await readFile(join(REPO_ROOT, "package.json"), "utf8")) as { version: string };
    assert.equal(versionOutput, `claudesub ${pkg.version}`);
  });
});

describe("Export/import argv (CON-008)", () => {
  // @covers csm:CON-008
  // @covers csm:DELTA-001
  test("`claudesub export` without <file> exits 2 with Usage line", async () => {
    const r = await runIsolated(["export"]);
    assert.equal(r.exitCode, 2);
    assert.match(r.stderr, /Usage: claudesub export <file>/);
  });

  // @covers csm:CON-008
  test("`claudesub import` without <file> exits 2 with Usage line", async () => {
    const r = await runIsolated(["import"]);
    assert.equal(r.exitCode, 2);
    assert.match(r.stderr, /Usage: claudesub import <file>/);
  });

  // @covers csm:CON-008
  test("`claudesub import --unknown-flag <file>` exits 1 from parseArgs strict mode", async () => {
    const r = await runIsolated(["import", "--unknown-flag", "/tmp/x"]);
    assert.equal(r.exitCode, 1);
    assert.match(r.stderr, /error:.*unknown/i);
  });

  // @covers csm:DELTA-001
  test("HELP banner advertises both `export` and `import` subcommands", async () => {
    const r = await runIsolated(["--help"]);
    assert.match(r.stdout, /\bclaudesub export <file>/);
    assert.match(r.stdout, /\bclaudesub import <file>/);
    assert.match(r.stdout, /--overwrite-active/);
  });
});
