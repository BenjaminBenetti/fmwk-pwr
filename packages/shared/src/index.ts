// =====================================
// Types
// =====================================

export type { Profile } from "./profile.js";
export type { ServerConfig } from "./server-config.js";
export type { HardwareInfo } from "./hardware-info.js";
export type { HardwareLimits } from "./hardware-limits.js";
export type { Preset } from "./preset.js";

// =====================================
// IPC
// =====================================

export {
  ErrorCode,
  type ErrorCodeName,
  Methods,
  type MethodName,
  type MethodMap,
  type Request,
  type Response,
  type ErrorResponse,
  type ProfileListParams,
  type ProfileGetParams,
  type ProfileCreateParams,
  type ProfileUpdateParams,
  type ProfileDeleteParams,
  type ProfileApplyParams,
  type StatusGetParams,
  type ConfigGetParams,
  type ConfigUpdateParams,
  type ProfileListResult,
  type ProfileGetResult,
  type ProfileCreateResult,
  type ProfileUpdateResult,
  type ProfileDeleteResult,
  type ProfileApplyResult,
  type StatusGetResult,
  type ConfigGetResult,
  type ConfigUpdateResult,
  type PresetListParams,
  type PresetListResult,
  type PresetLoadParams,
  type PresetLoadResult,
} from "./ipc/index.js";
