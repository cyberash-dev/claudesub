# `claude-subscription-manager` — Specification

> Single source of truth for the `claude-sub` CLI. Written per
> `~/.claude/rules/spec-driven-development.md` and
> `~/.claude/skills/spec-driven-development/SKILL.md`.
>
> **v0.1.0** — initial spec authored against the existing implementation
> in `src/`. All normative IDs are `lifecycle.status: proposed`. Per
> SDD §7.5 the agent that authored them cannot self-approve; promotion
> to `approved` requires a non-agent approver via `sdd approve`.
> `BL-001` records the implementation baseline and stays `proposed`
> until a non-agent owner records an `approval_record`.
>
> The current `src/` layout is layer-based (`src/commands/` plus
> sibling adapter files). It violates `csm:CST-004`
> (Vertical Slice + Hexagonal). The mismatch is captured in
> `csm:OQ-001` (blocking) and is the only structural blocker on the
> path to `approved` status for boundary-binding behaviors.

---

## 1. Context

`claude-sub` is a macOS-only CLI that manages multiple Claude Code
OAuth subscriptions on a single workstation. Claude Code keeps the
active subscription in two independent places — the macOS Keychain
generic-password item `Claude Code-credentials` (OAuth tokens, both
access and refresh) and the JSON file `~/.claude.json` (account
metadata under `oauthAccount` and the top-level `userID`). The Claude
Code CLI itself ships only `claude auth login | logout | status` and
treats the keychain plus the JSON file as a single implicit account;
swapping accounts manually requires a full logout/login cycle and
loses the previous account's locally cached tokens.

`claude-sub` introduces named profiles. Each profile owns one extra
keychain item (`Claude Code-credentials.profile.<name>`) plus a
non-secret metadata row in `~/.claude-subscription-manager/profiles.json`.
The active profile is recorded in `~/.claude-subscription-manager/active`.
Switching profiles is a synchronous swap of the keychain item and the
two `~/.claude.json` fields, with auto-snapshot of the previously
active profile to preserve rotated refresh tokens.

This spec governs the `claude-sub` CLI only. The Claude Code CLI,
the Anthropic OAuth flow, the macOS Keychain implementation, and the
internal layout of `~/.claude.json` outside the two mutated fields
are external dependencies (see §8) and out of scope for normative
authoring (see §18).

---

## 2. Glossary

- **Live keychain entry** — the macOS generic-password Keychain item
  with `service="Claude Code-credentials"` and `account=$USER`. The
  blob Claude Code reads to make API calls.
- **Profile keychain entry** — a generic-password Keychain item with
  `service="Claude Code-credentials.profile.<name>"` and
  `account=$USER`. Owned by `claude-sub`; Claude Code never reads it.
- **Profile** — a named tuple of (profile keychain entry,
  metadata row in `profiles.json`). Identified by `name` matching
  `^[a-zA-Z0-9._-]{1,64}$`.
- **Active profile** — the profile name recorded in
  `~/.claude-subscription-manager/active`. Marker is absent when no
  profile is active.
- **Profile metadata** — non-secret per-profile fields stored in
  `~/.claude-subscription-manager/profiles.json`: `name`, `oauthAccount`
  (verbatim copy of the field from `~/.claude.json` at save time),
  `userID`, `email`, `orgName`, `subscriptionType`, `createdAt`,
  `lastUsedAt`. No tokens.
- **Auto-snapshot** — the operation `claude-sub use` performs before
  loading the target: it copies the current live keychain entry into
  the active profile's keychain slot. Captures rotated refresh tokens.
- **Live JSON** — the file `~/.claude.json`. `claude-sub` mutates
  exactly two fields in it: top-level `userID` and the `oauthAccount`
  block. All other fields are preserved verbatim.
- **State directory** — `~/.claude-subscription-manager/`. Created
  with mode `0700`. Holds `profiles.json` (`0600`) and `active`
  (`0600`).
- **Running claude process** — any process visible to `pgrep -lf
  '(^|/)(claude|Claude\.app)'` whose basename is not `claude-sub`
  and whose argv does not match `node\b.*claude-sub`.
- **Desync** — state in which `active` marker names a profile P
  whose recorded `oauthAccount.accountUuid` differs from the
  `oauthAccount.accountUuid` currently in `~/.claude.json`. Reported
  by `claude-sub status`.

---

## 3. Partition

```yaml
---
id: csm
type: Partition
partition_id: csm
owner_team: cyberash
gate_scope:
  - csm
dependencies_on_other_partitions: []
default_policy_set:
  - csm:POL-001
  - csm:POL-002
id_namespace: csm
unmodeled_budget:
  current: 0
  baseline_at: "2026-05-05"
  baseline_value: 0
  trend: monotonic_non_increasing
---
```

---

## 4. Brownfield baseline

```yaml
---
id: csm:BL-001
type: BrownfieldBaseline
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-05T17:53:19.288Z
    change_request: initial v0.1.0 baseline approval — claude-subscription-manager
    scope: first-time-approval
partition_id: csm
discovery_scope:
  - src
  - package.json
  - tsconfig.json
  - .gitignore
coverage_evidence:
  - kind: git_tree_hash_v1
    reference: db22246
    note: |
      Token covers the entire TypeScript implementation, build
      configuration, and dependency manifest. spec/spec.md and
      .sdd/config.json are intentionally outside Discovery scope to
      keep the freshness_token from being self-referential.
freshness_token: 034d550f5764d34ce907b345bf828568c64d1edb00524f3a482ce86ec3dcb7dc
baseline_commit_sha: aa8af5bd17fda74dabad8e25e0feec8ddf52364e
mechanism: git_tree_hash_v1
notes: |
  Brownfield baseline carries no preserved as-is behavior on its own;
  every preserved behavior is materialised as an explicit Behavior /
  Invariant / Contract / Policy / Constraint that references the
  baseline implicitly via partition_id and lifecycle ordering.
  BL-001 stays proposed until a non-agent owner records an
  approval_record. The freshness_token and baseline_commit_sha
  placeholders are filled by `sdd token` after the spec is committed.
---
```

---

## 5. Surfaces

```yaml
---
id: csm:SUR-001
type: Surface
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-05T17:53:19.350Z
    change_request: initial v0.1.0 baseline approval — claude-subscription-manager
    scope: first-time-approval
partition_id: csm
name: csm/cli
version: "0.1.0"
boundary_type: cli
members:
  - csm:CON-001
  - csm:CON-002
consumer_compat_policy: semver_per_surface
notes: |
  Argv shape and exit-code taxonomy for the `claude-sub` binary.
  Stable identifiers: subcommand names (list, status, save, use, rm,
  rename, add) and their flag long-names.
---
```

```yaml
---
id: csm:SUR-002
type: Surface
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-05T17:53:19.350Z
    change_request: initial v0.1.0 baseline approval — claude-subscription-manager
    scope: first-time-approval
partition_id: csm
name: csm/json-output
version: "0.1.0"
boundary_type: cli
members:
  - csm:CON-003
  - csm:CON-004
consumer_compat_policy: semver_per_surface
notes: |
  JSON shapes printed by `--json` flag of `list` and `status`. Stable
  field names; additive minor bumps allowed; structural changes are
  major.
---
```

```yaml
---
id: csm:SUR-003
type: Surface
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-05T17:53:19.350Z
    change_request: initial v0.1.0 baseline approval — claude-subscription-manager
    scope: first-time-approval
partition_id: csm
name: csm/state-files
version: "0.1.0"
boundary_type: public_storage
members:
  - csm:CON-005
  - csm:CON-006
consumer_compat_policy: semver_per_surface
notes: |
  On-disk format of ~/.claude-subscription-manager/profiles.json
  (versioned schema) and the active marker file. Owned by csm; not
  read by Claude Code itself.
---
```

## 6. Requirements

