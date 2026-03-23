#!/usr/bin/env bash
# Install the tendy Claude skill so agents can use the MCP server.
# Run from anywhere: bash .claude/skills/tendy/install.sh
set -e

SKILL_DIR="$HOME/.claude/skills/tendy"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

mkdir -p "$SKILL_DIR"
cp "$SCRIPT_DIR/SKILL.md" "$SKILL_DIR/SKILL.md"

echo "✓ Tendy skill installed at $SKILL_DIR/SKILL.md"
echo "  Restart Claude Code / your MCP client to pick it up."
