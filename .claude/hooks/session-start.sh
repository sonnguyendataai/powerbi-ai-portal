#!/usr/bin/env bash
# session-start.sh — SessionStart hook. Prints a one-screen status banner
# with the most relevant project context. Stdout is injected into the
# agent's session as supplementary context.

set -uo pipefail

ENV_PROFILE="${PORTAL_ENV:-${APP_ENV:-dev}}"
PBI_BASE="${POWERBI_API_BASE_URL:-https://api.powerbi.com/v1.0/myorg}"

ANTHROPIC_STATUS="unset"
if [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then
  ANTHROPIC_STATUS="set (${ANTHROPIC_MODEL:-default model})"
fi

DB_STATUS="file-backed (${BI_OPS_STORE_FILE:-./data/bi-ops.json})"
if [[ -n "${DATABASE_URL:-}${POSTGRES_URL:-}" ]]; then
  DB_STATUS="postgres"
fi

GIT_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '(no git)')"
GIT_DIRTY=""
if git diff --quiet 2>/dev/null && git diff --cached --quiet 2>/dev/null; then
  GIT_DIRTY="clean"
else
  GIT_DIRTY="dirty"
fi

cat <<EOF
pbi-ai-portal — session start
─────────────────────────────────
Env profile:     ${ENV_PROFILE}
Power BI API:    ${PBI_BASE}
Anthropic:       ${ANTHROPIC_STATUS}
BI ops store:    ${DB_STATUS}
Git branch:      ${GIT_BRANCH} (${GIT_DIRTY})

Quick docs:      AGENTS.md
Architecture:    docs/architecture/
Runbooks:        docs/runbooks/
Web app:         apps/web/src/
EOF
exit 0
