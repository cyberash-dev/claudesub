#!/usr/bin/env bash
# Approve every normative ID in spec/spec.md as the human owner, then finalize.
#
# Run as yourself (NOT as the agent — sdd-cli rejects agent identities per
# the self-approval ban). Defaults assume cyberash; override via env vars.
#
# Usage:
#   ./scripts/approve-all.sh
#   SDD_APPROVER=alice SDD_ROLE=tech-lead ./scripts/approve-all.sh
#   SDD_CHANGE_REQUEST="https://github.com/cyberash/claude-subscription-manager/pull/1" ./scripts/approve-all.sh

set -euo pipefail

cd "$(dirname "$0")/.."

APPROVER="${SDD_APPROVER:-cyberash}"
ROLE="${SDD_ROLE:-partition_owner}"
CR="${SDD_CHANGE_REQUEST:-initial v0.1.0 baseline approval — claude-subscription-manager}"

echo "Approver:       $APPROVER"
echo "Owner role:     $ROLE"
echo "Change request: $CR"
echo

approve() {
  local id_glob="$1"
  echo "==> approve $id_glob"
  sdd approve \
    --id "$id_glob" \
    --approver "$APPROVER" \
    --owner-role "$ROLE" \
    --change-request "$CR" \
    --scope first-time-approval
}

# Brownfield baseline first — finalize wants the baseline approved before
# anything that pins to it.
approve "csm:BL-001"

# Surfaces, behaviors, contracts, invariants, external deps.
approve "csm:SUR-*"
approve "csm:CON-*"
approve "csm:BEH-*"
approve "csm:INV-*"
approve "csm:EXT-*"

# Policies and constraints.
approve "csm:POL-*"
approve "csm:CST-*"

echo
echo "==> pending plans"
sdd plan show

echo
echo "==> sdd finalize"
sdd finalize

echo
echo "==> sdd lint"
sdd lint

echo
echo "==> sdd ready"
# `ready` will now report [uncovered] for every approved ID until tests with
# `// @covers csm:<id>` markers exist. That is expected — exit 1 here is OK.
sdd ready || true

echo
echo "Done. Approved IDs are now lifecycle.status=approved in spec/spec.md."
