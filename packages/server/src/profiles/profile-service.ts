import {
  ErrorCode,
  type Response,
  type ErrorResponse,
  type ProfileGetParams,
  type ProfileCreateParams,
  type ProfileUpdateParams,
  type ProfileDeleteParams,
  type ProfileApplyParams,
} from "@fmwk-pwr/shared";
import type { ProfileManager } from "./manager.js";
import type { ServerState } from "../state.js";

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
// List / Get
// =====================================

/**
 * Handle profile.list: returns all saved profiles.
 * @param id - Request ID
 * @param profileManager - Profile persistence layer
 */
export function handleProfileList(id: string, profileManager: ProfileManager): Response {
  return { id, result: { profiles: profileManager.list() } };
}

/**
 * Handle profile.get: returns a single profile by name.
 * @param id - Request ID
 * @param params - Raw request params (expects { name })
 * @param profileManager - Profile persistence layer
 */
export function handleProfileGet(
  id: string,
  params: unknown,
  profileManager: ProfileManager,
): Response | ErrorResponse {
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

// =====================================
// Create / Update
// =====================================

/**
 * Handle profile.create: validates and persists a new profile.
 * @param id - Request ID
 * @param params - Raw request params (expects { profile })
 * @param profileManager - Profile persistence layer
 */
export async function handleProfileCreate(
  id: string,
  params: unknown,
  profileManager: ProfileManager,
): Promise<Response | ErrorResponse> {
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

/**
 * Handle profile.update: replaces an existing profile entirely.
 * @param id - Request ID
 * @param params - Raw request params (expects { name, profile })
 * @param profileManager - Profile persistence layer
 */
export async function handleProfileUpdate(
  id: string,
  params: unknown,
  profileManager: ProfileManager,
): Promise<Response | ErrorResponse> {
  const { name, profile } = params as ProfileUpdateParams;
  if (!name || !profile) {
    return errorResponse(id, ErrorCode.InvalidParams, "name and profile are required");
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

// =====================================
// Delete
// =====================================

/**
 * Handle profile.delete: removes a profile by name.
 * Refuses to delete the active or default profile.
 * @param id - Request ID
 * @param params - Raw request params (expects { name })
 * @param state - Server state (checked for active/default constraints)
 * @param profileManager - Profile persistence layer
 */
export async function handleProfileDelete(
  id: string,
  params: unknown,
  state: ServerState,
  profileManager: ProfileManager,
): Promise<Response | ErrorResponse> {
  const { name } = params as ProfileDeleteParams;
  if (!name) {
    return errorResponse(id, ErrorCode.InvalidParams, "name is required");
  }
  if (name === state.activeProfile) {
    return errorResponse(id, ErrorCode.CannotDeleteActive, "Cannot delete the currently active profile");
  }
  if (name === state.config.defaultProfile) {
    return errorResponse(id, ErrorCode.CannotDeleteDefault, "Cannot delete the default profile");
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

// =====================================
// Apply
// =====================================

/**
 * Handle profile.apply: writes a profile's settings to hardware and updates server state.
 * @param id - Request ID
 * @param params - Raw request params (expects { name })
 * @param state - Server state (updated with new active profile and hardware snapshot)
 * @param profileManager - Profile persistence layer
 */
export async function handleProfileApply(
  id: string,
  params: unknown,
  state: ServerState,
  profileManager: ProfileManager,
): Promise<Response | ErrorResponse> {
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
