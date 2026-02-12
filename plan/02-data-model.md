# Data Model

## Profile

A profile is a named collection of power/GPU settings with optional
auto-activation rules.

```typescript
interface Profile {
  /** Unique name, used as identifier (e.g. "gaming-balanced") */
  name: string;

  /** Human-readable description */
  description?: string;

  /** Power limit settings (all values in milliwatts) */
  power: {
    /** Sustained power limit (STAPM). null = don't change */
    stapmLimit: number | null;
    /** Average/slow PPT limit. null = don't change */
    slowLimit: number | null;
    /** Fast/peak PPT limit. null = don't change */
    fastLimit: number | null;
  };

  /** GPU settings */
  gpu: {
    /**
     * GPU clock frequency in MHz, or null to not set a manual clock.
     * When set: server writes "manual" to power_dpm_force_performance_level,
     * then writes the clock to pp_od_clk_voltage and commits.
     * When null: perfLevel controls the behavior instead.
     */
    clockMhz: number | null;
    /**
     * Performance level when clockMhz is null.
     * "auto" = driver decides clocks dynamically
     * "high" = force highest performance state
     * null = don't change
     * Ignored when clockMhz is set (implicitly "manual").
     */
    perfLevel: "auto" | "high" | null;
  };

  /** tuned-adm profile to activate. null = don't change */
  tunedProfile: string | null;

  /** Auto-activation rules */
  match: {
    /** Enable auto-matching for this profile */
    enabled: boolean;
    /**
     * Regex patterns matched against /proc/<pid>/cmdline.
     * If ANY pattern matches a running process, this profile activates.
     * Patterns are tested as case-insensitive by default.
     */
    processPatterns: string[];
    /** Priority when multiple profiles match (higher wins) */
    priority: number;
  };
}
```

## Server Config

```typescript
interface ServerConfig {
  /** sysfs base path for GPU (e.g. /sys/class/drm/card1/device) */
  gpuSysfsPath: string;

  /** Unix socket path */
  socketPath: string;

  /** Process watcher poll interval in milliseconds */
  watcherIntervalMs: number;

  /** Profile applied on server startup. Required — there must always be an active profile. */
  defaultProfile: string;
}
```

## Server State (runtime, not persisted)

```typescript
interface ServerState {
  /** Currently active profile name. Always set — defaultProfile applied on startup. */
  activeProfile: string;

  /** Whether current profile was auto-matched or manually set */
  activatedBy: "manual" | "auto" | "startup";

  /** Last known hardware readings (libryzenadj limits + HWMON/sysfs sensors) */
  lastHwInfo: HardwareInfo | null;

  /** Timestamp of last hardware info read */
  lastHwInfoTime: number | null;
}

interface HardwareInfo {
  /** Current STAPM limit in mW */
  stapmLimit: number;
  /** Current slow PPT limit in mW */
  slowLimit: number;
  /** Current fast PPT limit in mW */
  fastLimit: number;
  /** Current GPU clock in MHz (read from sysfs) */
  gpuClockMhz: number | null;
  /** CPU temperature in degrees C */
  tcpuTemp: number | null;
  /**
   * CPU-only power draw in mW. null = not yet available.
   * Non-trivial to isolate on APUs — most tools report total socket power
   * as "CPU" power. Will need to investigate how MangoHud separates this
   * (likely via SMU table values or per-core power summing).
   */
  cpuPower: number | null;
  /**
   * GPU-only power draw in mW. null = not yet available.
   * Same challenge — btop/others report total APU power as GPU power.
   * MangoHud gets this right, likely via AMDGPU PM sensor or SMU table.
   */
  gpuPower: number | null;
  /** Total socket/APU power in mW (read from HWMON/sysfs power sensors) */
  socketPower: number | null;
  /** Current tuned-adm profile name */
  tunedProfile: string;
}
```

## File Layout on Disk

```
/etc/fmwk-pwr/
├── config.json          # ServerConfig
└── profiles/
    ├── default.json     # Profile
    ├── gaming-balanced.json
    └── gaming-cpu.json

/run/fmwk-pwr/
└── fmwk-pwr.sock       # Unix domain socket (runtime)

/usr/lib/fmwk-pwr/
├── server/              # Compiled server bundle
├── libryzenadj.so       # Bundled shared library
└── gui/                 # Electron app (or in /opt/fmwk-pwr/)

/usr/share/gnome-shell/extensions/fmwk-pwr@fmwk-pwr/
├── extension.js
├── metadata.json
└── ...

/usr/share/applications/
└── fmwk-pwr.desktop     # Desktop entry for GUI (shows in app grid/launcher)
```
