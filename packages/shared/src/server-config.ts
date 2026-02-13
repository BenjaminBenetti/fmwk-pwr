import type { HardwareLimits } from "./hardware-limits.js";

// =====================================
// Server Configuration
// =====================================

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
}
