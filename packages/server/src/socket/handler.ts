import {
  ErrorCode,
  Methods,
  type Request,
  type Response,
  type ErrorResponse,
  type ProfileApplyParams,
  type ProfileCreateParams,
  type ProfileDeleteParams,
  type ProfileGetParams,
  type ProfileUpdateParams,
  type ConfigUpdateParams,
} from "@fmwk-pwr/shared";
import type { ProfileManager } from "../profiles/manager.js";
import type { ServerState } from "../state.js";

// =====================================
// Message Routing
// =====================================

/**
 * Creates the top-level message handler that routes incoming requests
 * to the appropriate profile, status, or config handler by method name.
 * @param profileManager - Manages profile CRUD and hardware application
 * @param state - Mutable server state (active profile, config, last hardware info)
 * @returns An async handler function suitable for passing to SocketServer
 */
export function createHandler(
  profileManager: ProfileManager,
  state: ServerState,
): (request: Request) => Promise<Response | ErrorResponse> {
  return async (request: Request): Promise<Response | ErrorResponse> => {
    const { id, method } = request;
    const params = request.params as unknown;

    switch (method) {
      // =====================================
      // Profile Handlers
      // =====================================

      case Methods.ProfileList:
        return {
          id,
          result: { profiles: profileManager.list() },
        };

      case Methods.ProfileGet: {
        const { name } = params as ProfileGetParams;
        if (!name) {
          return errorResponse(id, ErrorCode.InvalidParams, "name is required");
        }
        const profile = profileManager.get(name);
        if (!profile) {
          return errorResponse(id, ErrorCode.ProfileNotFound, `Profile "${name}" not found`);
        }
        return { id, result: { profile } };
      }

      case Methods.ProfileCreate: {
        const { profile } = params as ProfileCreateParams;
        if (!profile) {
          return errorResponse(id, ErrorCode.InvalidParams, "profile is required");
        }
        try {
          const created = await profileManager.create(profile);
          return { id, result: { profile: created } };
        } catch (err) {
          return errorResponse(
            id,
            ErrorCode.ValidationError,
            err instanceof Error ? err.message : "Validation failed",
          );
        }
      }

      case Methods.ProfileUpdate: {
        const { name, profile } = params as ProfileUpdateParams;
        if (!name || !profile) {
          return errorResponse(
            id,
            ErrorCode.InvalidParams,
            "name and profile are required",
          );
        }
        try {
          const updated = await profileManager.update(name, profile);
          return { id, result: { profile: updated } };
        } catch (err) {
          return errorResponse(
            id,
            err instanceof Error && err.message.includes("not found")
              ? ErrorCode.ProfileNotFound
              : ErrorCode.ValidationError,
            err instanceof Error ? err.message : "Update failed",
          );
        }
      }

      case Methods.ProfileDelete: {
        const { name } = params as ProfileDeleteParams;
        if (!name) {
          return errorResponse(id, ErrorCode.InvalidParams, "name is required");
        }
        if (name === state.activeProfile) {
          return errorResponse(
            id,
            ErrorCode.CannotDeleteActive,
            "Cannot delete the currently active profile",
          );
        }
        if (name === state.config.defaultProfile) {
          return errorResponse(
            id,
            ErrorCode.CannotDeleteDefault,
            "Cannot delete the default profile",
          );
        }
        try {
          await profileManager.delete(name);
          return { id, result: { success: true } };
        } catch (err) {
          return errorResponse(
            id,
            ErrorCode.ProfileNotFound,
            err instanceof Error ? err.message : "Delete failed",
          );
        }
      }

      case Methods.ProfileApply: {
        const { name } = params as ProfileApplyParams;
        if (!name) {
          return errorResponse(id, ErrorCode.InvalidParams, "name is required");
        }
        try {
          const { profile, hwInfo } = await profileManager.apply(name);
          state.activeProfile = name;
          state.activatedBy = "manual";
          state.lastHwInfo = hwInfo;
          state.lastHwInfoTime = Date.now();
          return { id, result: { profile, hwInfo } };
        } catch (err) {
          return errorResponse(
            id,
            ErrorCode.ApplyError,
            err instanceof Error ? err.message : "Apply failed",
          );
        }
      }

      // =====================================
      // Status Handlers
      // =====================================

      case Methods.StatusGet:
        return {
          id,
          result: {
            activeProfile: state.activeProfile,
            activatedBy: state.activatedBy,
            hwInfo: state.lastHwInfo,
          },
        };

      // =====================================
      // Config Handlers
      // =====================================

      case Methods.ConfigGet:
        return {
          id,
          result: { config: state.config },
        };

      case Methods.ConfigUpdate: {
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
        return { id, result: { config: state.config } };
      }

      default:
        return errorResponse(
          id,
          ErrorCode.MethodNotFound,
          `Unknown method: ${method}`,
        );
    }
  };
}

// =====================================
// Helpers
// =====================================

/**
 * Constructs a standardized error response.
 * @param id - Request ID to echo back to the client
 * @param code - Machine-readable error code (e.g. ErrorCode.ProfileNotFound)
 * @param message - Human-readable error description
 * @returns A formatted ErrorResponse object
 */
function errorResponse(
  id: string,
  code: string,
  message: string,
): ErrorResponse {
  return { id, error: { code, message } };
}
