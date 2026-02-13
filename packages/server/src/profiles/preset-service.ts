import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ErrorCode,
  type Response,
  type ErrorResponse,
  type Preset,
  type PresetLoadParams,
} from "@fmwk-pwr/shared";
import type { ServerState } from "../state.js";
import type { HardwareStrategy } from "../hardware/strategy.js";
import { saveConfig } from "../config/config.js";

// =====================================
// Helpers
// =====================================

/**
 * Constructs a standardized error response.
 * @param id - Request ID to echo back
 * @param code - Machine-readable error code
 * @param message - Human-readable error description
 */
function errorResponse(id: string, code: string, message: string): ErrorResponse {
  return { id, error: { code, message } };
}

// =====================================
// List
// =====================================

/**
 * Handle preset.list: reads all valid preset JSON files from the presets directory.
 * Silently skips files that are not valid JSON or missing required fields.
 * @param id - Request ID
 * @param presetsDir - Absolute path to the presets directory
 */
export function handlePresetList(id: string, presetsDir: string): Response {
  const presets: Preset[] = [];
  try {
    const files = readdirSync(presetsDir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      try {
        const raw = JSON.parse(readFileSync(join(presetsDir, file), "utf-8"));
        if (raw.name && raw.description && raw.hardwareLimits) {
          presets.push(raw as Preset);
        }
      } catch {
        // Skip invalid preset files
      }
    }
  } catch {
    // Presets dir may not exist yet
  }
  return { id, result: { presets } };
}

// =====================================
// Load
// =====================================

/**
 * Handle preset.load: finds a preset by name, applies its hardware limits
 * to the running config and hardware strategy, then persists to disk.
 * @param id - Request ID
 * @param params - Raw request params (expects { name })
 * @param state - Server state (config is updated in place)
 * @param hardware - Hardware strategy (limits updated for future validation)
 * @param presetsDir - Absolute path to the presets directory
 */
export function handlePresetLoad(
  id: string,
  params: unknown,
  state: ServerState,
  hardware: HardwareStrategy,
  presetsDir: string,
): Response | ErrorResponse {
  const { name } = params as PresetLoadParams;
  if (!name) {
    return errorResponse(id, ErrorCode.InvalidParams, "name is required");
  }

  let foundPreset: Preset | null = null;
  try {
    const files = readdirSync(presetsDir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      try {
        const raw = JSON.parse(readFileSync(join(presetsDir, file), "utf-8"));
        if (raw.name === name && raw.hardwareLimits) {
          foundPreset = raw as Preset;
          break;
        }
      } catch {
        // Skip invalid preset files
      }
    }
  } catch {
    // Presets dir may not exist
  }

  if (!foundPreset) {
    return errorResponse(id, ErrorCode.InvalidParams, `Preset "${name}" not found`);
  }

  state.config.hardwareLimits = foundPreset.hardwareLimits;
  state.config.firstTimeSetup = false;
  hardware.setHardwareLimits(foundPreset.hardwareLimits);

  saveConfig(state.configPath, state.config);

  return { id, result: { config: state.config } };
}
