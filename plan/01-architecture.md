# Architecture

## System Layout

```
┌─────────────────────────────────────────────────────────────┐
│                        User Space                           │
│                                                             │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │  Electron    │  │  GNOME Top Bar   │  │  CLI client   │  │
│  │  GUI App     │  │  Extension       │  │  (future)     │  │
│  └──────┬───────┘  └────────┬─────────┘  └──────┬───────┘  │
│         │                   │                    │          │
│         └───────────────────┼────────────────────┘          │
│                             │                               │
│                    Unix Domain Socket                       │
│                  /run/fmwk-pwr/fmwk-pwr.sock               │
│                             │                               │
│                    ┌────────┴────────┐                      │
│                    │  fmwk-pwr-server│  (runs as root)      │
│                    │  (bun runtime)  │                      │
│                    └────────┬────────┘                      │
│                             │                               │
└─────────────────────────────┼───────────────────────────────┘
                              │
┌─────────────────────────────┼───────────────────────────────┐
│                        Kernel / HW                          │
│                             │                               │
│    ┌────────────┐  ┌───────┴───────┐  ┌─────────────────┐  │
│    │libryzenadj │  │ sysfs amdgpu  │  │ tuned-adm       │  │
│    │ (FFI→SMU)  │  │ (GPU clocks)  │  │ (power profile) │  │
│    └────────────┘  └───────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Server Architecture

The server is the single source of truth. All hardware mutations go through it.

### Hardware Strategy Pattern

All hardware interaction goes through a `HardwareStrategy` interface.
On startup the server detects the hardware and loads the appropriate
implementation. This makes adding support for new hardware a matter of
writing a new strategy — no changes to profiles, IPC, or UI.

```typescript
interface HardwareStrategy {
  /** Human-readable name for this hardware (e.g. "Strix Halo") */
  readonly name: string;

  /** Apply power limits (mW). null fields = don't change. */
  applyPowerLimits(stapm: number | null, slow: number | null, fast: number | null): void;

  /** Apply GPU clock. null = don't set manual clock. */
  applyGpuClock(clockMhz: number | null): void;

  /** Set GPU performance level. null = don't change. */
  applyGpuPerfLevel(level: "auto" | "high" | null): void;

  /** Apply a tuned-adm profile. null = don't change. */
  applyTunedProfile(name: string | null): Promise<void>;

  /** Read current hardware state. */
  readHardwareInfo(): Promise<HardwareInfo>;

  /** Validate a profile's values against this hardware's limits. */
  validateProfile(profile: Profile): string[];

