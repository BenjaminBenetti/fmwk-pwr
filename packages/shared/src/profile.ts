// =====================================
// Profile
// =====================================

/** A saved configuration profile that defines power limits, GPU settings, and process-matching rules. */
export interface Profile {
  /** Unique identifier, used as the filename on disk (e.g. "balanced.json"). */
  name: string;
  /** Optional human-readable summary of the profile's purpose. */
  description?: string;
  /** CPU power limit settings applied via libryzenadj. */
  power: {
    /** Sustained power limit (STAPM) in mW, or null to leave unchanged. */
    stapmLimit: number | null;
    /** Slow (PPT slow) power limit in mW, or null to leave unchanged. */
    slowLimit: number | null;
    /** Fast (PPT fast) power limit in mW, or null to leave unchanged. */
    fastLimit: number | null;
  };
  /** GPU configuration applied via amdgpu sysfs. */
  gpu: {
    /** Fixed GPU clock frequency in MHz, or null to leave unmanaged. Setting this implies manual performance level. */
    clockMhz: number | null;
    /** GPU performance level: "auto" for driver-managed, "high" for peak clocks, or null to leave unchanged. */
    perfLevel: "auto" | "high" | null;
  };
  /** TuneD profile name to activate (e.g. "balanced", "throughput-performance"), or null to skip. */
  tunedProfile: string | null;
  /** Process-matching rules for automatic profile activation. */
  match: {
    /** Whether automatic activation via process matching is enabled for this profile. */
    enabled: boolean;
    /** List of regex patterns matched against running process names. */
    processPatterns: string[];
    /** Higher values take precedence when multiple profiles match. */
    priority: number;
  };
}
