#!/usr/bin/env bash
# Dependency installer for Fedora / RHEL

install_deps() {
  local deps=()
  command -v cmake >/dev/null 2>&1 || deps+=(cmake)
  command -v make  >/dev/null 2>&1 || deps+=(make)
  command -v gcc   >/dev/null 2>&1 || deps+=(gcc)
  command -v g++   >/dev/null 2>&1 || deps+=(gcc-c++)
  pkg-config --exists libpci 2>/dev/null || deps+=(pciutils-devel)

  if [[ ${#deps[@]} -gt 0 ]]; then
    echo "Installing: ${deps[*]}"
    sudo dnf install -y "${deps[@]}"
  else
    echo "All build dependencies already installed."
  fi
}
