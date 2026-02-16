#!/usr/bin/env bash
#
# Install fmwk-pwr system-wide.
# Must be run as root (sudo) from the project source tree.
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

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

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
# Pre-flight checks
# =========================================

if [[ $EUID -ne 0 ]]; then
  error "This script must be run as root (use sudo)."
  exit 1
fi

if [[ ! -f "$PROJECT_DIR/package.json" ]]; then
  error "Cannot find project root. Run this script from the fmwk-pwr source tree."
  exit 1
fi


# =========================================
# Detect distro
# =========================================

detect_distro() {
  if [[ -f /etc/os-release ]]; then
    # shellcheck source=/dev/null
    . /etc/os-release
    case "$ID" in
      fedora|rhel|centos) echo "fedora" ;;
      debian|ubuntu|linuxmint|pop) echo "debian" ;;
      arch|manjaro|endeavouros) echo "arch" ;;
      *)
        case "${ID_LIKE:-}" in
          *fedora*|*rhel*) echo "fedora" ;;
          *debian*|*ubuntu*) echo "debian" ;;
          *arch*) echo "arch" ;;
          *) echo "unknown" ;;
        esac
        ;;
    esac
  else
    echo "unknown"
  fi
}

DISTRO=$(detect_distro)
if [[ "$DISTRO" == "unknown" ]]; then
  error "Unsupported distro. Detected ID: $(grep '^ID=' /etc/os-release 2>/dev/null || echo 'N/A')"
  exit 1
fi

info "Detected distro: ${BOLD}${DISTRO}${NC}"

# =========================================
# Step 1: Check runtime dependencies
# =========================================

step "Installing bun runtime"

BUN="$INSTALL_DIR/bin/bun"
BUNX="$INSTALL_DIR/bin/bunx"

if [[ -x "$BUN" ]]; then
  info "bun already installed at $BUN"
