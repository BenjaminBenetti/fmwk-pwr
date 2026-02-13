#!/usr/bin/env bash
#
# Download, build, and install libryzenadj.so for fmwk-pwr.
# Installs to /usr/lib/fmwk-pwr/libryzenadj.so (requires root).
#
# Distro-specific dependency scripts live in scripts/deps/.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="/usr/lib/fmwk-pwr"
REPO="FlyGoat/RyzenAdj"
BUILD_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$BUILD_DIR"
}
trap cleanup EXIT

# =========================================
# Detect distro and install dependencies
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
        # Check ID_LIKE as fallback
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
DEPS_SCRIPT="$SCRIPT_DIR/deps/${DISTRO}.sh"

if [[ "$DISTRO" == "unknown" || ! -f "$DEPS_SCRIPT" ]]; then
  echo "ERROR: Unsupported distro. Add a dependency script to scripts/deps/." >&2
  echo "Detected ID: $(grep '^ID=' /etc/os-release 2>/dev/null || echo 'N/A')" >&2
  exit 1
fi

echo "Detected distro: ${DISTRO}"
# shellcheck source=/dev/null
source "$DEPS_SCRIPT"
install_deps

# =========================================
# Resolve latest release tag
# =========================================

echo "Fetching latest RyzenAdj release..."
TAG=$(curl -sfL "https://api.github.com/repos/${REPO}/releases/latest" \
  | grep '"tag_name"' | head -1 | cut -d'"' -f4)

if [[ -z "$TAG" ]]; then
  echo "ERROR: Could not determine latest release tag." >&2
  exit 1
fi
echo "Latest release: ${TAG}"

# =========================================
# Download and extract
# =========================================

TARBALL_URL="https://github.com/${REPO}/archive/refs/tags/${TAG}.tar.gz"
echo "Downloading ${TARBALL_URL}..."
curl -sfL "$TARBALL_URL" | tar xz -C "$BUILD_DIR"

SRC_DIR="$BUILD_DIR/RyzenAdj-${TAG#v}"

if [[ ! -d "$SRC_DIR" ]]; then
  # Fallback: find the extracted directory
  SRC_DIR=$(find "$BUILD_DIR" -maxdepth 1 -type d -name 'RyzenAdj*' | head -1)
fi

if [[ -z "$SRC_DIR" || ! -d "$SRC_DIR" ]]; then
  echo "ERROR: Could not find extracted source directory." >&2
  exit 1
fi

# =========================================
# Build
# =========================================

echo "Building libryzenadj..."
cmake -B "$SRC_DIR/build" -S "$SRC_DIR" \
  -DCMAKE_BUILD_TYPE=Release \
  -DBUILD_SHARED_LIBS=ON

cmake --build "$SRC_DIR/build" --parallel "$(nproc)"

# Find the built shared library
BUILT_LIB=$(find "$SRC_DIR/build" -name 'libryzenadj.so*' -type f | head -1)
if [[ -z "$BUILT_LIB" ]]; then
  echo "ERROR: libryzenadj.so not found after build." >&2
  exit 1
fi

# =========================================
# Install
# =========================================

echo "Installing to ${INSTALL_DIR}/libryzenadj.so..."
sudo mkdir -p "$INSTALL_DIR"
sudo cp "$BUILT_LIB" "$INSTALL_DIR/libryzenadj.so"
sudo chmod 644 "$INSTALL_DIR/libryzenadj.so"

echo "Done. libryzenadj.so (${TAG}) installed to ${INSTALL_DIR}/libryzenadj.so"
