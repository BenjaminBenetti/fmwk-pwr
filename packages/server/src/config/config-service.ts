import {
  ErrorCode,
  type Response,
  type ErrorResponse,
  type ConfigUpdateParams,
  type HardwareLimits,
} from "@fmwk-pwr/shared";
import type { ServerState } from "../state.js";
import type { HardwareStrategy } from "../hardware/strategy.js";
import { saveConfig } from "./config.js";

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
// Get
// =====================================

/**
 * Handle config.get: returns the full current server configuration.
 * @param id - Request ID
 * @param state - Server state containing the runtime config
 */
export function handleConfigGet(id: string, state: ServerState): Response {
  return { id, result: { config: state.config } };
}

// =====================================
// Update
// =====================================

/**
 * Handle config.update: partially updates the server configuration.
 * Only provided fields are changed; omitted fields retain their current values.
 * @param id - Request ID
 * @param params - Raw request params (expects { config: Partial<ServerConfig> })
 * @param state - Server state (config is updated in place)
 */
export function handleConfigUpdate(
  id: string,
  params: unknown,
  state: ServerState,
  hardware: HardwareStrategy,
): Response | ErrorResponse {
  const { config } = params as ConfigUpdateParams;
  if (!config) {
    return errorResponse(id, ErrorCode.InvalidParams, "config is required");
  }
  if (config.watcherIntervalMs !== undefined && config.watcherIntervalMs <= 0) {
    return errorResponse(id, ErrorCode.InvalidParams, "watcherIntervalMs must be a positive number");
  }
  if (config.defaultProfile !== undefined && config.defaultProfile === "") {
    return errorResponse(id, ErrorCode.InvalidParams, "defaultProfile must be a non-empty string");
  }
  if (config.hardwareLimits !== undefined) {
    const limitsError = validateHardwareLimits(config.hardwareLimits);
    if (limitsError) {
      return errorResponse(id, ErrorCode.InvalidParams, limitsError);
    }
  }
  if (config.gpuSysfsPath !== undefined) {
    state.config.gpuSysfsPath = config.gpuSysfsPath;
  }
  if (config.socketPath !== undefined) {
    state.config.socketPath = config.socketPath;
  }
  if (config.watcherIntervalMs !== undefined) {
    state.config.watcherIntervalMs = config.watcherIntervalMs;
  }
  if (config.defaultProfile !== undefined) {
    state.config.defaultProfile = config.defaultProfile;
  }
  if (config.user !== undefined) {
    if (typeof config.user !== "object" || config.user === null) {
      return errorResponse(id, ErrorCode.InvalidParams, "user must be an object");
    }
    state.config.user = { ...state.config.user, ...config.user };
  }
  if (config.hardwareLimits !== undefined) {
    state.config.hardwareLimits = config.hardwareLimits;
    hardware.setHardwareLimits(config.hardwareLimits);
  }
  if (config.firstTimeSetup !== undefined) {
    state.config.firstTimeSetup = config.firstTimeSetup;
  }
  saveConfig(state.configPath, state.config);
  return { id, result: { config: state.config } };
}

/**
 * Validates that all hardware limits fields are positive numbers.
 * @returns An error message string if invalid, or null if valid.
 */
function validateHardwareLimits(limits: HardwareLimits): string | null {
  const fields: (keyof HardwareLimits)[] = [
    "minPowerMw",
    "maxStapmMw",
    "maxSlowMw",
    "maxFastMw",
    "minGpuClockMhz",
    "maxGpuClockMhz",
  ];
  for (const field of fields) {
    if (typeof limits[field] !== "number" || limits[field] <= 0) {
      return `hardwareLimits.${field} must be a positive number`;
    }
  }
  return null;
}