  /** Clean up resources (e.g. close FFI handle). */
  destroy(): void;
}
```

Detection flow:
```
Server boot
  → read CPU model from /proc/cpuinfo (or DMI)
  → match against known strategies
  → instantiate the matching HardwareStrategy
  → if no match: log error, refuse to start (don't guess)
```

Current implementations:
- **`StrixHaloStrategy`** — Framework Desktop with AMD Strix Halo APU.
  Uses libryzenadj FFI for power limits, amdgpu sysfs for GPU clocks,
  HWMON for sensors, tuned-adm for system profiles.

Future implementations (examples):
- `PhoenixStrategy` — Framework Laptop 16 (Ryzen 7040)
- `GraniteRidgeStrategy` — hypothetical discrete CPU configs
- etc.

### Core Modules

```
server/
├── main.ts                 # Entry point: detect hw, load strategy, start socket
├── socket/
│   ├── server.ts           # Unix socket server (Bun.listen)
│   ├── protocol.ts         # Message types, serialization
│   └── handler.ts          # Route messages to controllers
├── hardware/
│   ├── strategy.ts         # HardwareStrategy interface
│   ├── detect.ts           # Hardware detection (CPU model → strategy)
│   └── strategies/
│       └── strix-halo/
│           ├── index.ts    # StrixHaloStrategy implementation
│           ├── ryzenadj.ts # libryzenadj FFI bindings (bun:ffi)
│           ├── hwmon.ts    # HWMON/sysfs sensor reads
│           └── gpu.ts      # amdgpu sysfs GPU clock control
├── profiles/
│   ├── manager.ts          # CRUD for profiles, persistence
│   ├── types.ts            # Profile type definitions
│   └── matcher.ts          # Process regex matching engine
├── watcher/
│   └── process-watcher.ts  # Periodic /proc scan for auto-switching
└── config/
    └── config.ts           # Load/save config from /etc/fmwk-pwr/
```

### Key Design Decisions

1. **Hardware strategy pattern** - All hardware interaction behind a
   single interface. Server code never touches sysfs/FFI directly —
   it calls the strategy. New hardware = new strategy, nothing else changes.

2. **Server runs as root** - SMU access and sysfs writes require root.
   The socket file permissions control access (group-based).

3. **Socket permissions** - Socket created with group `fmwk-pwr`.
   Users in this group can connect. Default: socket mode 0660.

4. **Single active profile** - Only one profile active at a time.
   Manual switch always overrides auto-match until next auto-match cycle.

5. **Process watcher interval** - Configurable, default 5 seconds.
   Scans /proc for matching cmdline entries.

## IPC Protocol

JSON newline-delimited messages over the Unix socket.

### Request Format
```json
{
  "id": "uuid",
  "method": "profile.apply",
  "params": { "name": "gaming-balanced" }
}
```

### Response Format
```json
{
  "id": "uuid",
  "result": { "applied": true, "profile": "gaming-balanced" }
}
```

### Error Format
```json
{
  "id": "uuid",
  "error": { "code": "PROFILE_NOT_FOUND", "message": "..." }
}
```

### Methods

| Method              | Description                              |
|---------------------|------------------------------------------|
| `profile.list`      | List all profiles                        |
| `profile.get`       | Get a single profile by name             |
| `profile.create`    | Create a new profile                     |
| `profile.update`    | Update an existing profile               |
| `profile.delete`    | Delete a profile                         |
| `profile.apply`     | Apply a profile immediately              |
| `status.get`        | Get current active profile + hw state    |
| `status.subscribe`  | Stream status updates (for indicator)    |
| `config.get`        | Get server config                        |
| `config.update`     | Update server config (e.g. poll interval)|

## Electron GUI Architecture

Compact, narrow, single-view window. No pages or tabs — profile editing
and live monitoring are combined in one vertically-stacked layout.

```
gui/
├── main/
│   ├── main.ts             # Electron main process
│   └── ipc-bridge.ts       # Connect to Unix socket, bridge to renderer
├── renderer/
│   ├── index.html
│   ├── App.tsx             # Root — single unified view
│   └── components/
│       ├── ProfileSelector.tsx  # Dropdown: switch / new / delete
│       ├── PowerSliders.tsx     # STAPM / Slow / Fast limit sliders
│       ├── GpuControls.tsx      # Clock slider + perf level toggle
│       ├── TunedSelector.tsx    # tuned-adm profile dropdown
│       ├── SensorReadout.tsx    # Live power / temp / clock readings
│       ├── AutoMatch.tsx        # Pattern list + priority + toggle
│       └── ApplyButton.tsx       # Apply button (save + apply)
├── preload.ts              # Secure bridge for renderer
└── shared/
    └── types.ts            # Shared types with server
```

- Electron main process connects to the server Unix socket
- Renderer communicates with main via Electron IPC (contextBridge)
- No direct socket access from renderer (security)

## GNOME Extension Architecture

```
gnome-extension/
├── src/
│   ├── extension.ts        # Main extension class
│   ├── indicator.ts        # Panel indicator (icon + label)
│   ├── menu.ts             # Dropdown profile switcher
│   └── client.ts           # Unix socket client (GLib.IOChannel)
├── metadata.json
├── tsconfig.json
└── build.sh                # tsc + copy to GNOME extensions dir
```

- Written in TypeScript, compiled to ESM JS (GNOME 45+ style)
- Uses `@girs/gnome-shell` types for IDE support
- Communicates with server via GLib socket APIs
- Shows: profile name, optional icon/color per profile
- Click: dropdown with all profiles, click to switch
