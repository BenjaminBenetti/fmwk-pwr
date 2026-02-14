import { join } from "node:path";

// =====================================
// Lifecycle
// =====================================

/**
 * Controls GPU clock frequency and performance level via the amdgpu
 * sysfs interface (pp_od_clk_voltage and power_dpm_force_performance_level).
 *
 * Uses the OverDrive mechanism to set a custom GPU SCLK frequency.
 * On Strix Halo, OverDrive works without the amdgpu.ppfeaturemask kernel parameter.
 */
export class GpuController {
  private readonly sysfsPath: string;

  /**
   * @param gpuSysfsPath - Absolute sysfs path to the GPU device directory
   *                       (e.g. /sys/class/drm/card0/device)
   */
  constructor(gpuSysfsPath: string) {
    this.sysfsPath = gpuSysfsPath;
  }

  // =====================================
  // Performance Level
  // =====================================

  /**
   * Set the GPU DPM (Dynamic Power Management) forced performance level.
   * @param level - "auto" for driver-managed, "high" for max clocks,
   *               "manual" for user-controlled (required before setClock)
   */
  async setPerfLevel(level: "auto" | "high" | "manual"): Promise<void> {
    const path = join(this.sysfsPath, "power_dpm_force_performance_level");
    await Bun.write(path, level);
  }

  // =====================================
  // Clock Control
  // =====================================

  /**
   * Set the GPU SCLK frequency via the OverDrive interface.
   * Writes the target clock to pp_od_clk_voltage, then commits with "c".
   * Performance level must be set to "manual" before calling this.
   * @param mhz - Target GPU clock frequency in MHz
   */
  async setClock(mhz: number): Promise<void> {
    const clkPath = join(this.sysfsPath, "pp_od_clk_voltage");
    await Bun.write(clkPath, `s 1 ${mhz}`);
    await Bun.write(clkPath, "c");
  }

  /**
   * Read the current GPU SCLK frequency from the DRM sysfs interface.
   * Parses pp_dpm_sclk for the active (asterisk-marked) clock level.
   * @returns Current GPU clock in MHz, or null if unreadable
   */
  async readCurrentClock(): Promise<number | null> {
    try {
      const raw = await Bun.file(join(this.sysfsPath, "pp_dpm_sclk")).text();
      return parseActiveClock(raw);
    } catch {
      return null;
    }
  }

  /**
   * Read the configured max GPU clock limit from pp_od_clk_voltage.
   * Parses the OD_SCLK section for the highest level (level 1).
   * @returns Configured max clock in MHz, or null if unreadable
   */
  async readClockLimit(): Promise<number | null> {
    try {
      const raw = await Bun.file(join(this.sysfsPath, "pp_od_clk_voltage")).text();
      return parseClockLimit(raw);
    } catch {
      return null;
    }
  }
}

/**
 * Parse the active clock frequency from pp_dpm_sclk output.
 * The active level is marked with an asterisk (*).
 * Format example: "1: 2500Mhz *"
 * @param dpmOutput - Raw content of the pp_dpm_sclk sysfs file
 * @returns Active clock frequency in MHz, or null if not parseable
 */
function parseActiveClock(dpmOutput: string): number | null {
  const lines = dpmOutput.trim().split("\n");
  for (const line of lines) {
    if (line.includes("*")) {
      const match = line.match(/(\d+)\s*[Mm][Hh]z/);
      if (match) {
        return parseInt(match[1], 10);
      }
    }
  }
  return null;
}

/**
 * Parse the configured max clock limit from pp_od_clk_voltage output.
 * Finds the highest clock value in the OD_SCLK section.
 * Format example:
 *   OD_SCLK:
 *   0:        600Mhz
 *   1:       2800Mhz
 *   OD_RANGE:
 *   ...
 * @param odOutput - Raw content of the pp_od_clk_voltage sysfs file
 * @returns Configured max clock in MHz, or null if not parseable
 */
function parseClockLimit(odOutput: string): number | null {
  const lines = odOutput.split("\n");
  let inSclk = false;
  let maxClock: number | null = null;

  for (const line of lines) {
    if (line.startsWith("OD_SCLK")) { inSclk = true; continue; }
    if (inSclk && line.match(/^OD_|^\s*$/)) break;
    if (inSclk) {
      const match = line.match(/(\d+)\s*[Mm][Hh]z/);
      if (match) {
        const mhz = parseInt(match[1], 10);
        if (maxClock === null || mhz > maxClock) maxClock = mhz;
      }
    }
  }
  return maxClock;
}
