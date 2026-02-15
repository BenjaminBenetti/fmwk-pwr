import { readdirSync, readFileSync as fsReadFileSync } from "node:fs";
import { join } from "node:path";

const HWMON_BASE = "/sys/class/hwmon";
const DRM_BASE = "/sys/class/drm";
const AMD_VENDOR_ID = "0x1002";
const CPUFREQ_BASE = "/sys/devices/system/cpu";

// =====================================
// Path Detection
// =====================================

/**
 * Scan /sys/class/hwmon for a hwmon device matching the given driver name.
 * Each hwmon directory contains a "name" file with the kernel driver name.
 * @param driverName - Kernel driver name to match (e.g. "k10temp", "amdgpu")
 * @returns Absolute sysfs path to the hwmon directory, or null if not found
 */
function findHwmonPath(driverName: string): string | null {
  try {
    const entries = readdirSync(HWMON_BASE);
    for (const entry of entries) {
      const namePath = join(HWMON_BASE, entry, "name");
      try {
        const name = readSysfsSync(namePath);
        if (name === driverName) {
          return join(HWMON_BASE, entry);
        }
      } catch {
        continue;
      }
    }
  } catch {
    // /sys/class/hwmon not available
  }
  return null;
}

/**
 * Scan /sys/class/drm for the first AMD GPU card device path.
 * Checks the PCI vendor ID of each card entry against the AMD vendor ID (0x1002).
 * @returns Absolute sysfs path to the GPU device directory, or null if not found
 */
function findGpuCardPath(): string | null {
  try {
    const entries = readdirSync(DRM_BASE);
    for (const entry of entries) {
      if (!entry.startsWith("card") || entry.includes("-")) continue;
      const vendorPath = join(DRM_BASE, entry, "device", "vendor");
      try {
        const vendor = readSysfsSync(vendorPath);
        if (vendor === AMD_VENDOR_ID) {
          return join(DRM_BASE, entry, "device");
        }
      } catch {
        continue;
      }
    }
  } catch {
    // /sys/class/drm not available
  }
  return null;
}

/**
 * Read a sysfs file synchronously and return its trimmed content.
 * @param path - Absolute path to the sysfs file
 * @returns Trimmed file content as a string
 */
function readSysfsSync(path: string): string {
  return fsReadFileSync(path, "utf-8").trim();
}

// =====================================
// Sensor Reads
// =====================================

/**
 * Reads CPU and GPU sensor data from Linux hwmon and DRM sysfs interfaces.
 *
 * On construction, discovers paths for:
 * - k10temp hwmon: CPU Tctl/Tdie temperature
 * - amdgpu hwmon: Socket power draw
 * - DRM card device: GPU clock, performance level, and OverDrive control
 */
export class HwmonReader {
  private readonly k10tempPath: string | null;
  private readonly amdgpuHwmonPath: string | null;
  private readonly gpuCardPath: string | null;

  /** Discover hwmon and DRM sysfs paths for available sensors. */
  constructor() {
    this.k10tempPath = findHwmonPath("k10temp");
    this.amdgpuHwmonPath = findHwmonPath("amdgpu");
    this.gpuCardPath = findGpuCardPath();
  }

  /**
   * Read the CPU Tctl/Tdie temperature from the k10temp hwmon driver.
   * @returns Temperature in degrees Celsius, or null if unavailable
   */
  async readCpuTemp(): Promise<number | null> {
    if (!this.k10tempPath) return null;
    try {
      const raw = await Bun.file(join(this.k10tempPath, "temp1_input")).text();
      const millidegrees = parseInt(raw.trim(), 10);
      if (isNaN(millidegrees)) return null;
      return millidegrees / 1000;
    } catch {
      return null;
    }
  }

