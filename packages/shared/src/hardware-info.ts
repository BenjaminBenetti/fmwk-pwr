// =====================================
// Hardware Info
// =====================================

/** Live hardware sensor readings and active power limits, gathered from HWMON/sysfs and libryzenadj. */
export interface HardwareInfo {
  /** Current sustained power limit (STAPM) in mW, read via libryzenadj. */
  stapmLimit: number;
  /** Current slow (PPT slow) power limit in mW, read via libryzenadj. */
  slowLimit: number;
  /** Current fast (PPT fast) power limit in mW, read via libryzenadj. */
  fastLimit: number;
  /** Current CPU clock frequency in MHz from cpufreq, or null if unavailable. */
  cpuClockMhz: number | null;
  /** Current GPU clock frequency in MHz from HWMON, or null if unavailable. */
  gpuClockMhz: number | null;
  /** Configured max GPU clock limit in MHz from pp_od_clk_voltage, or null if unavailable. */
  gpuClockLimitMhz: number | null;
  /** CPU (Tctl) temperature in degrees C, or null if unavailable. */
  tcpuTemp: number | null;
  /** CPU package power draw in mW, or null if unavailable. */
  cpuPower: number | null;
  /** GPU power draw in mW, or null if unavailable. */
  gpuPower: number | null;
  /** Total socket (APU) power draw in mW, or null if unavailable. */
  socketPower: number | null;
  /** Currently active TuneD profile name (e.g. "balanced"). */
  tunedProfile: string;
}
