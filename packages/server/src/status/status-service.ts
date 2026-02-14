import type { Response } from "@fmwk-pwr/shared";
import type { ServerState } from "../state.js";
import type { HardwareStrategy } from "../hardware/strategy.js";

// =====================================
// Get
// =====================================

/**
 * Handle status.get: reads fresh hardware sensor data and returns
 * the current server state including the active profile and live readings.
 * @param id - Request ID
 * @param state - Server state to read from and update
 * @param hardware - Hardware strategy for reading live sensor data
 */
export async function handleStatusGet(
  id: string,
  state: ServerState,
  hardware: HardwareStrategy,
): Promise<Response> {
  const hwInfo = await hardware.readHardwareInfo();
  state.lastHwInfo = hwInfo;
  state.lastHwInfoTime = Date.now();

  return {
    id,
    result: {
      activeProfile: state.activeProfile,
      activatedBy: state.activatedBy,
      hwInfo,
    },
  };
}