  /**
   * Read the total socket power draw from the amdgpu hwmon driver.
   * Tries power1_average first, then falls back to power1_input.
   * @returns Socket power in mW, or null if unavailable
   */
  async readSocketPower(): Promise<number | null> {
    if (!this.amdgpuHwmonPath) return null;
    try {
      // Try power1_average first, then power1_input
      let raw: string;
      try {
        raw = await Bun.file(join(this.amdgpuHwmonPath, "power1_average")).text();
      } catch {
        raw = await Bun.file(join(this.amdgpuHwmonPath, "power1_input")).text();
      }
      const microwatts = parseInt(raw.trim(), 10);
      if (isNaN(microwatts)) return null;
      return Math.round(microwatts / 1000);
    } catch {
      return null;
    }
  }

  /**
   * Read the current GPU SCLK frequency from the DRM sysfs interface.
   * Parses the pp_dpm_sclk file for the active (asterisk-marked) clock level.
   * @returns Current GPU clock in MHz, or null if unavailable
   */
  async readGpuClock(): Promise<number | null> {
    if (!this.gpuCardPath) return null;
    try {
      const raw = await Bun.file(join(this.gpuCardPath, "pp_dpm_sclk")).text();
      return parseActiveClock(raw);
    } catch {
      return null;
    }
  }

  /**
   * Read the current CPU clock frequency from cpufreq.
   * @returns Current CPU clock in MHz, or null if unavailable
   */
  async readCpuClock(): Promise<number | null> {
    try {
      const raw = await Bun.file(join(CPUFREQ_BASE, "cpu0", "cpufreq", "scaling_cur_freq")).text();
      const khz = parseInt(raw.trim(), 10);
      if (isNaN(khz)) return null;
      return Math.round(khz / 1000);
    } catch {
      return null;
    }
  }

  /**
   * Read GPU and CPU power from the gpu_metrics binary file (v3.0 format).
   * This file is exposed by the amdgpu driver at /sys/class/drm/cardN/device/gpu_metrics.
   * @returns Object with gpuPower and cpuPower in mW, or nulls if unavailable
   */
  async readGpuMetricsPower(): Promise<{ gpuPower: number | null; cpuPower: number | null }> {
    if (!this.gpuCardPath) return { gpuPower: null, cpuPower: null };
    try {
      const buf = await Bun.file(join(this.gpuCardPath, "gpu_metrics")).arrayBuffer();
      const bytes = new DataView(buf);

      // Minimum size: need at least through average_gfx_power at offset 124 + 4 = 128 bytes
      if (buf.byteLength < 128) return { gpuPower: null, cpuPower: null };

      // Header check: byte 2 = format_revision must be 3 (v3.x series).
      // Content revision (byte 3) is not checked — v3.x revisions only append
      // new fields at the end, so offsets we read are stable across v3.0, v3.1, etc.
      const formatRevision = bytes.getUint8(2);
      if (formatRevision !== 3) {
        return { gpuPower: null, cpuPower: null };
      }

      // gpu_metrics_v3_0 with natural C alignment (not packed):
      // average_apu_power: uint32_t at byte offset 120 (total APU power, in mW)
      // average_gfx_power: uint32_t at byte offset 124 (GPU power, in mW)
      // CPU power = apu_power - gfx_power (same approach as MangoHud).
      // average_all_core_power (offset 132) only covers CPU cores and misses
      // SoC/uncore/memory controller power, so we don't use it.
      const apuPower = bytes.getUint32(120, true);
      const gfxPower = bytes.getUint32(124, true);

      const gpuPower = gfxPower === 0xFFFFFFFF ? null : gfxPower;
      const cpuPower =
        apuPower === 0xFFFFFFFF || gfxPower === 0xFFFFFFFF
          ? null
          : Math.max(0, apuPower - gfxPower);

      return { gpuPower, cpuPower };
    } catch {
      return { gpuPower: null, cpuPower: null };
    }
  }

  /**
   * Get the discovered GPU card sysfs device path.
   * @returns Absolute path to the GPU device directory (e.g. /sys/class/drm/card0/device),
   *          or null if no AMD GPU was found
   */
  getGpuCardPath(): string | null {
    return this.gpuCardPath;
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
      // Format: "1: 2500Mhz *" or similar
      const match = line.match(/(\d+)\s*[Mm][Hh]z/);
      if (match) {
        return parseInt(match[1], 10);
      }
    }
  }
  return null;
}
