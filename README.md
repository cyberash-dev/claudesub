# claudesub

Switch between Claude Code OAuth subscriptions on macOS without `claude auth logout`/`login` each time.

## What it does

Claude Code keeps the active subscription in two places:

1. **OAuth tokens** — macOS Keychain, generic-password, service `Claude Code-credentials`, account `$USER`.
2. **Account metadata** — `~/.claude.json`: top-level `userID` and the `oauthAccount` block (`emailAddress`, `accountUuid`, `organizationName`, `subscriptionType`, etc.).

`claudesub` saves these as named profiles (one Keychain item per profile + a sidecar metadata file) and lets you flip between them atomically.

## Install

Requires Node ≥ 18.17 and macOS (uses `/usr/bin/security` and `/usr/bin/pgrep`).

```sh
cd claudesub
npm install
npm run build
npm link        # puts `claudesub` on your PATH
```

## Usage

```sh
# 1. Save the currently logged-in account as a named profile.
claudesub save personal

# 2. Switch accounts manually (claude auth logout && claude auth login --email work@...) then snapshot it.
claudesub save work
#   …or use the helper, which guides you through logout + login + save:
claudesub add work

# 3. Switch.
claudesub use personal

# 4. See what you've got.
claudesub list
claudesub status

# 5. Housekeeping.
claudesub rename personal home
claudesub rm work          # asks you to type the name to confirm; --yes skips the prompt
```

All read commands accept `--json` for scripting.

## Behavior worth knowing

- **Auto-snapshot on switch.** Refresh tokens rotate. When you run `claudesub use B` while profile `A` is active, `A`'s slot is re-snapshotted from the live keychain *before* `B` is loaded, so you never lose freshly rotated tokens.
- **Refuses if `claude` is running.** A live `claude` process holds OAuth state in memory and may overwrite `~/.claude.json` on its next write. `use` aborts with the offending PIDs; pass `--force` if you know what you're doing.
- **Post-switch verification.** `use` runs `claude auth status --json` to confirm the swap; `--no-verify` skips it.
- **Live keychain is not touched on `rm`.** Removing a profile only deletes its own slot; the currently active credentials stay put.

## Storage layout

| What | Where |
|---|---|
| Per-profile tokens | macOS Keychain, service `Claude Code-credentials.profile.<name>`, account `$USER` |
| Profile metadata (non-secret) | `~/.claude-subscription-manager/profiles.json` (`mode 0600`) |
| Active-profile marker | `~/.claude-subscription-manager/active` |

## Security caveats

- `/usr/bin/security` accepts the secret blob via argv (`-w <value>`); it is briefly visible in `ps` output to your own user during the call. This matches how Claude Code itself writes the credential.
- `claudesub status` and the CLI never print token blobs to stdout/stderr.
- The state directory and `profiles.json` are created with permissions `0700` / `0600`. Don't sync them to cloud storage in plaintext.

## Limitations

- macOS only.
- No `repair` command yet — if `~/.claude.json` and the keychain ever desync, `claudesub status` reports it but you have to re-run `claudesub use <name>` to fix it.
- No support for the `console`/API-key auth method; only the `claude.ai` OAuth flow is exercised.
