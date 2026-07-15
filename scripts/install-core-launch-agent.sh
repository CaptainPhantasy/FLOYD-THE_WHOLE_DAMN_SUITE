#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
SOURCE="$ROOT/com.floyd.core.plist"
AGENT_DIR="$HOME/Library/LaunchAgents"
TARGET="$AGENT_DIR/com.floyd.core.plist"
LOG_DIR="$HOME/Library/Logs/floyd"
DOMAIN="gui/$(id -u)"
LABEL="com.floyd.core"
TOKEN_FILE=${FLOYD_GATEWAY_TOKEN_FILE:-/Volumes/Storage/FLOYD_RUNTIME/core/gateway.token}

/usr/bin/plutil -lint "$SOURCE" >/dev/null
node_path=$(/usr/libexec/PlistBuddy -c "Print :ProgramArguments:0" "$SOURCE")
entrypoint=$(/usr/libexec/PlistBuddy -c "Print :ProgramArguments:1" "$SOURCE")
test -x "$node_path"
test -f "$entrypoint"
test -r "$TOKEN_FILE"

mkdir -p "$AGENT_DIR" "$LOG_DIR"
install -m 600 "$SOURCE" "$TARGET"

launchctl bootout "$DOMAIN/$LABEL" >/dev/null 2>&1 || true
attempt=0
while launchctl print "$DOMAIN/$LABEL" >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 50 ]; then
    printf 'launchd did not release %s\n' "$LABEL" >&2
    exit 1
  fi
  sleep 0.1
done

launchctl bootstrap "$DOMAIN" "$TARGET"

attempt=0
until token=$(tr -d '\r\n' < "$TOKEN_FILE") \
  && curl -fsS --max-time 2 -H "Authorization: Bearer $token" \
    http://127.0.0.1:41414/api/health >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 80 ]; then
    printf 'Floyd Core did not become healthy; inspect %s/core.err.log\n' "$LOG_DIR" >&2
    exit 1
  fi
  sleep 0.25
done

pid=$(launchctl print "$DOMAIN/$LABEL" | sed -n 's/^[[:space:]]*pid = //p' | sed -n '1p')
printf 'CORE_LAUNCH_AGENT PASS label=%s pid=%s plist=%s\n' "$LABEL" "$pid" "$TARGET"
