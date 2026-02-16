import type { HardwareLimits } from "./hardware-limits.js";

// =====================================
// Server Configuration
// =====================================

/** Per-section collapsed/expanded state for the GUI. */
export interface CollapsedSections {
  power: boolean;
  cpu: boolean;
  gpu: boolean;
  sensors: boolean;
  autoMatch: boolean;
}

/** User-facing preferences persisted in the server config. */
export interface UserConfig {
  /** GUI theme name (e.g. "default", "industrial", "swiss", "warm-retro"). */
  theme: string;
  /** Whether the GUI uses compact (zoomed-out) mode. */
  compact: boolean;
  /** Per-section collapsed/expanded state. */
  collapsedSections: CollapsedSections;
}

/** Server-side configuration controlling paths, polling intervals, and the default profile. */
export interface ServerConfig {
  /** Absolute sysfs path to the amdgpu device directory (e.g. "/sys/class/drm/card1/device"). */
  gpuSysfsPath: string;
  /** Unix domain socket path used for IPC between the GUI client and the server. */
  socketPath: string;
  /** Interval in ms between process-watcher polling cycles. */
  watcherIntervalMs: number;
  /** Name of the profile applied on server startup and when no process match is active. Must reference an existing profile. */
  defaultProfile: string;
  /** Whether the server needs first-time setup (preset selection). Set to false after a preset is loaded. */
  firstTimeSetup: boolean;
  /** Hardware-specific bounds for validating power and GPU settings. */
  hardwareLimits: HardwareLimits;
  /** User-facing preferences (theme, etc.). */
  user: UserConfig;
}
