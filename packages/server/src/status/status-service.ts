import type { Response } from "@fmwk-pwr/shared";
import type { ServerState } from "../state.js";

// =====================================
// Get
// =====================================

/**
 * Handle status.get: returns the current server state including
 * the active profile, how it was activated, and the latest hardware snapshot.
 * @param id - Request ID
 * @param state - Server state to read from
 */
export function handleStatusGet(id: string, state: ServerState): Response {
  return {
    id,
    result: {
      activeProfile: state.activeProfile,
      activatedBy: state.activatedBy,
      hwInfo: state.lastHwInfo,
    },
  };
}