```yaml
---
id: csm:BEH-001
type: Behavior
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-05T17:53:19.480Z
    change_request: initial v0.1.0 baseline approval — claude-subscription-manager
    scope: first-time-approval
partition_id: csm
title: claude-sub list — print profiles with active marker
given: |
  - state directory ~/.claude-subscription-manager/ exists or is absent
  - profiles.json is a valid CON-005 document (or missing)
  - active marker is a valid CON-006 document (or missing)
when: user runs `claude-sub list` (with optional --json)
then: |
  process exits 0; output covers every profile recorded in
  profiles.json sorted by name ascending; the row whose name equals
  the active marker carries a leading `*` glyph (human format) or
  `active: true` (json format); an absent or empty profiles.json
  yields exactly one human-format line "No profiles saved yet. Run
  `claude-sub save <name>` while logged in." or the json document
  `{ active: <string|null>, profiles: [] }`.
  Stdout terminator: single LF.
  No keychain access is performed.
negative_cases:
  - "state directory missing => treated as empty store, exit 0"
  - "profiles.json present with version != 1 => exit 1, error 'profiles.json has unsupported shape (version=<N>)'"
out_of_scope:
  - filtering, paging, search
  - dereferencing the keychain entry to verify it still exists
applicability:
  invariant_to_all_axes: true
concurrency_model:
  actor_concurrency: single_per_process
  read_consistency: read_your_writes
  idempotency: none
  time_source: none
data_scope: all_data
policy_refs:
  - csm:POL-001
  - csm:POL-002
test_obligation:
  predicate: |
    Output enumerates every profile in profiles.json exactly once,
    sorted by name; active marker is reflected per format; absence
    of profiles.json yields the documented empty-state message.
  test_template: integration
  boundary_classes:
    - empty store (no state dir)
    - one profile, no active marker
    - one profile, that profile is active
    - three profiles, middle one active
    - profiles.json with version=2 (failure scenario)
  failure_scenarios:
    - profiles.json unparseable JSON => exit 1
    - profiles.json version mismatch => exit 1
---
```

```yaml
---
id: csm:BEH-002
type: Behavior
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-05T17:53:19.480Z
    change_request: initial v0.1.0 baseline approval — claude-subscription-manager
    scope: first-time-approval
partition_id: csm
title: claude-sub status — report active profile, live auth status, desync
given: |
  - state directory exists or is absent
  - claude binary on PATH (EXT-003)
when: user runs `claude-sub status` (with optional --json)
then: |
  process exits 0; output covers three blocks: (a) active profile
  name from the marker (or "<none recorded>"); (b) the parsed result
  of `claude auth status --json` reduced to loggedIn/email/
  subscriptionType (human form) or the verbatim object plus an
  `error` field on failure (json form); (c) a desync warning when
  active marker names a profile P, profiles.json contains P, and the
  recorded P.oauthAccount.accountUuid differs from
  ~/.claude.json.oauthAccount.accountUuid.
  Exit code stays 0 when desync is reported; the warning is informational.
negative_cases:
  - "active marker present but profile absent from profiles.json => print '(not in profiles.json — desynced)' suffix on the active line; exit 0"
  - "claude binary missing => report 'error — cannot exec claude: <message>'; exit 0"
  - "claude auth status exit != 0 => report 'error — exit <code>: <stderr-or-stdout>'; exit 0"
out_of_scope:
  - probing the keychain
  - mutating any state
applicability:
  invariant_to_all_axes: true
concurrency_model:
  actor_concurrency: single_per_process
  read_consistency: read_your_writes
  idempotency: none
  time_source: none
data_scope: all_data
policy_refs:
  - csm:POL-001
  - csm:POL-002
test_obligation:
  predicate: |
    Status output reflects the marker, the parsed claude auth status
    payload, and the desync verdict computed by accountUuid equality;
    desync is reported only when both sources have an accountUuid and
    they differ.
  test_template: integration
  boundary_classes:
    - no marker, claude logged in
    - marker = P, P in profiles.json, accountUuids match (no warning)
    - marker = P, accountUuids differ (warning)
    - marker = P, P missing from profiles.json (desynced suffix)
    - claude binary missing on PATH (error block)
  failure_scenarios:
    - claude auth status returns malformed JSON => parse-failed error
      block, exit 0
---
```

```yaml
---
id: csm:BEH-003
type: Behavior
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-05T17:53:19.480Z
    change_request: initial v0.1.0 baseline approval — claude-subscription-manager
    scope: first-time-approval
partition_id: csm
title: claude-sub save — snapshot live credentials into a named profile
given: |
  - user is currently logged in (~/.claude.json contains both
    oauthAccount object and a string userID)
  - live keychain entry "Claude Code-credentials" exists
  - state directory is writable
when: user runs `claude-sub save <name>` (with optional --overwrite)
then: |
  process exits 0; the profile keychain entry
  "Claude Code-credentials.profile.<name>" is created or replaced
  with the byte-equivalent value of the live keychain entry; one row
  in profiles.json with name=<name> is upserted carrying a verbatim
  copy of ~/.claude.json.oauthAccount, the userID string, the email
  (oauthAccount.emailAddress), the orgName (oauthAccount.organizationName),
  the subscriptionType (oauthAccount.subscriptionType, falling back to
  billingType, falling back to seatTier — first non-empty string wins,
  empty string when none present), createdAt (preserved across overwrite),
  and lastUsedAt = ISO timestamp at save time; the active marker is
  set to <name>; profiles.json is rewritten atomically (tmp + rename)
  with mode 0600.
  The token blob is not written to stdout, stderr, or any non-keychain
  file (POL-001).
negative_cases:
  - <name> fails the regex `^[a-zA-Z0-9._-]{1,64}$` => exit 2,
    error "Invalid profile name"
  - profile already exists and --overwrite absent => exit 1, error
    "Profile already exists. Pass --overwrite to replace it."
  - ~/.claude.json missing oauthAccount or userID => exit 1, error
    "looks like you're not logged in"
  - live keychain entry missing => exit 1, propagates security exit 44
out_of_scope:
  - logging the user out before snapshotting
  - rotating refresh tokens
applicability:
  invariant_to_all_axes: true
concurrency_model:
  actor_concurrency: single_per_user
  read_consistency: strong
  idempotency: at_least_once_with_key:profile_name
  time_source: wall_clock:1s
data_scope: all_data
policy_refs:
  - csm:POL-001
  - csm:POL-002
test_obligation:
  predicate: |
    After save, profiles.json contains a row with the recorded fields,
    the keychain slot exists with the same byte content as the live
    slot, the active marker equals <name>, file modes are 0600/0700,
    and no token blob appears anywhere outside the keychain slot.
  test_template: integration
  boundary_classes:
    - first save (state dir absent)
    - second save with a different name (two profiles, second active)
    - overwrite of an existing profile (createdAt preserved)
    - logged-out state (failure: no oauthAccount)
    - invalid name (failure: regex)
  failure_scenarios:
    - rename(2) fails after tmp write => exit 1, no partial profiles.json
---
```

```yaml
---
id: csm:BEH-004
type: Behavior
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-05T17:53:19.480Z
    change_request: initial v0.1.0 baseline approval — claude-subscription-manager
    scope: first-time-approval
partition_id: csm
title: claude-sub use — swap credentials with auto-snapshot and verification
given: |
  - profile <name> exists in profiles.json with a populated keychain slot
  - state directory is writable
  - claude binary on PATH for post-verification (EXT-003)
when: user runs `claude-sub use <name>` (with optional --force, --no-verify)
then: |
  process exits 0 after the following ordered steps:
    1. when --force is absent, find running claude processes
       (csm:EXT-002); when the resulting list is non-empty, exit 1,
       print one line per process with `pid=<N>  <basename>`, and
       print "Quit those sessions and retry, or pass --force.";
    2. when an active marker exists and names profile A and A
       differs from <name> and A is present in profiles.json, copy
       the current live keychain entry into the keychain slot of A
       and update A.lastUsedAt; failures of this auto-snapshot step
       print a warning to stderr and do not abort the switch;
    3. read the keychain blob from profile <name>'s slot and write
       it byte-equivalently into the live keychain entry "Claude
       Code-credentials";
    4. patch ~/.claude.json under an exclusive lock (CON-007):
       replace the top-level userID with the recorded value of
       <name>.userID and replace the oauthAccount block with the
       recorded value of <name>.oauthAccount; preserve every other
       field; preserve the file mode; write atomically (tmp + rename);
    5. update <name>.lastUsedAt and persist profiles.json;
    6. write the active marker to <name>;
    7. when --no-verify is absent, run `claude auth status --json`
       and exit 1 when the parsed loggedIn is not true, otherwise
       print "claude auth status: loggedIn as <email> (<plan>)".
negative_cases:
  - <name> not in profiles.json => exit 1, error "Unknown profile"
  - one or more running claude processes detected (no --force) =>
    exit 1, list PIDs
  - keychain slot for <name> missing => exit 1, propagates security
    exit 44
  - claude auth status reports loggedIn=false after the swap =>
    exit 1
out_of_scope:
  - killing running claude processes on the user's behalf
  - rolling the swap back when verification fails
applicability:
  invariant_to_all_axes: true
concurrency_model:
  actor_concurrency: single_per_user
  read_consistency: strong
  idempotency: at_least_once_with_key:profile_name
  time_source: wall_clock:1s
data_scope: all_data
policy_refs:
  - csm:POL-001
  - csm:POL-002
  - csm:POL-003
test_obligation:
  predicate: |
    After successful use, INV-005 holds (accountUuid in ~/.claude.json
    equals the recorded value), the live keychain entry equals the
    target profile's slot byte-for-byte, the active marker equals
    <name>, the previously active profile's slot equals the live
    keychain entry as it was before the call, and `claude auth status
    --json` returns loggedIn=true.
  test_template: integration
  boundary_classes:
    - first use (no prior active marker)
    - swap A => B with both present (auto-snapshot of A taken)
    - swap A => A (idempotent: still verifies)
    - --force overrides running-claude check
    - --no-verify skips the post-call claude invocation
  failure_scenarios:
    - running claude detected, no --force => exit 1, no swap
    - target slot missing => exit 1
    - claude auth status post-call fails => exit 1
---
```

