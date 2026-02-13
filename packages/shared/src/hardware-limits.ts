// =====================================
// Hardware Limits
// =====================================

/** Hardware-specific bounds used to validate profile power and GPU settings. */
export interface HardwareLimits {
  /** Lower bound for all power limits (mW). */
  minPowerMw: number;
  /** Upper bound for STAPM (sustained) power limit (mW). */
  maxStapmMw: number;
  /** Upper bound for slow PPT (average) power limit (mW). */
  maxSlowMw: number;
  /** Upper bound for fast PPT (peak) power limit (mW). */
  maxFastMw: number;
  /** Lower bound for GPU clock (MHz). */
  minGpuClockMhz: number;
  /** Upper bound for GPU clock (MHz). */
  maxGpuClockMhz: number;
}
