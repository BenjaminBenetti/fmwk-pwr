#!/usr/bin/env bash
#
# Uninstall fmwk-pwr from the system.
# Must be run as root (sudo).
#
# Usage:
#   sudo ./scripts/uninstall.sh              # interactive (asks about config)
#   sudo ./scripts/uninstall.sh --keep-config # preserve /etc/fmwk-pwr
#   sudo ./scripts/uninstall.sh --purge       # remove everything including config
#   sudo ./scripts/uninstall.sh --yes         # skip confirmation prompt
#
set -euo pipefail

# =========================================
# Constants
# =========================================

INSTALL_DIR="/usr/lib/fmwk-pwr"
CONFIG_DIR="/etc/fmwk-pwr"
SYSTEMD_UNIT="/etc/systemd/system/fmwk-pwr.service"
DESKTOP_ENTRY="/usr/share/applications/fmwk-pwr.desktop"
GNOME_EXT_DIR="/usr/share/gnome-shell/extensions/fmwk-pwr@fmwk-pwr"
GUI_WRAPPER="/usr/bin/fmwk-pwr-gui"

# =========================================
# Colors
# =========================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

info()    { echo -e "${BLUE}::${NC} $*"; }
success() { echo -e "${GREEN}::${NC} $*"; }
warn()    { echo -e "${YELLOW}:: WARNING:${NC} $*"; }
error()   { echo -e "${RED}:: ERROR:${NC} $*" >&2; }
step()    { echo -e "\n${BOLD}==> $*${NC}"; }

# =========================================
# Parse arguments
# =========================================

KEEP_CONFIG=""
SKIP_CONFIRM=false

for arg in "$@"; do
  case "$arg" in
    --keep-config) KEEP_CONFIG=yes ;;
    --purge)       KEEP_CONFIG=no ;;
    --yes|-y)      SKIP_CONFIRM=true ;;
    --help|-h)
      echo "Usage: sudo $0 [--keep-config | --purge] [--yes]"
      echo ""
      echo "  --keep-config   Preserve /etc/fmwk-pwr/ (profiles and config)"
      echo "  --purge         Remove everything including /etc/fmwk-pwr/"
      echo "  --yes, -y       Skip confirmation prompt"
      exit 0
      ;;
    *)
      error "Unknown option: $arg"
      echo "Run '$0 --help' for usage."
      exit 1
      ;;
  esac
done

# =========================================
# Pre-flight checks
# =========================================

if [[ $EUID -ne 0 ]]; then
  error "This script must be run as root (use sudo)."
  exit 1
fi

# =========================================
# Confirmation
# =========================================

echo -e "${BOLD}fmwk-pwr uninstaller${NC}"
echo ""
echo "This will remove the following:"
echo "  - systemd service:    $SYSTEMD_UNIT"
echo "  - Application files:  $INSTALL_DIR/"
echo "  - GUI wrapper:        $GUI_WRAPPER"
echo "  - Desktop entry:      $DESKTOP_ENTRY"
echo "  - GNOME extension:    $GNOME_EXT_DIR/"
if [[ "$KEEP_CONFIG" == "no" ]]; then
  echo "  - Config & profiles:  $CONFIG_DIR/"
elif [[ "$KEEP_CONFIG" != "yes" ]]; then
  echo "  - Config & profiles:  (will ask)"
fi
echo ""

if [[ "$SKIP_CONFIRM" != true ]]; then
  read -r -p "Continue with uninstall? [y/N] " response
  case "$response" in
    [yY][eE][sS]|[yY]) ;;
    *)
      echo "Aborted."
      exit 0
      ;;
  esac
fi

# =========================================
# Step 1: Stop and disable systemd service
# =========================================

step "Stopping systemd service"

if systemctl is-active --quiet fmwk-pwr.service 2>/dev/null; then
  systemctl stop fmwk-pwr.service
  success "Service stopped."
else
  info "Service not running."
fi

if systemctl is-enabled --quiet fmwk-pwr.service 2>/dev/null; then
  systemctl disable fmwk-pwr.service
  success "Service disabled."
else
  info "Service not enabled."
fi

# =========================================
# Step 2: Remove systemd unit
# =========================================

step "Removing systemd unit"

if [[ -f "$SYSTEMD_UNIT" ]]; then
  rm -f "$SYSTEMD_UNIT"
  systemctl daemon-reload
  success "Removed $SYSTEMD_UNIT"
else
  info "Unit file not found, skipping."
fi

# =========================================
# Step 3: Remove application files
# =========================================

step "Removing application files"

if [[ -d "$INSTALL_DIR" ]]; then
  rm -rf "$INSTALL_DIR"
  success "Removed $INSTALL_DIR/"
else
  info "$INSTALL_DIR/ not found, skipping."
fi

# =========================================
# Step 4: Remove GUI wrapper
# =========================================

step "Removing GUI wrapper"

if [[ -f "$GUI_WRAPPER" ]]; then
  rm -f "$GUI_WRAPPER"
  success "Removed $GUI_WRAPPER"
else
  info "$GUI_WRAPPER not found, skipping."
fi

# =========================================
# Step 5: Remove desktop entry
# =========================================

step "Removing desktop entry"

if [[ -f "$DESKTOP_ENTRY" ]]; then
  rm -f "$DESKTOP_ENTRY"
  if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database /usr/share/applications 2>/dev/null || true
  fi
  success "Removed $DESKTOP_ENTRY"
else
  info "Desktop entry not found, skipping."
fi

# =========================================
# Step 6: Remove GNOME extension
# =========================================

step "Removing GNOME extension"

if [[ -d "$GNOME_EXT_DIR" ]]; then
  rm -rf "$GNOME_EXT_DIR"
  success "Removed $GNOME_EXT_DIR/"
else
  info "GNOME extension not found, skipping."
fi

# =========================================
# Step 7: Remove config (conditional)
# =========================================

step "Config and profiles"

if [[ -d "$CONFIG_DIR" ]]; then
  if [[ -z "$KEEP_CONFIG" ]]; then
    # Interactive: ask the user
    read -r -p "Remove config and profiles ($CONFIG_DIR/)? [y/N] " response
    case "$response" in
      [yY][eE][sS]|[yY]) KEEP_CONFIG=no ;;
      *) KEEP_CONFIG=yes ;;
    esac
  fi

  if [[ "$KEEP_CONFIG" == "no" ]]; then
    rm -rf "$CONFIG_DIR"
    success "Removed $CONFIG_DIR/"
  else
    info "Preserving $CONFIG_DIR/"
  fi
else
  info "$CONFIG_DIR/ not found, skipping."
fi

# =========================================
# Done
# =========================================

echo ""
echo -e "${GREEN}${BOLD}Uninstall complete.${NC}"
if [[ "${KEEP_CONFIG:-}" == "yes" ]]; then
  echo -e "  Config preserved at: $CONFIG_DIR/"
fi
echo ""
