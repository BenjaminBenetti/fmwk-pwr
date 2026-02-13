// =====================================
// Protocol
// =====================================

export { type Request, type Response, type ErrorResponse } from "./protocol.js";
export { ErrorCode, type ErrorCodeName } from "./error-codes.js";
export { Methods, type MethodName } from "./method-names.js";
export { type MethodMap } from "./method-map.js";

// =====================================
// Profile Methods
// =====================================

export {
  type ProfileListParams,
  type ProfileGetParams,
  type ProfileCreateParams,
  type ProfileUpdateParams,
  type ProfileDeleteParams,
  type ProfileApplyParams,
  type ProfileListResult,
  type ProfileGetResult,
  type ProfileCreateResult,
  type ProfileUpdateResult,
  type ProfileDeleteResult,
  type ProfileApplyResult,
} from "./profile-methods.js";

// =====================================
// Status Methods
// =====================================

export { type StatusGetParams, type StatusGetResult } from "./status-methods.js";

// =====================================
// Config Methods
// =====================================

export {
  type ConfigGetParams,
  type ConfigUpdateParams,
  type ConfigGetResult,
  type ConfigUpdateResult,
} from "./config-methods.js";

// =====================================
// Preset Methods
// =====================================

export {
  type PresetListParams,
  type PresetListResult,
  type PresetLoadParams,
  type PresetLoadResult,
} from "./preset-methods.js";
