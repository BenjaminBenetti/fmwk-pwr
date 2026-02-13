import { Methods } from "./method-names.js";
import type {
  ProfileListParams,
  ProfileListResult,
  ProfileGetParams,
  ProfileGetResult,
  ProfileCreateParams,
  ProfileCreateResult,
  ProfileUpdateParams,
  ProfileUpdateResult,
  ProfileDeleteParams,
  ProfileDeleteResult,
  ProfileApplyParams,
  ProfileApplyResult,
} from "./profile-methods.js";
import type {
  StatusGetParams,
  StatusGetResult,
} from "./status-methods.js";
import type {
  ConfigGetParams,
  ConfigGetResult,
  ConfigUpdateParams,
  ConfigUpdateResult,
} from "./config-methods.js";

/** Maps each IPC method name to its typed params/result pair, enabling type-safe dispatch on both client and server. */
export interface MethodMap {
  /** List all saved profiles. */
  [Methods.ProfileList]: { params: ProfileListParams; result: ProfileListResult };
  /** Retrieve a single profile by name. */
  [Methods.ProfileGet]: { params: ProfileGetParams; result: ProfileGetResult };
  /** Create and persist a new profile. */
  [Methods.ProfileCreate]: { params: ProfileCreateParams; result: ProfileCreateResult };
  /** Replace an existing profile entirely. */
  [Methods.ProfileUpdate]: { params: ProfileUpdateParams; result: ProfileUpdateResult };
  /** Delete a profile by name. */
  [Methods.ProfileDelete]: { params: ProfileDeleteParams; result: ProfileDeleteResult };
  /** Apply a profile's settings to hardware. */
  [Methods.ProfileApply]: { params: ProfileApplyParams; result: ProfileApplyResult };
  /** Get current server status including active profile and hardware readings. */
  [Methods.StatusGet]: { params: StatusGetParams; result: StatusGetResult };
  /** Retrieve the current server configuration. */
  [Methods.ConfigGet]: { params: ConfigGetParams; result: ConfigGetResult };
  /** Partially update the server configuration. */
  [Methods.ConfigUpdate]: { params: ConfigUpdateParams; result: ConfigUpdateResult };
}
