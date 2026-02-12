# GNOME Top Bar Extension Development Plan

## Technology
- TypeScript compiled to ESM JavaScript (GNOME 45+ module system)
- `@girs/gnome-shell` for type definitions
- GLib socket APIs (`Gio.SocketClient`, `Gio.UnixSocketAddress`) for IPC
- Standard GNOME Shell extension APIs (`PanelMenu.Button`, `St.Label`)

## Phase 1: Basic Indicator

### 1.1 Extension Skeleton
- `metadata.json` with proper UUID (`fmwk-pwr@fmwk-pwr`)
- GNOME Shell version compatibility (target current Fedora version)
- `extension.ts` with `enable()` / `disable()` lifecycle
- Build script: `tsc` -> copy to `~/.local/share/gnome-shell/extensions/`

### 1.2 Panel Indicator
- Add a `PanelMenu.Button` to the top bar
- Show current profile name as text label
- Optional: small icon prefix (bolt/lightning for power)
- Update label when profile changes

### 1.3 Socket Client
- Connect to `/run/fmwk-pwr/fmwk-pwr.sock` using GLib
- Subscribe to status updates (`status.subscribe`)
- Handle disconnection (show "disconnected" state)
- Reconnect on server restart

## Phase 2: Interactive Menu

### 2.1 Profile Switcher Dropdown
- Click indicator -> dropdown popup menu
- List all profiles as menu items
- Check mark on active profile
- Click profile -> send `profile.apply` to server

### 2.2 Status Section
- Show compact hw readings in the dropdown:
  - Limits: `132W / 154W` (stapm/slow)
  - GPU: `2700 MHz`
  - Power: `98.4 W` (socket power, converted from mW)
- Separator between status and profile list

### 2.3 Quick Actions
- "Open Settings" -> launch Electron GUI
- "Refresh" -> re-read status

## Build & Install

### Development
```bash
# Build
bun run build:extension
# -> compiles TS to JS
# -> copies to ~/.local/share/gnome-shell/extensions/fmwk-pwr@fmwk-pwr/

# Test (Wayland - restart GNOME Shell)
# On X11: Alt+F2 -> r
# On Wayland: log out and log in, or use nested GNOME Shell
```

### Distribution
- Include in project install script
- Copy to `/usr/share/gnome-shell/extensions/fmwk-pwr@fmwk-pwr/`
- User enables via GNOME Extensions app or `gnome-extensions enable`
