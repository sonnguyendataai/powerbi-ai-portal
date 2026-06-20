#!/usr/bin/env bash
# prompt-router.sh — UserPromptSubmit hook. If the user's prompt mentions
# certain keywords, append a relevant reference doc to the agent's context.
# Idempotent — only injects when keywords match and the doc exists.

set -uo pipefail

PAYLOAD="$(cat)"
PROMPT="$(printf '%s' "$PAYLOAD" | python3 -c '
import json, sys
try:
    p = json.load(sys.stdin)
except Exception:
    sys.exit(0)
v = None
if isinstance(p, dict):
    v = p.get("prompt") or p.get("user_message") or p.get("message")
if isinstance(v, str):
    print(v)
')"

if [[ -z "${PROMPT:-}" ]]; then
  exit 0
fi

inject() {
  local file="$1"
  if [[ -f "$file" ]]; then
    echo
    echo "--- BEGIN INJECTED: $file ---"
    cat "$file"
    echo "--- END INJECTED: $file ---"
  fi
}

shopt -s nocasematch || true

if [[ "$PROMPT" =~ (deploy|release|production|prod\ rollout) ]]; then
  inject "docs/runbooks/production-go-live.md"
  inject "docs/runbooks/vercel-deployment.md"
fi

if [[ "$PROMPT" =~ (incident|outage|on\ ?call|hardening) ]]; then
  inject "docs/runbooks/enterprise-hardening.md"
fi

if [[ "$PROMPT" =~ (slo|finops|cost|rate\ limit) ]]; then
  inject "docs/runbooks/slo-finops.md"
fi

if [[ "$PROMPT" =~ (policy|compliance|security\ review) ]]; then
  inject "docs/security/policy-matrix.md"
  inject "docs/security/compliance-checklist.md"
fi

exit 0
