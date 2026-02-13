# fmwk-pwr

Power management tool for the Framework Desktop. Client/server architecture with a systemd-managed server, Electron GUI, and GNOME top bar extension.

## Supported APUs

| APU | Supported |
|-----|-----------|
| AMD Ryzen AI MAX+ 395 | ✅ |
| AMD Ryzen AI MAX+ 392 | ❓ |
| AMD Ryzen AI MAX+ 388 | ❓ |
| AMD Ryzen AI MAX 390 | ❓ |
| AMD Ryzen AI MAX 385 | ❓ |
| AMD Ryzen AI MAX 380 | ❓ |

✅ Tested on real hardware | ❓ Expected to work but not yet verified

## Architecture

```
Electron GUI / GNOME Extension
        │  Unix socket (NDJSON)
        ▼
   fmwk-pwr server
        │
   ┌────┼────────────┐
   │    │             │
libryzenadj   sysfs/HWMON   tuned
(SMU limits)  (sensors/GPU)  (profiles)
```

The server exposes a Unix socket IPC interface. Clients send JSON requests and receive JSON responses, one per line (NDJSON).

## Packages

| Package | Path | Description |
|---------|------|-------------|
| `@fmwk-pwr/shared` | `packages/shared` | Shared types, IPC protocol, error codes |
| `@fmwk-pwr/server` | `packages/server` | Server daemon: config, profiles, hardware, socket |
| `@fmwk-pwr/gui` | `packages/gui` | Electron GUI (main/renderer/preload) |
| `@fmwk-pwr/gnome-extension` | `packages/gnome-extension` | GNOME Shell top bar extension |

## Quick Commands

```sh
bun install                  # Install all dependencies
bun run server               # Start the server (requires root)
bun run gui                  # Build and launch the Electron GUI
bun run test                 # Run all tests (server + shared + gui)
bun run typecheck            # Type check all packages
bun run gui:build            # Build the GUI without launching
```

## Development Setup

### Prerequisites

- [Bun](https://bun.sh) (runtime and package manager)
- Linux with a supported AMD APU (see table above)
- Secure Boot disabled (required for `/dev/mem` access used by libryzenadj)
- Root access (server requires it for SMU and sysfs writes)

### 1. Install dependencies

```sh
bun install
```

### 2. Build and install libryzenadj

```sh
sudo ./scripts/install-libryzenadj.sh
```

### 3. Run the server

```sh
bun run server
```

### 4. Launch the GUI

```sh
bun run gui
```

The GUI connects to the server over a Unix socket. Start the server first.

### 5. Run tests

```sh
bun run test
```

### 6. Type check

```sh
bun run typecheck
```

## Project Structure

```
fmwk-pwr/
├── config/                        # Dev-mode config and sample profiles
│   ├── config.json
│   └── profiles/
├── packages/
│   ├── shared/src/                # Shared types and IPC protocol
│   │   ├── profile.ts
│   │   ├── hardware-info.ts
│   │   ├── server-config.ts
│   │   └── ipc/                   # Protocol, methods, error codes
│   ├── server/src/                # Server daemon
│   │   ├── main.ts
│   │   ├── state.ts
│   │   ├── config/
│   │   ├── profiles/
│   │   ├── socket/
│   │   └── hardware/
│   │       ├── detect.ts
│   │       ├── strategy.ts
│   │       └── strategies/strix-halo/
│   ├── gui/                       # Electron GUI
│   │   ├── src/main/              # Main process (socket client, IPC bridge)
│   │   ├── src/renderer/          # React UI (components, hooks)
│   │   └── test/main/             # Main process tests
│   └── gnome-extension/           # GNOME Shell top bar extension
│       └── src/
├── systemd/                       # systemd unit file (planned)
├── scripts/
│   ├── install-libryzenadj.sh
│   └── deps/                      # Distro-specific dependency installers
└── plan/                          # Design documents
```
