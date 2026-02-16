# Development Phases & Milestones

## Phase 1: Server Core (Start here) ✅
**Goal**: Working server that can apply profiles via Unix socket.

1. Project init: monorepo with bun workspaces
   - `packages/shared/` - types + protocol definitions
   - `packages/server/` - the server
   - `packages/gui/` - electron app
   - `packages/gnome-extension/` - GNOME extension
2. Shared types package (Profile, ServerConfig, HardwareStrategy interface, Protocol messages)
3. Server config loading
4. Unix socket server with JSON protocol
5. Hardware detection (`detect.ts` — read CPU, pick strategy)
6. Strix Halo strategy implementation:
   - libryzenadj FFI bindings (power limits)
   - HWMON/sysfs sensor reads (temp, power, clocks)
   - GPU clock control (amdgpu sysfs)
   - tuned-adm integration
7. Profile CRUD (file-based storage)
8. Profile apply (delegates to HardwareStrategy)

**Milestone**: Can create profiles and apply them via a test client (e.g. `bun run client.ts`)

## Phase 2: Electron GUI ✅
**Goal**: Full control of the server through a GUI.

1. Electron skeleton with Bun + manual packaging setup
2. Socket client in main process, bridge to renderer
3. Unified view: profile selector + power/GPU sliders + sensor readout
4. Auto-match config section
5. Apply button (save + apply in one action)

**Milestone**: Create, edit, and apply profiles from the GUI. Live sensor readout working.

## Phase 3: Process Watcher ✅
**Goal**: Server auto-switches profiles based on running processes.

1. Process scanner (/proc reader)
2. Regex matcher against profiles
3. Priority resolution
4. Watcher loop with configurable interval
5. Debounce/hysteresis logic

**Milestone**: Launch a game -> profile auto-applies. Exit game -> stays on current profile.

## Phase 4: systemd Integration
**Goal**: Server runs as a proper system service.

1. systemd unit file
2. Socket file permissions / group setup
3. Install script
4. Logging (journald integration via stdout)

**Milestone**: `systemctl start fmwk-pwr` works, survives reboot.

## Phase 5: GNOME Extension ✅
**Goal**: See and switch profiles from the top bar.

1. Extension skeleton with build pipeline
2. Socket client using GLib
3. Panel indicator showing active profile
4. Dropdown menu with profile switcher + status readout

**Milestone**: Top bar shows "gaming-balanced", click to switch.

## Phase 6: Polish & Packaging
**Goal**: Installable, distributable package.

1. RPM spec / COPR build
2. Desktop entry + icon for GUI
4. Error handling hardening
5. Documentation

## Non-Goals (for now)
- Windows support (If someone else adds this I guess... but Windows is kinda crap)
- Non-AMD hardware
- Per-core CPU frequency control
- Fan control (handled by EC firmware)
- Undervolting (risky, out of scope)
