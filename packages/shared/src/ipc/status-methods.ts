import type { HardwareInfo } from "../hardware-info.js";

// =====================================
// Params
// =====================================

/** Parameters for status.get -- no input required. */
export interface StatusGetParams {}

// =====================================
// Results
// =====================================

/** Result of status.get, providing the current server state. */
export interface StatusGetResult {
  /** Name of the currently active profile. */
  activeProfile: string;
  /** How the active profile was selected: "manual" via user action, "auto" via process matching, or "startup" via server boot. */
  activatedBy: "manual" | "auto" | "startup";
  /** Latest hardware sensor readings, or null if not yet available. */
  hwInfo: HardwareInfo | null;
}
