#!/usr/bin/env bash
set -euo pipefail

# Codespaces bootstrap for the initial ChatGPT developer-mode connection test.
# This intentionally starts the MCP without authentication ONLY while:
# - no WallGold API key is configured,
# - private execution is disabled,
# - the forwarded port remains private until the developer explicitly makes it public.

if pgrep -f "tsx src/server.ts" >/dev/null 2>&1; then
  echo "WallGold MCP is already running."
  exit 0
fi

nohup npm run dev >/tmp/wallgold-mcp.log 2>&1 &
echo $! >/tmp/wallgold-mcp.pid

for _ in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:3000/health >/dev/null 2>&1; then
    echo "WallGold MCP is ready on port 3000."
    echo "Health: http://127.0.0.1:3000/health"
    echo "MCP:    http://127.0.0.1:3000/mcp"
    echo "For the first ChatGPT discovery test, make port 3000 Public from the Codespaces PORTS panel."
    echo "Do NOT configure WALLGOLD_API_KEY until OAuth/authentication is added."
    exit 0
  fi
  sleep 1
done

echo "WallGold MCP did not become healthy. Recent log output:"
tail -n 80 /tmp/wallgold-mcp.log || true
exit 1
