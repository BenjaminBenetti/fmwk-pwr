# fmwk-pwr

APU management tool for the Framework Desktop, and other Strix Halo APUs.

<p align="center">
  <img src="design/fmwk-pwr-readme-pic.png" alt="fmwk-pwr dashboard" width="800">
</p>

## Supported APUs

| APU | Status |
|-----|--------|
| AMD Ryzen AI MAX+ 395 | Tested |
| AMD Ryzen AI MAX+ 392 | Expected to work |
| AMD Ryzen AI MAX+ 388 | Expected to work |
| AMD Ryzen AI MAX 390 | Expected to work |
| AMD Ryzen AI MAX 385 | Expected to work |
| AMD Ryzen AI MAX 380 | Expected to work |

## Supported Distros

| Distro | Status |
|--------|--------|
| Fedora | Supported |
| Red Hat | Supported |
| Ubuntu | Supported |
| Debian | Supported |
| Arch | Supported |

Other distros will probably work, but you will need to manually install the dependencies 
that the installer normally installs for you.

## Requirements

- Linux (Fedora, Debian/Ubuntu, or Arch)
- Secure Boot disabled (required for `/dev/mem` access)
- `git`

## Installation

Installs the server, desktop app, and GNOME extension.

```sh
curl -fsSL https://raw.githubusercontent.com/BenjaminBenetti/fmwk-pwr/main/scripts/web-install.sh | sudo bash
```

## Architecture

```
Electron GUI / GNOME Extension
        |  Unix socket (NDJSON)
        v
   fmwk-pwr server
        |
   +----+------------+
   |    |             |
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

## Development

### Prerequisites

- [Bun](https://bun.sh) (runtime and package manager)
- A supported AMD APU (see table above)

### Quick Commands

```sh
bun install                  # Install all dependencies
bun run server               # Start the server (requires root)
bun run gui                  # Build and launch the Electron GUI
bun run test                 # Run all tests (server + shared + gui)
bun run typecheck            # Type check all packages
bun run gui:build            # Build the GUI without launching
```

### Setup

1. Install dependencies

```sh
bun install
```

2. Build and install libryzenadj

```sh
sudo ./scripts/install-libryzenadj.sh
```

3. Run the server

```sh
bun run server
```

4. Launch the GUI

```sh
bun run gui
```

The GUI connects to the server over a Unix socket. Start the server first.

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
├── systemd/                       # systemd unit file
├── scripts/
│   ├── install-libryzenadj.sh
│   └── deps/                      # Distro-specific dependency installers
└── plan/                          # Design documents
```
