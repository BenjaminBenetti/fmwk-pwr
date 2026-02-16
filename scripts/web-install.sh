#!/usr/bin/env bash
#
# fmwk-pwr web installer
# Usage: curl -fsSL https://raw.githubusercontent.com/BenjaminBenetti/fmwk-pwr/main/scripts/web-install.sh | sudo bash
#
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

info()    { echo -e "${BLUE}::${NC} $*"; }
success() { echo -e "${GREEN}::${NC} $*"; }
error()   { echo -e "${RED}:: ERROR:${NC} $*" >&2; }

if [[ $EUID -ne 0 ]]; then
  error "This installer must be run as root."
  echo "  Usage: curl -fsSL https://raw.githubusercontent.com/BenjaminBenetti/fmwk-pwr/main/scripts/web-install.sh | sudo bash"
  exit 1
fi

# Check for git
if ! command -v git >/dev/null 2>&1; then
  error "git is required but not installed."
  exit 1
fi

CLONE_DIR="$(mktemp -d /tmp/fmwk-pwr-install.XXXXXX)"
trap 'rm -rf "$CLONE_DIR"' EXIT

echo -e "\n${BOLD}fmwk-pwr installer${NC}\n"

info "Cloning fmwk-pwr to $CLONE_DIR..."
git clone --depth 1 https://github.com/BenjaminBenetti/fmwk-pwr.git "$CLONE_DIR"

info "Running install script..."
bash "$CLONE_DIR/scripts/install.sh"
