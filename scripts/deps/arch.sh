#!/usr/bin/env bash
# Dependency installer for Arch Linux

install_deps() {
  local deps=()
  command -v cmake >/dev/null 2>&1 || deps+=(cmake)
  command -v make  >/dev/null 2>&1 || deps+=(make)
  command -v gcc   >/dev/null 2>&1 || deps+=(gcc)
  pacman -Qi pciutils >/dev/null 2>&1 || deps+=(pciutils)

  if [[ ${#deps[@]} -gt 0 ]]; then
    echo "Installing: ${deps[*]}"
    sudo pacman -S --needed --noconfirm "${deps[@]}"
  else
    echo "All build dependencies already installed."
  fi
}
