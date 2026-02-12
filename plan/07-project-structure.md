# Project Structure

```
fmwk-pwr/
├── package.json                  # Root workspace config
├── bunfig.toml                   # Bun config
├── tsconfig.base.json            # Shared TS config
│
├── packages/
│   ├── shared/                   # Shared types & protocol
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── profile.ts        # Profile type
│   │       ├── config.ts         # ServerConfig type
│   │       ├── protocol.ts       # Request/Response/Error types
│   │       ├── methods.ts        # Method names + param/result types
│   │       └── hardware.ts       # HardwareInfo type
│   │
│   ├── server/                   # Server daemon
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── main.ts
│   │       ├── socket/
│   │       ├── hardware/
│   │       │   ├── strategy.ts       # HardwareStrategy interface
│   │       │   ├── detect.ts         # CPU detection → strategy loader
│   │       │   └── strategies/
│   │       │       └── strix-halo/
│   │       │           ├── index.ts  # StrixHaloStrategy
│   │       │           ├── ryzenadj.ts # libryzenadj FFI bindings
│   │       │           ├── hwmon.ts  # HWMON/sysfs sensor reads
│   │       │           └── gpu.ts    # amdgpu sysfs GPU clock control
│   │       ├── profiles/
│   │       ├── watcher/
│   │       └── config/
│   │
│   ├── gui/                      # Electron GUI
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── main/
│   │   ├── renderer/
│   │   ├── preload/
│   │   └── shared/
│   │
│   └── gnome-extension/          # GNOME Shell extension
│       ├── package.json
│       ├── tsconfig.json
│       ├── metadata.json
│       ├── src/
│       │   ├── extension.ts
│       │   ├── indicator.ts
│       │   ├── menu.ts
│       │   └── client.ts
│       └── build.sh
│
├── config/                       # Dev config files
│   ├── config.json               # Dev ServerConfig
│   └── profiles/
│       ├── default.json
│       ├── gaming-balanced.json
│       └── gaming-cpu.json
│
├── systemd/
│   └── fmwk-pwr.service          # systemd unit file
│
├── scripts/
│   └── install.sh                # System install script
│
└── plan/                         # This planning directory
    └── ...
```

## Workspace Configuration

`package.json` (root):
```json
{
  "name": "fmwk-pwr",
  "private": true,
  "workspaces": [
    "packages/shared",
    "packages/server",
    "packages/gui",
    "packages/gnome-extension"
  ]
}
```

Each package depends on `@fmwk-pwr/shared` for types.
Bun workspaces give us automatic linking between packages.