```yaml
---
id: csm:BEH-005
type: Behavior
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-05T17:53:19.480Z
    change_request: initial v0.1.0 baseline approval — claude-subscription-manager
    scope: first-time-approval
partition_id: csm
title: claude-sub rm — delete profile metadata and keychain slot, leave live untouched
given: |
  - profile <name> exists in profiles.json
when: user runs `claude-sub rm <name>` (with optional --yes)
then: |
  when --yes is absent, prompt "Delete profile \"<name>\"? Type the
  name to confirm:" on stdin; abort with exit 1 when the typed value
  differs from <name>; on confirmation (or with --yes), delete the
  profile keychain entry "Claude Code-credentials.profile.<name>"
  (a missing entry yields a stderr warning but proceeds), remove the
  matching row from profiles.json (atomic write), and when the active
  marker equals <name> remove the marker file (the live keychain
  entry "Claude Code-credentials" is not touched). Exit 0.
negative_cases:
  - <name> not in profiles.json => exit 1
  - typed confirmation differs from <name> => exit 1, no mutation
  - keychain entry already absent => stderr warning, proceed, exit 0
out_of_scope:
  - removing the live keychain entry
  - logging out via claude auth logout
applicability:
  invariant_to_all_axes: true
concurrency_model:
  actor_concurrency: single_per_user
  read_consistency: strong
  idempotency: at_least_once_with_key:profile_name
  time_source: none
data_scope: all_data
policy_refs:
  - csm:POL-001
  - csm:POL-002
test_obligation:
  predicate: |
    After rm, profiles.json no longer contains a row with name=<name>,
    the keychain slot for <name> is absent, the active marker is
    cleared iff it equalled <name>, and the live keychain entry
    "Claude Code-credentials" is byte-equivalent to its pre-call value.
  test_template: integration
  boundary_classes:
    - rm of an inactive profile
    - rm of the active profile (marker cleared)
    - --yes skips the prompt
    - keychain slot pre-deleted (proceeds with warning)
  failure_scenarios:
    - prompt rejected => exit 1, store unchanged
---
```

```yaml
---
id: csm:BEH-006
type: Behavior
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-05T17:53:19.480Z
    change_request: initial v0.1.0 baseline approval — claude-subscription-manager
    scope: first-time-approval
partition_id: csm
title: claude-sub rename — move keychain slot, update profiles.json, update marker
given: |
  - profile <old> exists in profiles.json with a populated keychain slot
  - <new> is not present in profiles.json
when: user runs `claude-sub rename <old> <new>`
then: |
  process exits 0 after: (a) <new> passes the regex
  `^[a-zA-Z0-9._-]{1,64}$`; (b) the byte content of the keychain
  entry for <old> is written under the keychain entry for <new>;
  (c) the keychain entry for <old> is deleted; (d) profiles.json
  is rewritten atomically with the row renamed (every other field
  preserved); (e) when the active marker equals <old>, it is rewritten
  to <new>.
negative_cases:
  - <new> fails the regex => exit 2
  - <old> not in profiles.json => exit 1
  - <new> already present in profiles.json => exit 1
out_of_scope:
  - merging two profiles
  - rotating tokens
applicability:
  invariant_to_all_axes: true
concurrency_model:
  actor_concurrency: single_per_user
  read_consistency: strong
  idempotency: none
  time_source: none
data_scope: all_data
policy_refs:
  - csm:POL-001
  - csm:POL-002
test_obligation:
  predicate: |
    After rename, profiles.json contains a row with name=<new> and no
    row with name=<old>, the keychain slot for <new> equals the
    pre-call slot for <old> byte-for-byte, the slot for <old> is
    absent, and the active marker equals <new> iff it equalled <old>
    before the call.
  test_template: integration
  boundary_classes:
    - rename of an inactive profile
    - rename of the active profile (marker updated)
    - rename collision (failure: <new> already exists)
    - invalid <new> regex (failure: exit 2)
---
```

```yaml
---
id: csm:BEH-007
type: Behavior
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-05T17:53:19.480Z
    change_request: initial v0.1.0 baseline approval — claude-subscription-manager
    scope: first-time-approval
partition_id: csm
title: claude-sub add — orchestrate logout, login, save under one name
given: |
  - claude binary on PATH (EXT-003)
  - <name> is a syntactically valid profile name
when: user runs `claude-sub add <name>`
then: |
  process prints a three-line plan, prompts "Continue? [y/N]:"; on
  "y"/"yes" (case-insensitive) the process invokes
  `claude auth logout` with inherited stdio; on non-zero exit from
  logout, the process exits 1; on success the process prompts the
  user to run `claude auth login` interactively, then waits for an
  Enter keypress; after Enter, the process invokes BEH-003 with
  --overwrite=true and exits with that subcommand's exit code.
negative_cases:
  - <name> fails the regex => exit 2, no claude invocation
  - prompt answered with anything other than "y"/"yes" => exit 1, no
    claude invocation
  - claude auth logout exits non-zero => exit 1
out_of_scope:
  - launching `claude auth login` automatically (the user runs it
    in another terminal)
applicability:
  invariant_to_all_axes: true
concurrency_model:
  actor_concurrency: single_per_user
  read_consistency: read_your_writes
  idempotency: none
  time_source: wall_clock:1s
data_scope: all_data
policy_refs:
  - csm:POL-001
  - csm:POL-002
test_obligation:
  predicate: |
    On the happy path the process invokes claude auth logout exactly
    once, prompts twice, then materialises a profile via BEH-003 with
    --overwrite=true; refusal at the first prompt aborts before any
    claude invocation.
  test_template: integration
  boundary_classes:
    - happy path (y, logout 0, save 0)
    - first prompt declined
    - logout fails
    - invalid <name>
---
```

```yaml
---
id: csm:BEH-008
type: Behavior
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-05T17:53:19.480Z
    change_request: initial v0.1.0 baseline approval — claude-subscription-manager
    scope: first-time-approval
partition_id: csm
title: claude-sub usage errors — exit 2 on unknown command and missing positional
given: |
  - any environment (no preconditions on filesystem, keychain, or claude state)
when: |
  user runs the binary with no command, an unknown command, --help,
  --version, or a known command missing required positionals
then: |
  - `claude-sub` with no args prints the HELP banner and exits 0
  - `claude-sub --help|-h|help` prints the HELP banner and exits 0
  - `claude-sub --version|-v` prints "claude-sub <semver>\n" and exits 0
  - an unknown command prints "Unknown command: <cmd>\n\n<HELP>" to
    stderr and exits 2
  - a known command missing a required positional prints the
    command's "Usage:" line to stderr and exits 2
negative_cases:
  - "parseArgs strict-mode rejects unknown flags => exit 1 from the rethrown Error (caught by main and printed as 'error: <message>')"
out_of_scope:
  - shell completion
  - colored output
applicability:
  invariant_to_all_axes: true
concurrency_model:
  actor_concurrency: single_per_process
  read_consistency: strong
  idempotency: at_least_once_with_key:argv
  time_source: none
data_scope: new_writes_only
policy_refs:
  - csm:POL-001
test_obligation:
  predicate: |
    Exit code matches the documented value for each argv shape; HELP
    banner contains every subcommand listed in the table; --version
    output equals package.json#version.
  test_template: integration
  boundary_classes:
    - no args
    - --help / -h / help
    - --version / -v
    - unknown command
    - save without <name>
    - rename with one positional
    - unknown flag (parseArgs strict-mode error)
---
```

## 7. Data contracts

