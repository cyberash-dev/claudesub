#!/usr/bin/env node
import { parseArgs } from "node:util";
import { runList } from "./commands/list.js";
import { runSave } from "./commands/save.js";
import { runUse } from "./commands/use.js";
import { runRm } from "./commands/rm.js";
import { runRename } from "./commands/rename.js";
import { runStatus } from "./commands/status.js";
import { runAdd } from "./commands/add.js";

const HELP = `claude-sub — switch between Claude Code OAuth subscriptions on macOS.

Usage:
  claude-sub list [--json]
  claude-sub status [--json]
  claude-sub save <name> [--overwrite]
  claude-sub use <name> [--force] [--no-verify]
  claude-sub rename <old> <new>
  claude-sub rm <name> [--yes]
  claude-sub add <name>
  claude-sub --help | --version

Profiles are stored as macOS Keychain items (service "Claude Code-credentials.profile.<name>")
plus non-secret metadata in ~/.claude-subscription-manager/profiles.json.
The active profile is recorded in ~/.claude-subscription-manager/active.

Notes:
  - "use" auto-snapshots the currently active profile first to capture rotated refresh tokens.
  - "use" refuses if any "claude" process is running (override with --force).
  - Token blobs are passed to /usr/bin/security via argv; they are briefly visible in \`ps\` for the calling user only.
`;

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;

  if (!command || command === "--help" || command === "-h" || command === "help") {
    process.stdout.write(HELP);
    return 0;
  }
  if (command === "--version" || command === "-v") {
    process.stdout.write("claude-sub 0.1.0\n");
    return 0;
  }

  switch (command) {
    case "list": {
      const { values } = parseArgs({ args: rest, options: { json: { type: "boolean", default: false } }, strict: true });
      return runList({ json: Boolean(values.json) });
    }
    case "status": {
      const { values } = parseArgs({ args: rest, options: { json: { type: "boolean", default: false } }, strict: true });
      return runStatus({ json: Boolean(values.json) });
    }
    case "save": {
      const { values, positionals } = parseArgs({
        args: rest,
        options: { overwrite: { type: "boolean", default: false } },
        allowPositionals: true,
        strict: true,
      });
      const name = positionals[0];
      if (!name) { process.stderr.write("Usage: claude-sub save <name> [--overwrite]\n"); return 2; }
      return runSave({ name, overwrite: Boolean(values.overwrite) });
    }
    case "use": {
      const { values, positionals } = parseArgs({
        args: rest,
        options: {
          force: { type: "boolean", default: false },
          "no-verify": { type: "boolean", default: false },
        },
        allowPositionals: true,
        strict: true,
      });
      const name = positionals[0];
      if (!name) { process.stderr.write("Usage: claude-sub use <name> [--force] [--no-verify]\n"); return 2; }
      return runUse({ name, force: Boolean(values.force), noVerify: Boolean(values["no-verify"]) });
    }
    case "rm":
    case "remove":
    case "delete": {
      const { values, positionals } = parseArgs({
        args: rest,
        options: { yes: { type: "boolean", short: "y", default: false } },
        allowPositionals: true,
        strict: true,
      });
      const name = positionals[0];
      if (!name) { process.stderr.write("Usage: claude-sub rm <name> [--yes]\n"); return 2; }
      return runRm({ name, yes: Boolean(values.yes) });
    }
    case "rename":
    case "mv": {
      const { positionals } = parseArgs({ args: rest, allowPositionals: true, strict: true, options: {} });
      const [oldName, newName] = positionals;
      if (!oldName || !newName) { process.stderr.write("Usage: claude-sub rename <old> <new>\n"); return 2; }
      return runRename({ oldName, newName });
    }
    case "add": {
      const { positionals } = parseArgs({ args: rest, allowPositionals: true, strict: true, options: {} });
      const name = positionals[0];
      if (!name) { process.stderr.write("Usage: claude-sub add <name>\n"); return 2; }
      return runAdd({ name });
    }
    default: {
      process.stderr.write(`Unknown command: ${command}\n\n${HELP}`);
      return 2;
    }
  }
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err) => {
    process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  },
);
