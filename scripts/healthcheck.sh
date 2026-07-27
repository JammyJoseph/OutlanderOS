#!/bin/bash
# OutlanderOS watchdog.
#
# Polls the app's own /api/health endpoint and reacts when it stops being
# healthy. Runs from cron on the server; see docs/RUNBOOK.md.
#
# Exists because the app runs as a single pm2 process on one box with nothing
# watching it — a crash or a dead database was previously invisible until
# somebody tried to use the portal and found it broken.
#
# Optional: set ALERT_WEBHOOK_URL (Slack/Discord/any JSON webhook) in
# /etc/outlanderos-watchdog.env to get pushed alerts instead of only a log file.

set -uo pipefail

HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/api/health}"
LOG_FILE="${LOG_FILE:-/var/log/outlanderos-health.log}"
STATE_FILE="${STATE_FILE:-/var/run/outlanderos-health.state}"
PM2_APP="${PM2_APP:-outlanderos}"

[ -f /etc/outlanderos-watchdog.env ] && . /etc/outlanderos-watchdog.env

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE"; }

alert() {
  local msg="$1"
  log "ALERT: $msg"
  if [ -n "${ALERT_WEBHOOK_URL:-}" ]; then
    curl -s -m 10 -X POST "$ALERT_WEBHOOK_URL" \
      -H 'Content-Type: application/json' \
      -d "{\"text\":\"OutlanderOS: ${msg}\"}" > /dev/null 2>&1 \
      || log "  (webhook delivery failed)"
  fi
}

# Only alert on a state *change*, so a prolonged outage doesn't spam every minute.
previous="unknown"
[ -f "$STATE_FILE" ] && previous="$(cat "$STATE_FILE" 2>/dev/null || echo unknown)"
record() { echo "$1" > "$STATE_FILE"; }

body="$(curl -s -m 15 -w '\n%{http_code}' "$HEALTH_URL" 2>/dev/null)"
code="$(printf '%s' "$body" | tail -1)"
json="$(printf '%s' "$body" | sed '$d')"

if [ "$code" != "200" ]; then
  if [ "$previous" != "down" ]; then
    alert "health check FAILED (HTTP ${code:-no response}) — attempting pm2 restart"
  fi
  record down
  # Only restart if pm2 says it isn't online; don't fight a healthy-but-slow boot.
  if ! pm2 pid "$PM2_APP" > /dev/null 2>&1 || [ -z "$(pm2 pid "$PM2_APP" 2>/dev/null)" ]; then
    pm2 restart "$PM2_APP" > /dev/null 2>&1 && log "pm2 restart issued"
  fi
  exit 1
fi

# Parse with node, not sed. A greedy regex here matched the LAST "status" in the
# payload (database.status) instead of the top-level one, reporting a healthy app
# as degraded.
status="$(printf '%s' "$json" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(String(JSON.parse(s).status||"unparseable"))}catch{process.stdout.write("unparseable")}})' 2>/dev/null)"

if [ "$status" = "ok" ]; then
  [ "$previous" != "ok" ] && alert "recovered — health is ok"
  record ok
  exit 0
fi

if [ "$previous" != "degraded" ]; then
  alert "health is DEGRADED (database unreachable?) — $(printf '%s' "$json" | head -c 200)"
fi
record degraded
exit 1
