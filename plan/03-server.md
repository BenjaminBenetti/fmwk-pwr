# Server Development Plan

## Phase 1: Foundation

### 1.1 Project Setup
- Initialize bun project with `bun init`
- TypeScript strict mode config
- Directory structure per architecture doc
- Shared types package (used by server + gui)

### 1.2 Config System
- Load `ServerConfig` from `/etc/fmwk-pwr/config.json`
- Fallback to sensible defaults if file missing
- Dev mode: load from `./config/` in project root
- Validate config on load with runtime type checking

### 1.3 Unix Socket Server
- Use `Bun.listen()` with `unix` option for the socket
- JSON newline-delimited protocol (ndjson)
- Request/response correlation via `id` field
- Connection tracking (for broadcasts like status updates)
- Socket cleanup on shutdown (remove socket file)
- Socket file permissions: group `fmwk-pwr`, mode 0660

### 1.4 Message Router
- Parse incoming JSON messages
- Route `method` field to appropriate controller
- Return structured responses/errors
- Subscription support for `status.subscribe`

## Phase 2: Hardware Strategy

### 2.1 Strategy Interface & Detection
- Define `HardwareStrategy` interface (see architecture doc)
- Implement `detect.ts` — read `/proc/cpuinfo` (or DMI), match against
  known hardware, return the right strategy constructor
- If no match: log error with detected CPU info, refuse to start

### 2.2 Strix Halo Strategy
The first (and currently only) implementation. Lives in
`hardware/strategies/strix-halo/`.

**libryzenadj FFI bindings** (`ryzenadj.ts`):
```typescript
import { dlopen, FFIType } from "bun:ffi";

// Bundled at /usr/lib/fmwk-pwr/libryzenadj.so
const LIB_PATH = new URL("../../../libryzenadj.so", import.meta.url).pathname;
const lib = dlopen(LIB_PATH, {
  init_ryzenadj:      { returns: FFIType.ptr, args: [] },
  cleanup_ryzenadj:   { returns: FFIType.void, args: [FFIType.ptr] },
  init_table:         { returns: FFIType.i32, args: [FFIType.ptr] },
  refresh_table:      { returns: FFIType.i32, args: [FFIType.ptr] },

  // Setters (ryzen_access + uint32 mW, return int)
  set_stapm_limit:    { returns: FFIType.i32, args: [FFIType.ptr, FFIType.u32] },
  set_fast_limit:     { returns: FFIType.i32, args: [FFIType.ptr, FFIType.u32] },
  set_slow_limit:     { returns: FFIType.i32, args: [FFIType.ptr, FFIType.u32] },

  // Limit getters (ryzen_access, return float mW)
  get_stapm_limit:    { returns: FFIType.f32, args: [FFIType.ptr] },
  get_fast_limit:     { returns: FFIType.f32, args: [FFIType.ptr] },
  get_slow_limit:     { returns: FFIType.f32, args: [FFIType.ptr] },
});
```

- `ryzen_access` handle initialized once, reused, cleaned up on `destroy()`

**HWMON sensor reads** (`hwmon.ts`):
- CPU temperature: `/sys/class/hwmon/hwmon*/temp*_input` (k10temp driver)
- GPU clock: `/sys/class/drm/card*/device/pp_dpm_sclk`
- Power draw (socket/CPU/GPU): `/sys/class/hwmon/hwmon*/power*_input`
- Auto-detect hwmon paths by matching driver names on init

**GPU clock control** (`gpu.ts`):
- Write `power_dpm_force_performance_level` (manual/auto/high)
- Write `pp_od_clk_voltage` to set clock + commit
- Sequence: set perf level -> write clock -> commit
- Auto-detect card path (card0 vs card1) by scanning for AMD vendor ID

**tuned-adm** (in `index.ts`):
- Spawn `tuned-adm profile <name>` via `Bun.spawn()`
- `tuned-adm active` to read current profile
- Error handling: tuned not installed, invalid profile name

**Validation** — Strix Halo specific limits:
- STAPM: 15000–170000 mW
- Slow/Fast PPT: 15000–170000 mW
- GPU clock: 200–3000 MHz

## Phase 3: Profile System

### 3.1 Profile Manager
- CRUD operations on profile JSON files
- Load all profiles from `/etc/fmwk-pwr/profiles/`
- Validate profile data on create/update
- `applyProfile(name)` - orchestrate all three controllers
  - Apply power limits via Power Controller
  - Apply GPU clock via GPU Controller
  - Apply tuned profile via Tuned Controller
  - Update server state

### 3.2 Profile Validation
- Name: alphanumeric + hyphens, unique
- Power values: positive integers, within sane ranges
  - STAPM: 15000-170000 mW (15W-170W)
  - Slow: 15000-170000 mW
  - Fast: 15000-170000 mW
- GPU clock: 200-3000 MHz
- Process patterns: valid regex

## Phase 4: Process Watcher

### 4.1 Process Scanner
- Read `/proc/*/cmdline` at configurable interval
- Build list of running process command lines
- Efficient: only read cmdline, skip kernel threads (pid < 100 or no cmdline)

### 4.2 Pattern Matcher
- For each profile with `match.enabled`:
  - Test each `processPatterns` regex against running processes
  - Track which profiles match
- Priority resolution: highest `priority` wins
- If no match: keep current active profile (there is always one)
- If match changes: apply new profile, emit status update

### 4.3 Debounce / Hysteresis
- Don't switch profiles on single-scan matches
- Require N consecutive matches before switching (configurable, default 2)
- Prevents rapid switching when processes briefly appear/disappear

## Phase 5: systemd Integration

### 5.1 Service Unit
```ini
[Unit]
Description=Framework Power Manager
After=multi-user.target

[Service]
Type=simple
ExecStart=/usr/bin/bun run /usr/lib/fmwk-pwr/server/main.ts
RuntimeDirectory=fmwk-pwr
RuntimeDirectoryMode=0755
# Server applies defaultProfile from config on startup automatically

[Install]
WantedBy=multi-user.target
```

### 5.2 Socket Activation (optional future)
- systemd socket activation for on-demand startup
- Not needed initially - server should always run

### 5.3 Installation
- `make install` or install script
- Copy server files to `/usr/lib/fmwk-pwr/`
- Copy config to `/etc/fmwk-pwr/`
- Install and enable systemd unit
- Create `fmwk-pwr` group, add user to it
