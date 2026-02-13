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

### 4. Run tests

```sh
bun run test
```

### 5. Type check

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
│   ├── gui/                       # Electron GUI (planned)
│   │   ├── main/
│   │   ├── renderer/
│   │   └── preload/
│   └── gnome-extension/           # GNOME Shell extension (planned)
│       └── src/
├── systemd/                       # systemd unit file (planned)
├── scripts/
│   ├── install-libryzenadj.sh
│   └── deps/                      # Distro-specific dependency installers
└── plan/                          # Design documents
```
