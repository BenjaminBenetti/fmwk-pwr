#!/usr/bin/env bash
# Dependency installer for Debian / Ubuntu

install_deps() {
  local deps=()
  command -v cmake >/dev/null 2>&1 || deps+=(cmake)
  command -v make  >/dev/null 2>&1 || deps+=(make)
  command -v gcc   >/dev/null 2>&1 || deps+=(gcc)
  command -v g++   >/dev/null 2>&1 || deps+=(g++)
  pkg-config --exists libpci 2>/dev/null || deps+=(libpci-dev)

  if [[ ${#deps[@]} -gt 0 ]]; then
    echo "Installing: ${deps[*]}"
    sudo apt-get update -qq
    sudo apt-get install -y "${deps[@]}"
  else
    echo "All build dependencies already installed."
  fi
}
