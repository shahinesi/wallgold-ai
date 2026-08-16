#!/usr/bin/env bash
set -euo pipefail

# Codespaces bootstrap for ChatGPT OAuth testing.
# The public port is protected by OAuth; WallGold API keys are entered only on the
# server-hosted authorization page and are kept in memory, never in ChatGPT tool inputs.

if pgrep -f "tsx src/server.ts" >/dev/null 2>&1; then
  echo "WallGold MCP is already running."
  exit 0
fi

export MCP_OAUTH_ENABLED=true
export ALLOW_UNAUTHENTICATED_MCP=false
export WALLGOLD_MCP_ALLOW_TRADE_EXECUTION=false
export PRIVATE_EXECUTION_ENABLED=false

nohup npm run dev >/tmp/wallgold-mcp.log 2>&1 &
echo $! >/tmp/wallgold-mcp.pid

for _ in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:3000/health >/dev/null 2>&1; then
    echo "WallGold MCP is ready on port 3000 with OAuth enabled."
    echo "Health: http://127.0.0.1:3000/health"
    echo "MCP:    http://127.0.0.1:3000/mcp"
    echo "Make port 3000 Public, then configure the ChatGPT plugin with Authentication = OAuth."
    echo "Do NOT put WALLGOLD_API_KEY in Codespaces env for this OAuth flow."
    exit 0
  fi
  sleep 1
done

echo "WallGold MCP did not become healthy. Recent log output:"
tail -n 80 /tmp/wallgold-mcp.log || true
exit 1