```yaml
---
id: csm:CON-001
type: Contract
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-05T17:53:19.416Z
    change_request: initial v0.1.0 baseline approval — claude-subscription-manager
    scope: first-time-approval
partition_id: csm
title: claude-sub argv shape per subcommand
surface_ref: csm:SUR-001
schema: |
  claude-sub                                 # = `claude-sub --help`, exit 0
  claude-sub --help | -h | help              # exit 0, prints HELP
  claude-sub --version | -v                  # exit 0, prints "claude-sub <semver>\n"
  claude-sub list   [--json]
  claude-sub status [--json]
  claude-sub save   <name> [--overwrite]
  claude-sub use    <name> [--force] [--no-verify]
  claude-sub rm     <name> [--yes]
  claude-sub remove <name> [--yes]           # alias of rm
  claude-sub delete <name> [--yes]           # alias of rm
  claude-sub rename <old> <new>
  claude-sub mv     <old> <new>              # alias of rename
  claude-sub add    <name>
preconditions: |
  - <name> matches `^[a-zA-Z0-9._-]{1,64}$`
  - all flags are long-form except `-y` (alias of --yes), `-h`
    (--help), `-v` (--version)
postconditions: |
  - parseArgs runs in strict mode; unknown flags throw and main
    catches the Error, printing "error: <message>" and exiting 1
external_identifiers:
  - "subcommand names: list, status, save, use, rm, remove, delete, rename, mv, add"
  - "flag names: --json, --overwrite, --force, --no-verify, --yes (-y), --help (-h), --version (-v)"
compatibility_rules:
  - adding a new subcommand or a new flag is a minor bump
  - removing or renaming a subcommand or flag is a major bump
  - changing the meaning of an existing flag without a rename is a major bump
applicability:
  invariant_to_all_axes: true
concurrency_model:
  actor_concurrency: single_per_process
  read_consistency: strong
  idempotency: none
  time_source: none
data_scope: new_writes_only
policy_refs:
  - csm:POL-001
error_taxonomy:
  - "exit 0 — success or banner request"
  - "exit 1 — runtime failure (unknown profile, refusal, IO, claude invocation)"
  - "exit 2 — argv shape error (unknown command, missing positional, invalid name)"
test_obligation:
  predicate: |
    Every documented argv shape is recognised by the dispatcher and
    routes to the matching command module; aliases (rm/remove/delete,
    rename/mv) call the same handler.
  test_template: integration
  boundary_classes: [each row of the schema]
---
```

```yaml
---
id: csm:CON-002
type: Contract
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-05T17:53:19.416Z
    change_request: initial v0.1.0 baseline approval — claude-subscription-manager
    scope: first-time-approval
partition_id: csm
title: claude-sub exit-code taxonomy
surface_ref: csm:SUR-001
schema: |
  exit 0 — success path documented per BEH-001..008
  exit 1 — runtime failure (BEH preconditions not met, refusal,
           propagated security/pgrep/claude exit, post-verification
           failure, lock acquisition timeout)
  exit 2 — argv shape error (unknown command, missing positional,
           invalid <name> per the regex)
preconditions: |
  - the dispatcher in cli.ts maps every code path to one of {0, 1, 2}
postconditions: |
  - process.exit is called with one of {0, 1, 2} on every code path
external_identifiers: [exit codes 0, 1, 2]
compatibility_rules:
  - introducing new exit codes is a minor bump
  - reassigning an existing exit code to a new meaning is a major bump
applicability:
  invariant_to_all_axes: true
concurrency_model:
  actor_concurrency: single_per_process
  read_consistency: strong
  idempotency: none
  time_source: none
data_scope: new_writes_only
policy_refs:
  - csm:POL-001
error_taxonomy: [see schema]
test_obligation:
  predicate: |
    Every BEH-001..008 happy path exits 0; every documented failure
    case exits with the documented code.
  test_template: integration
  boundary_classes: [happy path, runtime failure, argv shape error per BEH]
---
```

```yaml
---
id: csm:CON-003
type: Contract
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-05T17:53:19.416Z
    change_request: initial v0.1.0 baseline approval — claude-subscription-manager
    scope: first-time-approval
partition_id: csm
title: claude-sub list --json output shape
surface_ref: csm:SUR-002
schema: |
  {
    "active": <string|null>,
    "profiles": [
      {
        "name":             <string>,
        "email":            <string>,
        "orgName":          <string>,
        "subscriptionType": <string>,
        "active":           <boolean>,
        "lastUsedAt":       <iso8601-string>
      }, ...
    ]
  }
preconditions: |
  - profiles.json has been read successfully
  - active marker has been read (or is absent => null)
postconditions: |
  - profiles array is sorted by name ascending
  - exactly one element has active=true when active is non-null
  - no element has active=true when active is null
external_identifiers:
  - "top-level keys: active, profiles"
  - "row keys: name, email, orgName, subscriptionType, active, lastUsedAt"
compatibility_rules:
  - adding a new row key is a minor bump
  - removing or renaming a row key is a major bump
  - changing the type of a value is a major bump
applicability:
  invariant_to_all_axes: true
concurrency_model:
  actor_concurrency: single_per_process
  read_consistency: read_your_writes
  idempotency: none
  time_source: none
data_scope: all_data
policy_refs:
  - csm:POL-001
error_taxonomy:
  - parse failure of profiles.json => exit 1, no JSON emitted
test_obligation:
  predicate: |
    Output parses as JSON, validates against the schema, sort
    invariant holds, active flag math holds.
  test_template: contract
  boundary_classes:
    - empty profiles
    - one profile, no active
    - three profiles, middle active
---
```

```yaml
---
id: csm:CON-004
type: Contract
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-05T17:53:19.416Z
    change_request: initial v0.1.0 baseline approval — claude-subscription-manager
    scope: first-time-approval
partition_id: csm
title: claude-sub status --json output shape
surface_ref: csm:SUR-002
schema: |
  {
    "active":        <string|null>,
    "profileKnown":  <boolean>,
    "claudeJson": {
      "userID":       <string|null>,
      "accountUuid":  <string|null>,
      "emailAddress": <string|null>
    } | null,
    "desynced": { "reason": <string> } | null,
    "authStatus": {
      "loggedIn":         <boolean|undefined>,
      "authMethod":       <string|undefined>,
      "apiProvider":      <string|undefined>,
      "email":            <string|undefined>,
      "orgId":            <string|undefined>,
      "orgName":          <string|undefined>,
      "subscriptionType": <string|undefined>,
      "error":            <string|undefined>,
      "raw":              <string|undefined>
    }
  }
preconditions: |
  - active marker has been read
  - profiles.json has been read (errors tolerated => claudeJson=null)
  - claude auth status --json invocation result available
postconditions: |
  - desynced is non-null only when both accountUuids are strings and differ
  - authStatus.error is set on any non-zero exit or parse failure
external_identifiers: [top-level keys per schema]
compatibility_rules:
  - additive: minor
  - rename/remove of a top-level key: major
applicability:
  invariant_to_all_axes: true
concurrency_model:
  actor_concurrency: single_per_process
  read_consistency: read_your_writes
  idempotency: none
  time_source: none
data_scope: all_data
policy_refs:
  - csm:POL-001
error_taxonomy:
  - claude binary missing => authStatus.error
  - JSON parse failure of claude auth status => authStatus.error + raw
test_obligation:
  predicate: |
    Output parses as JSON, validates against the schema, desynced is
    populated under the documented condition only.
  test_template: contract
  boundary_classes:
    - no marker, claude logged in
    - marker matches accountUuid
    - marker mismatches accountUuid
    - claude binary missing
---
```