else
  # Bun installer needs unzip
  if ! command -v unzip >/dev/null 2>&1; then
    info "Installing unzip..."
    case "$DISTRO" in
      fedora) dnf install -y unzip ;;
      debian) apt-get install -y unzip ;;
      arch)   pacman -S --noconfirm unzip ;;
    esac
  fi

  info "Installing bun to $INSTALL_DIR/bin/..."
  BUN_INSTALL="$INSTALL_DIR" bash <(curl -fsSL https://bun.sh/install)
fi

if [[ ! -x "$BUN" ]]; then
  error "Failed to install bun."
  exit 1
fi

# Ensure subshells (e.g. bun run scripts) can find bun
export PATH="$INSTALL_DIR/bin:$PATH"

info "bun $($BUN --version) ($BUN)"

# =========================================
# Step 2: Build libryzenadj
# =========================================

step "Checking libryzenadj"

if [[ -f "$INSTALL_DIR/libryzenadj.so" ]]; then
  info "libryzenadj.so already installed, skipping build."
else
  info "Building libryzenadj..."
  bash "$SCRIPT_DIR/install-libryzenadj.sh"
fi

# =========================================
# Step 3: Install project dependencies
# =========================================

step "Installing project dependencies"

cd "$PROJECT_DIR"
"$BUN" install --frozen-lockfile 2>/dev/null || "$BUN" install

# =========================================
# Step 4: Build GUI
# =========================================

step "Building GUI"

"$BUN" run --cwd "$PROJECT_DIR/packages/gui" build
success "GUI built."

# =========================================
# Step 5: Build GNOME extension
# =========================================

step "Building GNOME extension"

cd "$PROJECT_DIR/packages/gnome-extension"
"$BUNX" tsc
cp src/metadata.json src/stylesheet.css dist/
cd "$PROJECT_DIR"
success "GNOME extension built."

# =========================================
# Step 6: Install server + shared packages
# =========================================

step "Installing server to $INSTALL_DIR"

mkdir -p "$INSTALL_DIR"

# Copy server source (runs TS directly via bun)
rm -rf "$INSTALL_DIR/server"
cp -r "$PROJECT_DIR/packages/server" "$INSTALL_DIR/server"

# Copy shared types (workspace dependency)
rm -rf "$INSTALL_DIR/shared"
cp -r "$PROJECT_DIR/packages/shared" "$INSTALL_DIR/shared"

# Create a minimal package.json for the installed server
cat > "$INSTALL_DIR/package.json" << 'EOF'
{
  "name": "fmwk-pwr-installed",
  "private": true,
  "workspaces": ["server", "shared"]
}
EOF

# Install production dependencies
info "Installing server dependencies..."
cd "$INSTALL_DIR"
"$BUN" install
cd "$PROJECT_DIR"

success "Server installed."

# =========================================
# Step 7: Install config files
# =========================================

step "Installing config to $CONFIG_DIR"

mkdir -p "$CONFIG_DIR/profiles"
mkdir -p "$CONFIG_DIR/presets"

# Copy presets without overwriting
for preset in "$PROJECT_DIR"/config/presets/*.json; do
  name="$(basename "$preset")"
  if [[ -f "$CONFIG_DIR/presets/$name" ]]; then
    info "presets/$name already exists, preserving."
  else
    cp "$preset" "$CONFIG_DIR/presets/$name"
    success "presets/$name installed."
  fi
done

# =========================================
# Step 8: Install GUI
# =========================================

step "Installing GUI to $INSTALL_DIR/gui"

rm -rf "$INSTALL_DIR/gui"
mkdir -p "$INSTALL_DIR/gui"

# Find and copy the electron binary from node_modules
ELECTRON_BIN="$(find "$PROJECT_DIR/node_modules" -path "*/electron/dist/electron" -type f -executable 2>/dev/null | head -1)"
if [[ -z "$ELECTRON_BIN" ]]; then
  error "Electron binary not found in node_modules. Run 'bun install' first."
  exit 1
fi
ELECTRON_DIR="$(dirname "$ELECTRON_BIN")"
cp -r "$ELECTRON_DIR" "$INSTALL_DIR/gui/electron"
info "Bundled electron from $ELECTRON_DIR"

# Place app inside Electron's resources/app/ so app.isPackaged is true
mkdir -p "$INSTALL_DIR/gui/electron/resources/app"
cp -r "$PROJECT_DIR/packages/gui/dist" "$INSTALL_DIR/gui/electron/resources/app/dist"
cp "$PROJECT_DIR/packages/gui/package.json" "$INSTALL_DIR/gui/electron/resources/app/package.json"

# Create GUI wrapper script
cat > "$GUI_WRAPPER" << 'EOF'
#!/bin/bash
exec /usr/lib/fmwk-pwr/gui/electron/electron "$@"
EOF
chmod 755 "$GUI_WRAPPER"

success "GUI installed."

# =========================================
# Step 9: Install GNOME extension (system-wide)
# =========================================

step "Installing GNOME extension to $GNOME_EXT_DIR"

rm -rf "$GNOME_EXT_DIR"
mkdir -p "$GNOME_EXT_DIR"
cp -r "$PROJECT_DIR/packages/gnome-extension/dist/"* "$GNOME_EXT_DIR/"
gnome-extensions enable fmwk-pwr@fmwk-pwr

success "GNOME extension installed."

# =========================================
# Step 10: Install systemd service
# =========================================

step "Installing systemd service"

# SELinux: bun:ffi uses TCC which needs execmem (mprotect PROT_EXEC)
if command -v getenforce >/dev/null 2>&1 && [[ "$(getenforce)" != "Disabled" ]]; then
  info "SELinux is active — setting execmem permission for bun"
  chcon -t bin_t "$BUN" 2>/dev/null || true
  setsebool -P domain_can_mmap_files 1 2>/dev/null || true
fi

sed "s|__BUN_PATH__|$BUN|g" "$PROJECT_DIR/systemd/fmwk-pwr.service" > "$SYSTEMD_UNIT"
systemctl daemon-reload
systemctl enable fmwk-pwr.service
systemctl start fmwk-pwr.service

success "systemd service enabled and started."

# =========================================
# Step 11: Install desktop entry
# =========================================

step "Installing desktop entry"

cp "$PROJECT_DIR/desktop/fmwk-pwr.desktop" "$DESKTOP_ENTRY"

# Update desktop database if available
if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database /usr/share/applications 2>/dev/null || true
fi

success "Desktop entry installed."

# =========================================
# Done
# =========================================

echo ""
echo -e "${GREEN}${BOLD}Installation complete!${NC}"
echo ""
echo "  Server:          systemctl status fmwk-pwr"
echo "  GUI:             fmwk-pwr-gui"
echo "  Config:          $CONFIG_DIR/"
echo "  Logs:            journalctl -u fmwk-pwr"
echo ""
