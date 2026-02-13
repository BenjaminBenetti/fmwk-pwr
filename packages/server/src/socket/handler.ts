import {
  ErrorCode,
  Methods,
  type Request,
  type Response,
  type ErrorResponse,
} from "@fmwk-pwr/shared";
import type { ProfileManager } from "../profiles/manager.js";
import type { ServerState } from "../state.js";
import type { HardwareStrategy } from "../hardware/strategy.js";
import {
  handleProfileList,
  handleProfileGet,
  handleProfileCreate,
  handleProfileUpdate,
  handleProfileDelete,
  handleProfileApply,
} from "../profiles/profile-service.js";
import { handleStatusGet } from "../status/status-service.js";
import { handleConfigGet, handleConfigUpdate } from "../config/config-service.js";
import { handlePresetList, handlePresetLoad } from "../profiles/preset-service.js";

// =====================================
// Message Routing
// =====================================

/**
 * Creates the top-level message handler that routes incoming requests
 * to the appropriate service by method name.
 * @param profileManager - Manages profile CRUD and hardware application
 * @param state - Mutable server state (active profile, config, last hardware info)
 * @param hardware - Hardware strategy for applying limits
 * @param presetsDir - Absolute path to the presets directory
 * @returns An async handler function suitable for passing to SocketServer
 */
export function createHandler(
  profileManager: ProfileManager,
  state: ServerState,
  hardware: HardwareStrategy,
  presetsDir: string,
): (request: Request) => Promise<Response | ErrorResponse> {
  return async (request: Request): Promise<Response | ErrorResponse> => {
    const { id, method } = request;
    const params = request.params as unknown;

    switch (method) {
      case Methods.ProfileList:
        return handleProfileList(id, profileManager);
      case Methods.ProfileGet:
        return handleProfileGet(id, params, profileManager);
      case Methods.ProfileCreate:
        return handleProfileCreate(id, params, profileManager);
      case Methods.ProfileUpdate:
        return handleProfileUpdate(id, params, profileManager);
      case Methods.ProfileDelete:
        return handleProfileDelete(id, params, state, profileManager);
      case Methods.ProfileApply:
        return handleProfileApply(id, params, state, profileManager);
      case Methods.StatusGet:
        return handleStatusGet(id, state);
      case Methods.ConfigGet:
        return handleConfigGet(id, state);
      case Methods.ConfigUpdate:
        return handleConfigUpdate(id, params, state);
      case Methods.PresetList:
        return handlePresetList(id, presetsDir);
      case Methods.PresetLoad:
        return handlePresetLoad(id, params, state, hardware, presetsDir);
      default:
        return {
          id,
          error: {
            code: ErrorCode.MethodNotFound,
            message: `Unknown method: ${method}`,
          },
        };
    }
  };
}