```yaml
---
id: csm:CON-005
type: Contract
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-05T17:53:19.416Z
    change_request: initial v0.1.0 baseline approval — claude-subscription-manager
    scope: first-time-approval
partition_id: csm
title: profiles.json on-disk schema
surface_ref: csm:SUR-003
schema: |
  {
    "version": 1,
    "profiles": [
      {
        "name":             <string matching ^[a-zA-Z0-9._-]{1,64}$>,
        "oauthAccount":     <object copied verbatim from
                              ~/.claude.json#oauthAccount at save time>,
        "userID":           <string copied from ~/.claude.json#userID>,
        "email":            <string>,
        "orgName":          <string>,
        "subscriptionType": <string>,
        "createdAt":        <iso8601-string>,
        "lastUsedAt":       <iso8601-string>
      }, ...
    ]
  }
preconditions: |
  - file mode is 0600
  - parent directory mode is 0700
postconditions: |
  - JSON is pretty-printed (2-space indent, LF terminator)
  - rows are sorted by name ascending after every upsert
  - no row contains any token-bearing field
external_identifiers:
  - "top-level keys: version, profiles"
  - "row keys: name, oauthAccount, userID, email, orgName, subscriptionType, createdAt, lastUsedAt"
compatibility_rules:
  - version bump is required for any breaking schema change
  - adding a row key is a minor bump (version stays at 1, readers ignore unknown keys)
  - reading a file with version != 1 is a hard error in csm
applicability:
  invariant_to_all_axes: true
concurrency_model:
  actor_concurrency: single_per_user
  read_consistency: strong
  idempotency: exactly_once_with_key:path
  time_source: wall_clock:1s
data_scope: all_data
policy_refs:
  - csm:POL-001
  - csm:POL-002
error_taxonomy:
  - file unparseable as JSON => exit 1
  - version != 1 => exit 1
test_obligation:
  predicate: |
    Round-trip: write file, read back, structural equality holds;
    sort invariant holds; mode 0600 holds; tokens absent.
  test_template: property
  boundary_classes:
    - empty profiles array
    - 100-row file (sort stress)
    - row with maximal-length name (64 chars)
---
```

```yaml
---
id: csm:CON-006
type: Contract
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-05T17:53:19.416Z
    change_request: initial v0.1.0 baseline approval — claude-subscription-manager
    scope: first-time-approval
partition_id: csm
title: active marker file format
surface_ref: csm:SUR-003
schema: |
  File path: ~/.claude-subscription-manager/active
  Content:    a single line whose trimmed value equals the active
              profile's name (or the file is absent).
preconditions: |
  - file mode is 0600 when present
  - parent directory mode is 0700
postconditions: |
  - trimmed content matches `^[a-zA-Z0-9._-]{1,64}$`
external_identifiers: [path, content shape]
compatibility_rules:
  - changing the path is a major bump
  - changing the content shape (e.g. JSON wrapping) is a major bump
applicability:
  invariant_to_all_axes: true
concurrency_model:
  actor_concurrency: single_per_user
  read_consistency: read_your_writes
  idempotency: exactly_once_with_key:path
  time_source: none
data_scope: all_data
policy_refs:
  - csm:POL-001
  - csm:POL-002
error_taxonomy:
  - file present but empty after trim => treated as absent (returns null)
test_obligation:
  predicate: |
    Round-trip: write marker, read marker, content equality after trim.
  test_template: contract
  boundary_classes:
    - missing file (read returns null)
    - file with trailing newline
    - file with single name and no newline
---
```

```yaml
---
id: csm:CON-007
type: Contract
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-05T17:53:19.416Z
    change_request: initial v0.1.0 baseline approval — claude-subscription-manager
    scope: first-time-approval
partition_id: csm
title: ~/.claude.json patch protocol (mutated fields only)
surface_ref: csm:SUR-003
schema: |
  csm reads and writes exactly two top-level locations of
  ~/.claude.json:
    - top-level field   "userID"        : string
    - top-level field   "oauthAccount"  : object (verbatim replacement)
  Every other field is preserved byte-for-byte across the patch.
  File mode is preserved across the patch.
preconditions: |
  - ~/.claude.json exists and parses as JSON
  - the user holds an exclusive csm-managed lock on
    ~/.claude.json.csm.lock (created via fs.open(..., "wx"))
postconditions: |
  - the lock file is unlinked on every exit path
  - lock acquisition fails after 5 seconds
  - the new file is written via tmp-file + rename(2) in the same
    directory; mode equals the pre-call mode
external_identifiers: [path, fields, lock path]
compatibility_rules:
  - mutating any field other than userID or oauthAccount is a major
    bump (cross-cutting risk against Claude Code's own state)
applicability:
  invariant_to_all_axes: true
concurrency_model:
  actor_concurrency: single_per_user
  read_consistency: strong
  idempotency: exactly_once_with_key:lock_path
  time_source: wall_clock:5s
data_scope: all_data
policy_refs:
  - csm:POL-001
  - csm:POL-002
error_taxonomy:
  - lock contention beyond 5s => exit 1, error references the lock path
  - rename(2) failure => exit 1, partial state ruled out by
    write-then-rename ordering
test_obligation:
  predicate: |
    After patchClaudeJson, the only diff vs the prior file is in the
    two declared fields; mode is unchanged; the lock file is absent.
  test_template: integration
  boundary_classes:
    - file with arbitrary unrelated keys (preserved)
    - file mode 0600 vs 0644 (preserved either way)
    - concurrent second csm process => second waits then proceeds
  failure_scenarios:
    - stale lock file (manual recovery: remove lock and retry)
---
```

## 8. Invariants

```yaml
---
id: csm:INV-001
type: Invariant
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-05T17:53:19.543Z
    change_request: initial v0.1.0 baseline approval — claude-subscription-manager
    scope: first-time-approval
partition_id: csm
title: profile names are unique within profiles.json
always: |
  For any state of profiles.json, no two rows have an equal `name`
  field. Upserts in BEH-003 enforce uniqueness by removing any
  existing row with the same name before appending; renames in
  BEH-006 fail when the target name is already present.
scope: profiles.json file content
evidence: public_api
stability: contractual
data_scope: all_data
applicability:
  invariant_to_all_axes: true
test_obligation:
  predicate: |
    For every sequence of save/rm/rename calls, count of rows in
    profiles.json grouped by name yields max 1 per name.
  test_template: property
  boundary_classes:
    - save then save with same name and --overwrite
    - rename old to new where new equals an existing name (rejected)
  failure_scenarios:
    - any persisted file with duplicate names => violates INV
---
```

```yaml
---
id: csm:INV-002
type: Invariant
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-05T17:53:19.543Z
    change_request: initial v0.1.0 baseline approval — claude-subscription-manager
    scope: first-time-approval
partition_id: csm
title: active marker, when present, names a profile in profiles.json
always: |
  After every csm-initiated transition (save, use, rm, rename), the
  active marker file either is absent or its trimmed content equals
  the `name` field of exactly one row in profiles.json.
scope: pair (active marker, profiles.json)
evidence: public_api
stability: contractual
data_scope: all_data
applicability:
  invariant_to_all_axes: true
test_obligation:
  predicate: |
    Read marker, read profiles.json; when marker exists, the trimmed
    string is found among row.name values.
  test_template: property
  boundary_classes:
    - state after save (marker = saved name)
    - state after use (marker = target name)
    - state after rm of active profile (marker absent)
    - state after rename of active profile (marker = new name)
  failure_scenarios:
    - external editor leaves a marker pointing to a non-existent
      profile (status reports desynced; INV is bounded to csm
      transitions, not external mutations)
---
```

```yaml
---
id: csm:INV-003
type: Invariant
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-05T17:53:19.543Z
    change_request: initial v0.1.0 baseline approval — claude-subscription-manager
    scope: first-time-approval
partition_id: csm
title: state directory mode 0700, profiles.json and active mode 0600
always: |
  After ensureStateDir, ~/.claude-subscription-manager/ has mode
  0700; profiles.json is written with mode 0600 via writeFile and is
  re-checked on read; the active marker file is written with mode 0600.
scope: filesystem nodes under ~/.claude-subscription-manager/
evidence: db_constraint
stability: contractual
data_scope: all_data
applicability:
  invariant_to_all_axes: true
concurrency_model:
  actor_concurrency: single_per_user
  read_consistency: strong
  idempotency: exactly_once_with_key:path
  time_source: none
test_obligation:
  predicate: |
    stat() on each path yields mode bits 0700 for the directory and
    0600 for files after every mutating subcommand.
  test_template: integration
  boundary_classes:
    - first save creates the directory
    - subsequent save preserves modes
    - umask=0o077 on the user shell (no-op effect)
  failure_scenarios:
    - directory pre-created with 0755 => ensureStateDir narrows to 0700
---
```

```yaml
---
id: csm:INV-004
type: Invariant
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-05T17:53:19.543Z
    change_request: initial v0.1.0 baseline approval — claude-subscription-manager
    scope: first-time-approval
partition_id: csm
title: token blob is never written to stdout, stderr, or non-keychain files
never: |
  The byte content of any keychain entry (live or profile) appears in
  process stdout, process stderr, or any file path other than the two
  legitimate sinks: the macOS Keychain (via /usr/bin/security) and a
  short-lived process argv passed to the child `security` invocation.
scope: every BEH path
evidence: test_probe
stability: contractual
data_scope: all_data
applicability:
  invariant_to_all_axes: true
test_obligation:
  predicate: |
    For every BEH happy-path invocation, the captured stdout and
    stderr buffers and every file modified during the call MUST NOT
    contain the bytes of the live or profile keychain blob.
  test_template: integration
  boundary_classes: [each BEH path]
  failure_scenarios:
    - any blob substring observed in captured stdout => violates INV
    - any blob substring observed in profiles.json => violates INV
---
```

