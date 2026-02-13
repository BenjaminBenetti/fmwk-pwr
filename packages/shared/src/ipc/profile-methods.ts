import type { Profile } from "../profile.js";
import type { HardwareInfo } from "../hardware-info.js";

// =====================================
// Params
// =====================================

/** Parameters for profile.list -- no input required. */
export interface ProfileListParams {}

/** Parameters for profile.get. */
export interface ProfileGetParams {
  /** Name of the profile to retrieve. */
  name: string;
}

/** Parameters for profile.create. */
export interface ProfileCreateParams {
  /** The full profile object to persist. */
  profile: Profile;
}

/** Parameters for profile.update. */
export interface ProfileUpdateParams {
  /** Name of the existing profile to replace. */
  name: string;
  /** The complete updated profile (replaces the old one entirely). */
  profile: Profile;
}

/** Parameters for profile.delete. */
export interface ProfileDeleteParams {
  /** Name of the profile to delete. */
  name: string;
}

/** Parameters for profile.apply. */
export interface ProfileApplyParams {
  /** Name of the profile whose settings should be written to hardware. */
  name: string;
}

// =====================================
// Results
// =====================================

/** Result of profile.list. */
export interface ProfileListResult {
  /** All saved profiles. */
  profiles: Profile[];
}

/** Result of profile.get. */
export interface ProfileGetResult {
  /** The requested profile. */
  profile: Profile;
}

/** Result of profile.create. */
export interface ProfileCreateResult {
  /** The newly created profile as persisted on disk. */
  profile: Profile;
}

/** Result of profile.update. */
export interface ProfileUpdateResult {
  /** The updated profile as persisted on disk. */
  profile: Profile;
}

/** Result of profile.delete. */
export interface ProfileDeleteResult {
  /** True if the profile was successfully deleted. */
  success: boolean;
}

/** Result of profile.apply. */
export interface ProfileApplyResult {
  /** The profile that was applied. */
  profile: Profile;
  /** Hardware readings taken immediately after applying the profile. */
  hwInfo: HardwareInfo;
}
