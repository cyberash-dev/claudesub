import { spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { runSave } from "./save.js";
import { isValidProfileName } from "../store.js";

export interface AddOptions {
  name: string;
}

export async function runAdd(opts: AddOptions): Promise<number> {
  if (!isValidProfileName(opts.name)) {
    process.stderr.write(`Invalid profile name: "${opts.name}".\n`);
    return 2;
  }

  process.stdout.write(`Adding profile "${opts.name}". This will:\n`);
  process.stdout.write("  1) log out of the currently active Claude account\n");
  process.stdout.write("  2) ask you to run `claude auth login` interactively (browser will open)\n");
  process.stdout.write(`  3) snapshot the new credentials into profile "${opts.name}"\n\n`);

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const proceed = (await rl.question("Continue? [y/N]: ")).trim().toLowerCase();
  if (proceed !== "y" && proceed !== "yes") {
    rl.close();
    process.stderr.write("Aborted.\n");
    return 1;
  }

  const logoutCode = await runForeground("claude", ["auth", "logout"]);
  if (logoutCode !== 0) {
    rl.close();
    process.stderr.write(`claude auth logout exited with code ${logoutCode}. Aborting.\n`);
    return 1;
  }

  process.stdout.write("\nNow run `claude auth login` in another terminal (or press Enter to launch it here interactively).\n");
  await rl.question("When the new account is logged in, press Enter to snapshot it: ");
  rl.close();

  return runSave({ name: opts.name, overwrite: true });
}

function runForeground(cmd: string, args: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? -1));
  });
}