```yaml
---
id: csm:INV-005
type: Invariant
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-05T17:53:19.543Z
    change_request: initial v0.1.0 baseline approval — claude-subscription-manager
    scope: first-time-approval
partition_id: csm
title: post-use accountUuid alignment between live JSON and target profile
always: |
  After `claude-sub use <name>` exits 0, the value at
  ~/.claude.json#oauthAccount.accountUuid equals the recorded value
  at profiles.json[name=<name>].oauthAccount.accountUuid; the active
  marker equals <name>; the live keychain entry "Claude
  Code-credentials" is byte-equivalent to the keychain entry
  "Claude Code-credentials.profile.<name>" as it existed at the
  moment that slot was last written.
scope: triple (~/.claude.json, profiles.json, live keychain)
evidence: public_api
stability: contractual
data_scope: all_data
applicability:
  invariant_to_all_axes: true
concurrency_model:
  actor_concurrency: single_per_user
  read_consistency: strong
  idempotency: at_least_once_with_key:profile_name
  time_source: none
test_obligation:
  predicate: |
    Run BEH-004; read ~/.claude.json and profiles.json; assert
    accountUuid equality and marker equality; read both keychain
    blobs and assert byte-equivalence.
  test_template: integration
  boundary_classes:
    - first use after save
    - swap A => B (auto-snapshot precondition)
    - --no-verify path (still must hold INV)
---
```

---

## 9. External dependencies

```yaml
---
id: csm:EXT-001
type: ExternalDependency
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-05T17:53:19.606Z
    change_request: initial v0.1.0 baseline approval — claude-subscription-manager
    scope: first-time-approval
partition_id: csm
provider: macOS Keychain Services via the `security` CLI
provider_surface@version: macOS-security-CLI@macOS-14
authority_url_or_doc: |
  Apple developer documentation: `man 1 security`
consumer_contract: |
  csm invokes only:
    /usr/bin/security find-generic-password -s <service> -a <user> [-w]
    /usr/bin/security add-generic-password  -U -s <service> -a <user>
                                            -w <value> [-l <label>]
    /usr/bin/security delete-generic-password -s <service> -a <user>
  Exit 44 = item not found (treated as a typed result, not an error).
  Exit 0  = success. Any other exit raised as Error to caller.
  Service names used: "Claude Code-credentials" (live, owned by Claude
  Code), "Claude Code-credentials.profile.<name>" (csm-owned).
  Account: process owner's username (os.userInfo().username).
drift_detection:
  mechanism: none_with_review_by:2026-11-05
auth_scope: not_applicable
rate_limits: not_applicable
retry/idempotency: not_applicable
error_taxonomy:
  - exit 44 => KeychainItemNotFound (typed; happy result for has-checks)
  - exit 51 => "interaction not allowed" (UI prompt rejected by user)
  - exit 25300 => password exists, -U flag missing (csm always passes -U)
sandbox_or_fixture: not_applicable
last_verified_at: "2026-05-05"
test_obligation:
  predicate: |
    keychain.ts shells out to /usr/bin/security only with the argv
    shapes listed in consumer_contract; no mutating verb other than
    add-generic-password and delete-generic-password is invoked.
  test_template: integration
  boundary_classes:
    - read existing item (exit 0)
    - read missing item (exit 44 => KeychainItemNotFound)
    - upsert via -U
    - delete existing
    - delete missing (exit 44)
---
```

```yaml
---
id: csm:EXT-002
type: ExternalDependency
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-05T17:53:19.606Z
    change_request: initial v0.1.0 baseline approval — claude-subscription-manager
    scope: first-time-approval
partition_id: csm
provider: macOS process inspection via `pgrep`
provider_surface@version: macOS-pgrep-CLI@macOS-14
authority_url_or_doc: |
  Apple developer documentation: `man 1 pgrep`
consumer_contract: |
  csm invokes only:
    /usr/bin/pgrep -lf '(^|/)(claude|Claude\.app)'
  Exit 0 = matches found, stdout = `<pid> <command>` lines.
  Exit 1 = no matches (typed empty result, not an error).
  csm filters out itself by argv pattern `claude-sub`, `node\b.*claude-sub`.
drift_detection:
  mechanism: none_with_review_by:2026-11-05
auth_scope: not_applicable
rate_limits: not_applicable
retry/idempotency: not_applicable
error_taxonomy:
  - exit 1 => empty result (not an error)
  - exit 2 => syntax error (unreachable: argv is fixed)
  - exit 3 => no /proc-like access (unreachable on macOS)
sandbox_or_fixture: not_applicable
last_verified_at: "2026-05-05"
test_obligation:
  predicate: |
    procCheck.ts invokes /usr/bin/pgrep with the exact pattern;
    self-filter excludes claude-sub processes; an empty match yields
    an empty list, not an error.
  test_template: integration
  boundary_classes:
    - no claude processes => empty list
    - one Claude.app + one csm self => list of one (Claude.app)
    - one `claude` interactive session => list of one
---
```

```yaml
---
id: csm:EXT-003
type: ExternalDependency
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-05T17:53:19.606Z
    change_request: initial v0.1.0 baseline approval — claude-subscription-manager
    scope: first-time-approval
partition_id: csm
provider: Anthropic Claude Code CLI
provider_surface@version: claude-code@stable
authority_url_or_doc: |
  https://docs.claude.com/en/docs/claude-code/cli-reference
consumer_contract: |
  csm invokes only:
    claude auth status --json    (BEH-002, BEH-004 verification)
    claude auth logout           (BEH-007, with inherited stdio)
  Expected `claude auth status --json` shape:
    { loggedIn: boolean, authMethod?, apiProvider?, email?, orgId?,
      orgName?, subscriptionType? }
  csm reads loggedIn, email, subscriptionType; ignores other fields.
  csm does not invoke `claude auth login` programmatically — the user
  drives login interactively (see BEH-007).
drift_detection:
  mechanism: contract_test_against_sandbox
sandbox_or_fixture: |
  Live `claude auth status --json` is invoked in CI-like setups against
  the developer's actual Claude Code installation; csm does not ship a
  fixture. Drift surfaces as parse failure or missing fields.
auth_scope: |
  Reads OAuth state from the live keychain entry; csm does not pass
  any credentials to claude.
rate_limits: not_applicable
retry/idempotency: not_applicable
error_taxonomy:
  - claude binary missing on PATH => spawn ENOENT, csm reports error
  - non-zero exit from `auth status` => csm reports error
  - JSON parse failure => csm reports error with `raw` field
last_verified_at: "2026-05-05"
test_obligation:
  predicate: |
    Status invocation parses successfully on the documented shape;
    missing fields surface as `error` rather than crash; logout
    invocation propagates exit code.
  test_template: integration
  boundary_classes:
    - logged-in account (full payload)
    - logged-out account (loggedIn=false)
    - claude binary missing
    - logout exit 0
    - logout exit non-zero
---
```

```yaml
---
id: csm:EXT-004
type: ExternalDependency
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-05T17:53:19.606Z
    change_request: initial v0.1.0 baseline approval — claude-subscription-manager
    scope: first-time-approval
partition_id: csm
provider: Claude Code persistent state file ~/.claude.json
provider_surface@version: claude-json@unversioned
authority_url_or_doc: |
  Undocumented; observed shape captured in CON-007 schema. Owned by
  Claude Code; csm only mutates two named fields and otherwise
  preserves the file byte-for-byte.
consumer_contract: |
  csm reads:
    top-level field "userID"        : string | undefined
    top-level field "oauthAccount"  : object | undefined
  csm writes:
    top-level field "userID"        : string (verbatim from a profile)
    top-level field "oauthAccount"  : object (verbatim from a profile)
  Every other field is preserved byte-for-byte. File mode is preserved.
  Locking via ~/.claude.json.csm.lock (CON-007).
drift_detection:
  mechanism: changelog_watcher
sandbox_or_fixture: not_applicable
auth_scope: |
  File holds OAuth account metadata, not tokens. Tokens live in the
  keychain (EXT-001).
rate_limits: not_applicable
retry/idempotency: |
  patchClaudeJson is idempotent under the lock for any fixed
  (oauthAccount, userID) pair.
error_taxonomy:
  - file missing => exit 1 (csm refuses to bootstrap claude state)
  - file unparseable => exit 1
  - oauthAccount missing on save => exit 1, "not logged in"
last_verified_at: "2026-05-05"
test_obligation:
  predicate: |
    After patch, only the two declared fields differ; round-trip
    preserves every other field; mode is preserved; lock file is
    absent on every exit path.
  test_template: integration
  boundary_classes:
    - file with rich unrelated keys (preserved)
    - file with mode 0600 vs 0644 (preserved)
---
```

