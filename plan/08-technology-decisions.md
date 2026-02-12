# Technology Decisions

## Runtime & Language: Bun + TypeScript

**Why Bun:**
- Fast startup (important for a system daemon)
- Native Unix socket support via `Bun.listen()` with `unix` option
- `bun:ffi` for direct C library binding (libryzenadj)
- Built-in bundler for the GUI
- `Bun.spawn()` for shelling out to tuned-adm
- Workspace support for monorepo
- Single runtime for server + GUI build tooling

**Why TypeScript (strict):**
- Type safety for the IPC protocol (shared types ensure client/server agree)
- Better maintainability for a multi-component project
- Good IDE support

## Server: Bun Native Sockets

Using `Bun.listen()` with Unix domain sockets rather than HTTP.

**Why not HTTP:**
- Unix sockets are faster (no TCP overhead)
- File permissions provide access control (no auth needed)
- Standard for local daemon IPC on Linux
- No port conflicts

**Protocol: NDJSON (newline-delimited JSON)**
- Simple to implement
- Human-readable for debugging
- Adequate performance for this use case (low message volume)
- Each message is one JSON object followed by `\n`

## GUI: Electron

**Why Electron over alternatives:**
- Mature ecosystem for desktop apps
- Can use the same TypeScript/React stack
- Native Node.js APIs for Unix socket access in main process
- Bun can build the renderer bundle
- Alternatives considered:
  - **Tauri**: Rust backend would fragment the stack (goal is all-TS)
  - **GTK4 + Blueprint**: Better GNOME integration but very different stack
  - **Web UI served by server**: Would need a browser, no native feel

**Renderer: React + Tailwind**
- React: widely known, good for form-heavy UIs (profile editor)
- Tailwind: rapid styling without CSS files
- Could swap to Svelte/Vue later if preferred

## GNOME Extension: TypeScript -> GJS

**Constraints:**
- GNOME extensions MUST run in GJS (GNOME's JavaScript runtime)
- Cannot use Bun/Node at runtime
- But CAN write in TypeScript and compile to GJS-compatible JS

**Build pipeline:**
- Write in TypeScript with `@girs/gnome-shell` types
- Compile with `tsc` targeting ESM (GNOME 45+ uses ES modules)
- Output goes directly into the extension directory
- No bundler needed (GJS loads ESM natively)

**Socket communication:**
- Use GLib's `Gio.SocketClient` + `Gio.UnixSocketAddress`
- Native to GJS, no external dependencies
- Async via GLib main loop integration

## Process Detection: /proc Scanning

**Why /proc over alternatives:**
- Direct, no dependencies
- Read `/proc/*/cmdline` for each process
- Faster than spawning `ps` repeatedly
- Can filter efficiently (skip kernel threads, read only what we need)

**Alternatives considered:**
- **inotify on /proc**: Not supported by procfs
- **netlink process connector**: More complex, C-level API
- **systemd-run / cgroups**: Overkill for this use case
- **BPF**: Way overkill

## Configuration: JSON Files

**Why JSON over alternatives:**
- TypeScript native (no parser needed)
- Bun has fast JSON handling
- Easy to validate with TypeScript types
- Human-editable in a pinch
- Alternatives: TOML (needs parser), YAML (needs parser, ambiguous)

**Location:**
- System config: `/etc/fmwk-pwr/`
- Runtime socket: `/run/fmwk-pwr/`
- Dev mode: `./config/` in project root

## Hardware Control: Strategy Pattern

All hardware interaction goes through a `HardwareStrategy` interface.
The server detects hardware on boot and loads the matching strategy.
Profiles, IPC, process watcher, and UI know nothing about the underlying
hardware — they call the strategy. Adding new hardware = new strategy file.

**Strix Halo strategy** (current sole implementation):

*libryzenadj via `bun:ffi`:*
- Direct binding to `libryzenadj.so` for SMU power limit control only
- Setters (`set_stapm_limit`, `set_slow_limit`, `set_fast_limit`) take mW values
- Limit getters return current limits after `refresh_table()`
- `libryzenadj.so` bundled at `/usr/lib/fmwk-pwr/`, loaded from fixed path
- Microsecond-level latency per call vs ~5ms for process spawn

*HWMON/sysfs (sensors):*
- CPU temp, power draw, GPU clock read from standard Linux HWMON
- Auto-detect paths by matching driver names (k10temp, amdgpu, etc.)
- Generic Linux interface — likely reusable across strategies

*sysfs (GPU clocks):*
- Direct file writes to amdgpu sysfs
- Works out of the box on Strix Halo / Framework Desktop

*tuned-adm:*
- Standard Fedora/RHEL tool for system profiles
- Shell out via `Bun.spawn()`
- Low call frequency (only on profile switch), spawn overhead is fine
