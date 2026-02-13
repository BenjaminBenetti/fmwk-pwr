import type { HardwareInfo, HardwareLimits, Profile } from "@fmwk-pwr/shared";

// =====================================
// Hardware Strategy
// =====================================

/**
 * Hardware abstraction interface for platform-specific power and GPU control.
 *
 * Each supported CPU/APU platform implements this interface to provide
 * a uniform API for applying power limits, GPU settings, and reading
 * sensor data. The active strategy is selected at boot by {@link detectHardware}.
 */
export interface HardwareStrategy {
  /** Human-readable name of the hardware platform (e.g. "Strix Halo"). */
  readonly name: string;

  /** Current hardware validation limits. */
  hardwareLimits: HardwareLimits;

  /**
   * Apply CPU power limits via the platform's SMU interface.
   * Pass null for any parameter to leave that limit unchanged.
   * @param stapm - Sustained power limit in mW
   * @param slow - Slow PPT (Package Power Tracking) limit in mW
   * @param fast - Fast PPT limit in mW
   */
  applyPowerLimits(
    stapm: number | null,
    slow: number | null,
    fast: number | null,
  ): void;

  /**
   * Set the GPU clock frequency. Implies "manual" performance level.
   * Pass null to skip (no change).
   * @param clockMhz - Target GPU clock frequency in MHz
   */
  applyGpuClock(clockMhz: number | null): Promise<void>;

  /**
   * Set the GPU performance level policy.
   * Pass null to skip (no change).
   * @param level - "auto" lets the driver decide, "high" forces max clocks
   */
  applyGpuPerfLevel(level: "auto" | "high" | null): Promise<void>;

  /**
   * Activate a tuned-adm power profile.
   * Pass null to skip (no change).
   * @param name - Name of the tuned profile (e.g. "balanced", "throughput-performance")
   */
  applyTunedProfile(name: string | null): Promise<void>;

  /**
   * Read current hardware sensor values and active power limits.
   * @returns Snapshot of all readable hardware telemetry
   */
  readHardwareInfo(): Promise<HardwareInfo>;

  /**
   * Validate a profile's hardware-specific fields and return any errors.
   * @param profile - The profile to validate
   * @returns Array of human-readable error strings (empty if valid)
   */
  validateProfile(profile: Profile): string[];

  /**
   * Update the hardware limits used for profile validation.
   * @param limits - New hardware limits to apply
   */
  setHardwareLimits(limits: HardwareLimits): void;

  /**
   * Release all hardware resources (SMU handles, file descriptors, etc.).
   * Must be called on shutdown to avoid resource leaks.
   */
  destroy(): void;
}
