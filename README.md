# claudesub

Switch between Claude Code OAuth subscriptions without running `claude auth logout`/`login` each time. Cross-platform: macOS, Linux, Windows.

## What it does

Claude Code keeps the active subscription in two places:

1. **OAuth tokens** — your OS credential store:
   - **macOS:** Keychain, service `Claude Code-credentials`, account `$USER`.
   - **Linux:** the file `~/.claude/.credentials.json` (mode 0600).
   - **Windows:** Windows Credential Manager, target name `Claude Code-credentials`.
2. **Account metadata** — `~/.claude.json`: top-level `userID` and the `oauthAccount` block (`emailAddress`, `accountUuid`, `organizationName`, `subscriptionType`, …).

`claudesub` saves these as named profiles (one slot in the OS credential store per profile + a sidecar metadata file) and lets you flip between them atomically.

## Install

Requires Node ≥ 18.17.

```sh
cd claudesub
npm install
npm run build
npm link        # puts `claudesub` on your PATH
```

| OS | Extra requirement |
|---|---|
| macOS | `/usr/bin/security` + `/usr/bin/pgrep` (always present on macOS 10.15+) |
| Linux | nothing — credentials live as a JSON file at `~/.claude/.credentials.json`; process inspection reads `/proc` |
| Windows | PowerShell on `PATH` (always present on Win 10+); run from PowerShell or `cmd.exe`, **not** from MSYS / Git Bash (see [claude-code#29049](https://github.com/anthropics/claude-code/issues/29049)) |

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

- **Auto-snapshot on switch.** Refresh tokens rotate. When you run `claudesub use B` while profile `A` is active, `A`'s slot is re-snapshotted from the live store *before* `B` is loaded, so you never lose freshly rotated tokens.
- **Refuses if `claude` is running.** A live `claude` process holds OAuth state in memory and may overwrite `~/.claude.json` on its next write. `use` aborts with the offending PIDs; pass `--force` if you know what you're doing. Process inspection uses `pgrep` on macOS, `/proc/*/cmdline` on Linux, `tasklist.exe` on Windows.
- **Post-switch verification.** `use` runs `claude auth status --json` to confirm the swap; `--no-verify` skips it.
- **Live store is not touched on `rm`.** Removing a profile only deletes its own slot; the currently active credentials stay put.

## Storage layout

| What | macOS | Linux | Windows |
|---|---|---|---|
| Live OAuth tokens | Keychain (`Claude Code-credentials`) | `~/.claude/.credentials.json` (mode 0600) | Credential Manager (`Claude Code-credentials`) |
| Per-profile tokens | Keychain (`Claude Code-credentials.profile.<name>`) | `~/.claude-subscription-manager/keychain/<name>.json` (mode 0600) | Credential Manager (`Claude Code-credentials.profile.<name>`) |
| Profile metadata (non-secret) | `~/.claude-subscription-manager/profiles.json` (mode 0600) | same | same path; default NTFS user-profile ACL |
| Active-profile marker | `~/.claude-subscription-manager/active` | same | same |

## Security caveats

- **macOS:** `/usr/bin/security` accepts the secret blob via argv (`-w <value>`); it is briefly visible in `ps` output to your own user during the call. This matches how Claude Code itself writes the credential.
- **Linux:** OAuth tokens live as plaintext JSON at the file paths above. This mirrors how Claude Code itself stores them on Linux today; csm does not increase the attack surface.
- **Windows:** csm pipes the blob to PowerShell over **stdin** (never argv), then writes it to Credential Manager via `advapi32.CredWrite`. The blob is never visible in `tasklist` argv.
- `claudesub status` and the CLI never print token blobs to stdout/stderr on any OS.
- POSIX file modes (0700/0600) are applied on macOS and Linux. On Windows mode bits are not enforced; protection comes from the default NTFS user-profile ACL on `C:\Users\<name>\`.
- Don't sync `~/.claude-subscription-manager/` (or `~/.claude/.credentials.json` on Linux) to cloud storage in plaintext.

## Limitations

- Operating systems other than macOS / Linux / Windows are rejected at startup with a clear error.
- Linux: csm uses the file `~/.claude/.credentials.json` as the live store. If a future Claude Code release prefers libsecret on Linux, csm will desync until a libsecret adapter is added (tracked as `csm:OQ-004`).
- Windows under MSYS / Git Bash is not supported; csm refuses to start with a pointer to claude-code#29049.
- No `repair` command yet — if `~/.claude.json` and the live store ever desync, `claudesub status` reports it but you have to re-run `claudesub use <name>` to fix it.
- No support for the `console` / API-key auth method; only the `claude.ai` OAuth flow is exercised.
