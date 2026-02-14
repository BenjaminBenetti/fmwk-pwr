import {
  ErrorCode,
  type Response,
  type ErrorResponse,
  type ConfigUpdateParams,
} from "@fmwk-pwr/shared";
import type { ServerState } from "../state.js";
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
export function handleConfigUpdate(id: string, params: unknown, state: ServerState): Response | ErrorResponse {
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
  saveConfig(state.configPath, state.config);
  return { id, result: { config: state.config } };
}
