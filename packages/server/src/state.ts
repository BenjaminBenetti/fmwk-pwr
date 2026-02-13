import type { HardwareInfo, ServerConfig } from "@fmwk-pwr/shared";

/**
 * Mutable server-wide state shared across the socket handler and other subsystems.
 * Tracks the currently active profile, how it was activated, the most recent
 * hardware info snapshot, and the runtime server configuration.
 */
export interface ServerState {
  /** Name of the currently active power profile. Always set (server requires a default). */
  activeProfile: string;
  /** How the current profile was activated: manually by the user, automatically by the process watcher, or on server startup. */
  activatedBy: "manual" | "auto" | "startup";
  /** Most recent hardware info snapshot, or null if not yet read. */
  lastHwInfo: HardwareInfo | null;
  /** Timestamp (ms since epoch) of the last hardware info read, or null if not yet read. */
  lastHwInfoTime: number | null;
  /** Runtime server configuration (may be mutated by ConfigUpdate requests). */
  config: ServerConfig;
}
