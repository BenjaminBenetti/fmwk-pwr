import type { HardwareLimits } from "./hardware-limits.js";

// =====================================
// Preset
// =====================================

/** A hardware preset that pre-fills safe limits for a known device configuration. */
export interface Preset {
  /** Human-readable preset name (e.g. "Framework Desktop"). */
  name: string;
  /** Short description of the target hardware. */
  description: string;
  /** Hardware-specific power and GPU clock bounds. */
  hardwareLimits: HardwareLimits;
}
