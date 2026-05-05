import { readActive, readProfiles } from "../store.js";

export interface ListOptions {
  json: boolean;
}

export async function runList(opts: ListOptions): Promise<number> {
  const file = await readProfiles();
  const active = await readActive();

  if (opts.json) {
    process.stdout.write(JSON.stringify({
      active,
      profiles: file.profiles.map((p) => ({
        name: p.name,
        email: p.email,
        orgName: p.orgName,
        subscriptionType: p.subscriptionType,
        active: p.name === active,
        lastUsedAt: p.lastUsedAt,
      })),
    }, null, 2) + "\n");
    return 0;
  }

  if (file.profiles.length === 0) {
    process.stdout.write("No profiles saved yet. Run `claude-sub save <name>` while logged in.\n");
    return 0;
  }

  const rows = file.profiles.map((p) => ({
    mark: p.name === active ? "*" : " ",
    name: p.name,
    email: p.email || "-",
    org: p.orgName || "-",
    sub: p.subscriptionType || "-",
  }));
  const widths = {
    name: Math.max(4, ...rows.map((r) => r.name.length)),
    email: Math.max(5, ...rows.map((r) => r.email.length)),
    org: Math.max(3, ...rows.map((r) => r.org.length)),
    sub: Math.max(4, ...rows.map((r) => r.sub.length)),
  };
  const header = `  ${"NAME".padEnd(widths.name)}  ${"EMAIL".padEnd(widths.email)}  ${"ORG".padEnd(widths.org)}  ${"PLAN".padEnd(widths.sub)}`;
  process.stdout.write(header + "\n");
  for (const r of rows) {
    process.stdout.write(`${r.mark} ${r.name.padEnd(widths.name)}  ${r.email.padEnd(widths.email)}  ${r.org.padEnd(widths.org)}  ${r.sub.padEnd(widths.sub)}\n`);
  }
  return 0;
}
