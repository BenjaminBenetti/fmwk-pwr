// =====================================
// Method Names
// =====================================

/** Lookup table of all IPC method name strings, keyed by a friendly identifier. */
export const Methods = {
  /** List all saved profiles. */
  ProfileList: "profile.list",
  /** Retrieve a single profile by name. */
  ProfileGet: "profile.get",
  /** Create a new profile. */
  ProfileCreate: "profile.create",
  /** Update an existing profile, replacing it entirely. */
  ProfileUpdate: "profile.update",
  /** Delete a profile by name. */
  ProfileDelete: "profile.delete",
  /** Apply a profile, writing its settings to hardware. */
  ProfileApply: "profile.apply",
  /** Get current server status including active profile and live hardware readings. */
  StatusGet: "status.get",
  /** Retrieve the current server configuration. */
  ConfigGet: "config.get",
  /** Partially update the server configuration. */
  ConfigUpdate: "config.update",
  /** List available hardware presets. */
  PresetList: "preset.list",
  /** Load a hardware preset into the server configuration. */
  PresetLoad: "preset.load",
} as const;

/** Union of all valid IPC method name strings (e.g. "profile.list", "status.get"). */
export type MethodName = (typeof Methods)[keyof typeof Methods];
