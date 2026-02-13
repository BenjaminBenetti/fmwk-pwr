import type { Preset } from "../preset.js";
import type { ServerConfig } from "../server-config.js";

// =====================================
// Params
// =====================================

/** Parameters for preset.list -- no input required. */
export interface PresetListParams {}

/** Parameters for preset.load. */
export interface PresetLoadParams {
  /** Name of the preset to load. */
  name: string;
}

// =====================================
// Results
// =====================================

/** Result of preset.list. */
export interface PresetListResult {
  /** All available hardware presets. */
  presets: Preset[];
}

/** Result of preset.load. */
export interface PresetLoadResult {
  /** The updated server configuration after loading the preset. */
  config: ServerConfig;
}