## 10. Generated artifacts

None. csm produces a TypeScript build in `dist/` via `tsc`, but the
build output is not a versioned external surface; it is a private
runtime detail. No code-generation step (OpenAPI, GraphQL codegen,
SDK emission) is part of the system.

## 11. Localization

None. csm emits English-only diagnostic strings on a developer-facing
CLI. No `LocalizationContract` exists; `text_is_contract: no` is the
default for every emitted string. Boundary error codes are exposed
through exit codes (CON-002), not text.

## 12. Policies

```yaml
---
id: csm:POL-001
type: Policy
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-05T17:53:19.669Z
    change_request: initial v0.1.0 baseline approval — claude-subscription-manager
    scope: first-time-approval
partition_id: csm
title: token blobs never written outside the macOS Keychain
policy_kind: pii_redaction
applicability:
  applies_to: every Behavior in §6 and every Contract in §7
predicate: |
  The csm process MUST NOT write the byte content of any keychain
  blob (live or profile) to stdout, to stderr, to any file under
  ~/.claude-subscription-manager/, to ~/.claude.json, or to any other
  filesystem path. The only legitimate egress is the argv of a child
  /usr/bin/security invocation (EXT-001), which the macOS process
  table exposes briefly to the same user only.
negative_test_obligations:
  - run each BEH-001..008 happy and failure path while capturing
    stdout/stderr buffers and a recursive snapshot of every file
    modified under the user's HOME; assert no buffer or file content
    contains the bytes of the live or profile keychain blob.
  - run BEH-003 with a sentinel byte sequence as the live keychain
    blob; assert the sequence appears in process argv of the child
    `security add-generic-password` invocation only and nowhere else.
test_obligation:
  predicate: same as negative_test_obligations
  test_template: integration
  boundary_classes: [each BEH path]
  failure_scenarios:
    - any blob substring in captured stdout => violates policy
    - any blob substring in profiles.json => violates policy
---
```

```yaml
---
id: csm:POL-002
type: Policy
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-05T17:53:19.669Z
    change_request: initial v0.1.0 baseline approval — claude-subscription-manager
    scope: first-time-approval
partition_id: csm
title: state directory and metadata files are local-user-only
policy_kind: io_scope
applicability:
  applies_to: every Behavior that creates or rewrites files under
              ~/.claude-subscription-manager/ or ~/.claude.json
predicate: |
  ensureStateDir creates ~/.claude-subscription-manager/ with mode
  0700 and narrows the mode to 0700 if the directory already exists
  with broader bits. profiles.json is written with mode 0600. The
  active marker is written with mode 0600. The temporary file used
  by the atomic-write protocol is created in the same parent
  directory and inherits its mode-restricting umask. The
  ~/.claude.json patch preserves the file's pre-patch mode.
negative_test_obligations:
  - after every BEH-003/004/005/006 invocation, stat() the state
    directory and assert mode 0700.
  - after every BEH-003/004/005/006 invocation, stat() profiles.json
    and active (when present) and assert mode 0600.
  - pre-create the state directory with mode 0755; run BEH-003;
    assert ensureStateDir narrows the mode to 0700.
test_obligation:
  predicate: same as negative_test_obligations
  test_template: integration
  boundary_classes:
    - first save (creates dir)
    - subsequent save (preserves modes)
    - pre-existing dir with loose mode (narrows)
  failure_scenarios:
    - any post-call stat yielding mode > 0700 / > 0600 => violates policy
---
```

```yaml
---
id: csm:POL-003
type: Policy
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-05T17:53:19.669Z
    change_request: initial v0.1.0 baseline approval — claude-subscription-manager
    scope: first-time-approval
partition_id: csm
title: refuse `use` while claude is running, unless --force
policy_kind: concurrency_safety
applicability:
  applies_to: csm:BEH-004
predicate: |
  Before any mutation of the live keychain entry or ~/.claude.json,
  BEH-004 (without --force) MUST invoke EXT-002 and exit 1 when the
  resulting list of running claude processes is non-empty. The exit
  message MUST list each process's PID and basename and direct the
  user to quit those sessions or pass --force.
  --force MUST NOT be inferred; it MUST be supplied explicitly on argv.
negative_test_obligations:
  - start a long-lived process whose argv matches the EXT-002 pattern
    and is not a csm self-process; run BEH-004 without --force;
    assert exit 1, no mutation of either ~/.claude.json or the live
    keychain entry, and the PID list is printed to stderr.
  - start the same process; run BEH-004 with --force; assert exit 0
    and the swap completes.
test_obligation:
  predicate: same as negative_test_obligations
  test_template: integration
  boundary_classes:
    - no claude running (proceeds)
    - one claude running, no --force (refused)
    - one claude running, --force (proceeds)
  failure_scenarios:
    - mutation observed when claude was running and --force was absent
      => violates policy
---
```

## 13. Constraints

```yaml
---
id: csm:CST-001
type: Constraint
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-05T17:53:19.732Z
    change_request: initial v0.1.0 baseline approval — claude-subscription-manager
    scope: first-time-approval
partition_id: csm
constraint: |
  Runtime platform is macOS only. csm depends on /usr/bin/security
  (EXT-001) and /usr/bin/pgrep (EXT-002), which are not available on
  Linux or Windows in compatible form.
rationale: |
  The macOS Keychain is the storage Claude Code itself uses on
  macOS; csm exists to manage that storage. Cross-platform support is
  scoped out (see §18) and tracked as csm:OQ-003.
test_obligation:
  predicate: |
    csm refuses to start (or surfaces a clear error) on a non-macOS
    platform; the README documents macOS as a hard requirement.
  test_template: contract
  boundary_classes:
    - macOS host (operates normally)
    - Linux host (security/pgrep paths missing => spawn ENOENT,
      surfaced as Error from keychain.ts/procCheck.ts)
  failure_scenarios:
    - any silent fallback to file-only credential storage => violates CST
---
```

```yaml
---
id: csm:CST-002
type: Constraint
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-05T17:53:19.732Z
    change_request: initial v0.1.0 baseline approval — claude-subscription-manager
    scope: first-time-approval
partition_id: csm
constraint: |
  Node runtime must be >= 18.17 (engines.node = ">=18.17").
rationale: |
  csm uses node:util.parseArgs (added in Node 18.3) and stable ESM
  resolution semantics (NodeNext). 18.17 is the conservative LTS
  pin used by the package manifest.
test_obligation:
  predicate: |
    package.json#engines.node equals ">=18.17" verbatim. Any drift
    (e.g. ">=16" or removal of the engines block) fails the test.
  test_template: contract
  boundary_classes:
    - canonical package.json
  failure_scenarios:
    - engines.node missing or downgraded
---
```

```yaml
---
id: csm:CST-003
type: Constraint
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-05T17:53:19.732Z
    change_request: initial v0.1.0 baseline approval — claude-subscription-manager
    scope: first-time-approval
partition_id: csm
constraint: |
  csm has zero runtime dependencies. package.json#dependencies is
  absent or empty; only devDependencies are allowed (typescript,
  @types/node).
rationale: |
  Auditability and minimal supply-chain surface for a tool that
  reads OAuth credentials. Built-in node: modules cover every need
  (child_process, fs/promises, os, path, util, crypto, readline/promises).
test_obligation:
  predicate: |
    package.json#dependencies is absent or equals {}. The set of
    devDependencies is a subset of {typescript, @types/node}.
  test_template: contract
  boundary_classes:
    - canonical package.json
  failure_scenarios:
    - any non-empty dependencies map => violates CST
    - devDependencies introduces a runtime-shipped package
---
```

```yaml
---
id: csm:CST-004
type: Constraint
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-05T17:53:19.732Z
    change_request: initial v0.1.0 baseline approval — claude-subscription-manager
    scope: first-time-approval
partition_id: csm
constraint: |
  Source layout follows Vertical Slice + Hexagonal architecture:

  src/
    cli.ts                       # composition root
    shared/
      domain/                    # cross-slice primitives (ProfileName,
                                 #   ProfileMetadata)
    features/
      list/
        domain/
        application/
        ports/inbound/
        ports/outbound/
        adapters/inbound/
        adapters/outbound/
      status/    { same shape }
      save/      { same shape }
      use/       { same shape }
      rm/        { same shape }
      rename/    { same shape }
      add/       { same shape }

  Dependency direction inside each slice: adapters -> ports ->
  application -> domain. A slice MUST NOT import another slice's
  internals; cross-slice primitives live in src/shared/domain.
  The tree MUST NOT contain global layer folders src/commands/,
  src/keychain.ts, src/claudeJson.ts, src/store.ts, src/procCheck.ts
  at the top level — those are outbound adapters owned by the slices
  that need them.
rationale: |
  Aligns with @rules/architecture.md (the user's global discipline
  for backend code). The current src/ layout is layer-based and
  violates this constraint; migration is tracked as csm:OQ-001
  (blocking).
test_obligation:
  predicate: |
    A directory walk over src/ matches the layout above; no module
    import graph crosses a slice boundary except through
    src/shared/domain; cli.ts depends only on slice inbound ports.
  test_template: contract
  boundary_classes:
    - canonical src/ layout
    - new slice introduced with the documented sub-tree
  failure_scenarios:
    - any top-level file under src/ other than cli.ts
    - any cross-slice import outside src/shared/domain
---
```

## 14. Migrations

None. csm has no data-at-rest migration in this initial spec; the
`profiles.json` schema is at `version: 1` from inception. Future
schema bumps will be authored as `Migration` blocks here.

## 15. Deltas

None. This spec is the initial baseline; every preserved behavior is
authored directly as `Behavior`/`Invariant`/`Contract`. Subsequent
PRs that change behavior will introduce `Delta` blocks pinned to
`baseline_version: csm:BL-001`.

## 16. Implementation bindings

None at the partition level. Internal file-to-ID bindings are
intentionally omitted in v0.1.0: the layout is in flux (csm:OQ-001
tracks the Vertical Slice + Hexagonal refactor). Bindings will be
added once `csm:CST-004` is satisfied; until then the spec is
explicitly layout-independent (SDD §3.2).

## 17. Open questions

```yaml
---
id: csm:OQ-001
type: Open-Q
lifecycle:
  status: proposed
partition_id: csm
question: |
  Refactor src/ to satisfy csm:CST-004 (Vertical Slice + Hexagonal)
  before promoting boundary-binding behaviors to `approved`?
options:
  - label: refactor_then_approve
    consequence: |
      Block promotion of BEH-001..008, INV-001..005 to `approved`
      until src/ matches CST-004; introduce features/<name>/ slices,
      relocate keychain.ts/claudeJson.ts/store.ts/procCheck.ts into
      slice-local outbound adapters, dissolve commands/ into per-slice
      inbound adapters. One-time refactor PR with green tests.
  - label: approve_now_refactor_later
    consequence: |
      Promote behaviors against the current layer-based layout;
      treat CST-004 as aspirational; csm:OQ-001 stays open as a
      structural-debt marker. Risks normalising the violation in
      future PRs.
  - label: relax_cst004
    consequence: |
      Demote CST-004 to a non-binding note; document that csm is
      small enough to skip Vertical Slice + Hexagonal. Conflicts
      with the user's @rules/architecture.md global discipline.
blocking: yes
owner: cyberash
---
```

```yaml
---
id: csm:OQ-002
type: Open-Q
lifecycle:
  status: proposed
partition_id: csm
question: |
  Should csm ship a `claude-sub repair` subcommand that detects
  desync between ~/.claude.json and the live keychain entry, and
  offers to rewrite ~/.claude.json from the active profile's
  recorded oauthAccount?
options:
  - label: ship_repair_v0_1_1
    consequence: |
      Add BEH-009 + a new subcommand on csm:SUR-001; minor bump.
      Reduces manual recovery burden after partial-failure swaps.
  - label: defer_to_v0_2
    consequence: |
      Keep `status` as the desync detector; users re-run
      `claude-sub use <name>` to recover. Smaller v0.1 surface.
blocking: no
owner: cyberash
default_if_unresolved: defer_to_v0_2
---
```

```yaml
---
id: csm:OQ-003
type: Open-Q
lifecycle:
  status: proposed
partition_id: csm
question: |
  Add Linux/Windows support? Linux Claude Code uses libsecret /
  Secret Service; Windows uses Credential Manager. csm currently
  hard-codes /usr/bin/security and /usr/bin/pgrep.
options:
  - label: stay_macos_only
    consequence: |
      CST-001 stands; csm refuses to start on non-macOS. Smallest
      surface.
  - label: abstract_via_port
    consequence: |
      Promote KeychainPort + ProcessInspectorPort; ship Linux
      libsecret adapter and Windows Credential Manager adapter.
      Triples integration-test surface; introduces an explicit
      Linux/Windows acceptance gate.
blocking: no
owner: cyberash
default_if_unresolved: stay_macos_only
---
```

## 18. Assumptions

```yaml
---
id: csm:ASM-001
type: ASSUMPTION
lifecycle:
  status: proposed
partition_id: csm
assumption: |
  At most one csm process runs concurrently per user. The lock at
  ~/.claude.json.csm.lock guards the JSON patch (CON-007), but the
  keychain swap step in BEH-004 has no inter-process lock — two
  concurrent `claude-sub use` invocations could interleave their
  keychain writes.
source_open_q: null
blocking: no
review_by: "2026-08-05"
default_if_unresolved: |
  Document the single-process assumption in README; do not add a
  cross-process lock. Two concurrent csm runs are an unusual workflow
  and would only mis-order which profile becomes active.
tests:
  - csm:BEH-004
  - csm:INV-005
---
```

```yaml
---
id: csm:ASM-002
type: ASSUMPTION
lifecycle:
  status: proposed
partition_id: csm
assumption: |
  The user has either granted "Always Allow" for the live keychain
  entry "Claude Code-credentials" once (Claude Code itself triggers
  the prompt on first run), or accepts UI prompts during csm
  invocations. csm does not request elevated keychain ACLs.
source_open_q: null
blocking: no
review_by: "2026-08-05"
default_if_unresolved: |
  Document the prompt behavior in README. csm cannot bypass macOS
  keychain ACL without compromising the user's security model.
tests:
  - csm:BEH-003
  - csm:BEH-004
---
```

```yaml
---
id: csm:ASM-003
type: ASSUMPTION
lifecycle:
  status: proposed
partition_id: csm
assumption: |
  ~/.claude.json#oauthAccount.subscriptionType is absent today; csm
  falls back to oauthAccount.billingType, then to seatTier, when
  populating ProfileMetadata.subscriptionType. If Anthropic adds an
  explicit subscriptionType field to oauthAccount in a future Claude
  Code release, csm will pick it up automatically.
source_open_q: null
blocking: no
review_by: "2026-08-05"
default_if_unresolved: |
  Keep the fallback chain (subscriptionType -> billingType ->
  seatTier -> empty string). The displayed value is informational
  for `list`/`status`; it is not load-bearing for the swap logic.
tests:
  - csm:BEH-003
  - csm:CON-005
---
```

## 19. Out of scope

- Linux and Windows runtime support (tracked as csm:OQ-003).
- Anthropic Console / API-key authentication (`claude auth login
  --console`). csm reads and writes only the `claude.ai` OAuth
  account state.
- Multiple keychain accounts on a single workstation. csm uses
  `os.userInfo().username` as the keychain account; multi-user host
  configurations are not modelled.
- Encrypting `profiles.json` beyond filesystem-permission isolation.
  Tokens never live in this file (POL-001); the metadata it holds
  (email, orgName, accountUuid) is non-secret.
- Automating `claude auth login`. The OAuth flow opens a browser; csm
  cannot drive it. `claude-sub add` instructs the user to run the
  command interactively (BEH-007).
- Killing running `claude` processes during `use`. csm refuses with a
  PID list (POL-003); the user terminates them.
- Detecting or recovering from a `~/.claude.json` schema change in
  fields csm does not mutate. csm preserves unknown fields verbatim
  (CON-007); structural changes to those fields are Claude Code's
  responsibility.
- Maintaining historical revisions of profiles. Each profile holds a
  single current snapshot; older snapshots are overwritten on
  auto-snapshot during `use` (BEH-004).
- Cross-machine profile sync. csm operates on the local Keychain and
  local filesystem only; bringing profiles to another machine
  requires manual export of both the keychain entries and
  profiles.json by the user.

