import type { Profile, HardwareInfo } from "@fmwk-pwr/shared";
import type { HardwareStrategy } from "../../strategy.js";
import { RyzenAdj } from "./ryzenadj.js";
import { HwmonReader } from "./hwmon.js";
import { GpuController } from "./gpu.js";

// =====================================
// Hardware Limits
// =====================================

/** Minimum allowed power limit for all modes in mW (15 W) */
const MIN_POWER_LIMIT_MW = 15_000;
/** Maximum allowed STAPM (sustained) power limit in mW (132 W) */
const MAX_STAPM_LIMIT_MW = 132_000;
/** Maximum allowed slow PPT (average) power limit in mW (154 W) */
const MAX_SLOW_LIMIT_MW = 154_000;
/** Maximum allowed fast PPT (peak) power limit in mW (170 W) */
const MAX_FAST_LIMIT_MW = 170_000;
/** Minimum allowed GPU clock in MHz */
const MIN_GPU_CLOCK_MHZ = 200;
/** Maximum allowed GPU clock in MHz */
const MAX_GPU_CLOCK_MHZ = 3_000;

// =====================================
// Lifecycle
// =====================================

/**
 * Hardware strategy for AMD Strix Halo (Ryzen AI MAX / Ryzen AI 300) APUs.
 *
 * Combines three subsystems:
 * - {@link RyzenAdj}: SMU power limit control via libryzenadj FFI
 * - {@link HwmonReader}: Sensor reads from Linux hwmon/sysfs
 * - {@link GpuController}: GPU clock and performance level via amdgpu sysfs
 */
export class StrixHaloStrategy implements HardwareStrategy {
  readonly name = "Strix Halo";

  private readonly ryzenAdj: RyzenAdj;
  private readonly hwmon: HwmonReader;
  private readonly gpu: GpuController;

  /**
   * Initialize all hardware subsystems.
   * @throws If libryzenadj fails to load/init or no AMD GPU is found in sysfs
   */
  constructor() {
    this.ryzenAdj = new RyzenAdj();
    this.hwmon = new HwmonReader();

    const gpuPath = this.hwmon.getGpuCardPath();
    if (!gpuPath) {
      throw new Error("No AMD GPU found in /sys/class/drm");
    }
    this.gpu = new GpuController(gpuPath);
  }

  // =====================================
  // Power Limits
  // =====================================

  /**
   * Apply CPU power limits via libryzenadj SMU commands.
   * Null parameters are skipped (limit left unchanged).
   * @param stapm - STAPM limit in mW, or null to skip
   * @param slow - Slow PPT limit in mW, or null to skip
   * @param fast - Fast PPT limit in mW, or null to skip
   */
  applyPowerLimits(
    stapm: number | null,
    slow: number | null,
    fast: number | null,
  ): void {
    if (stapm !== null) this.ryzenAdj.setStapmLimit(stapm);
    if (slow !== null) this.ryzenAdj.setSlowLimit(slow);
    if (fast !== null) this.ryzenAdj.setFastLimit(fast);
  }

  // =====================================
  // GPU Control
  // =====================================

  /**
   * Set the GPU clock to a specific frequency.
   * Automatically switches performance level to "manual" first.
   * @param clockMhz - Target GPU clock in MHz, or null to skip
   */
  async applyGpuClock(clockMhz: number | null): Promise<void> {
    if (clockMhz === null) return;
    await this.gpu.setPerfLevel("manual");
    await this.gpu.setClock(clockMhz);
  }

  /**
   * Set the GPU performance level policy (driver-managed or forced high).
   * @param level - "auto" for driver-managed, "high" for max clocks, or null to skip
   */
  async applyGpuPerfLevel(level: "auto" | "high" | null): Promise<void> {
    if (level === null) return;
    await this.gpu.setPerfLevel(level);
  }

  // =====================================
  // Tuned Profile
  // =====================================

  /**
   * Activate a system tuned-adm power profile.
   * @param name - Profile name (e.g. "balanced", "throughput-performance"), or null to skip
   * @throws If tuned-adm exits with a non-zero status
   */
  async applyTunedProfile(name: string | null): Promise<void> {
    if (name === null) return;
    const proc = Bun.spawn(["tuned-adm", "profile", name], {
      stdout: "ignore",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      throw new Error(
        `tuned-adm profile "${name}" failed (exit ${exitCode}): ${stderr.trim()}`,
      );
    }
  }

  // =====================================
  // Sensors
  // =====================================

  /**
   * Read a snapshot of all available hardware telemetry.
   * Gathers sensor data (temperature, power, GPU clock) in parallel,
   * then reads SMU power limits synchronously.
   * @returns Current hardware state including power limits, sensors, and tuned profile
   */
  async readHardwareInfo(): Promise<HardwareInfo> {
    const [tcpuTemp, socketPower, gpuClockMhz, tunedProfile] =
      await Promise.all([
        this.hwmon.readCpuTemp(),
        this.hwmon.readSocketPower(),
        this.gpu.readCurrentClock(),
        this.readTunedProfile(),
      ]);

    const limits = this.ryzenAdj.getLimits();

    return {
      stapmLimit: limits.stapm,
      slowLimit: limits.slow,
      fastLimit: limits.fast,
      gpuClockMhz,
      tcpuTemp,
      cpuPower: null,
      gpuPower: null,
      socketPower,
      tunedProfile,
    };
  }

  // =====================================
  // Validation
  // =====================================

  /**
   * Validate a profile's power and GPU settings against Strix Halo hardware limits.
   * Checks power limits (STAPM 15--132 W, slow 15--154 W, fast 15--170 W), GPU clock (200--3000 MHz),
   * and process pattern regex syntax.
   * @param profile - The profile to validate
   * @returns Array of human-readable error strings (empty if valid)
   */
  validateProfile(profile: Profile): string[] {
    const errors: string[] = [];
    const { power, gpu, match } = profile;

    if (power.stapmLimit !== null) {
      if (power.stapmLimit < MIN_POWER_LIMIT_MW || power.stapmLimit > MAX_STAPM_LIMIT_MW) {
        errors.push(`STAPM limit must be between ${MIN_POWER_LIMIT_MW} and ${MAX_STAPM_LIMIT_MW} mW`);
      }
    }
    if (power.slowLimit !== null) {
      if (power.slowLimit < MIN_POWER_LIMIT_MW || power.slowLimit > MAX_SLOW_LIMIT_MW) {
        errors.push(`Slow PPT limit must be between ${MIN_POWER_LIMIT_MW} and ${MAX_SLOW_LIMIT_MW} mW`);
      }
    }
    if (power.fastLimit !== null) {
      if (power.fastLimit < MIN_POWER_LIMIT_MW || power.fastLimit > MAX_FAST_LIMIT_MW) {
        errors.push(`Fast PPT limit must be between ${MIN_POWER_LIMIT_MW} and ${MAX_FAST_LIMIT_MW} mW`);
      }
    }
    if (gpu.clockMhz !== null) {
      if (gpu.clockMhz < MIN_GPU_CLOCK_MHZ || gpu.clockMhz > MAX_GPU_CLOCK_MHZ) {
        errors.push(`GPU clock must be between ${MIN_GPU_CLOCK_MHZ} and ${MAX_GPU_CLOCK_MHZ} MHz`);
      }
    }

    for (const pattern of match.processPatterns) {
      try {
        new RegExp(pattern);
      } catch {
        errors.push(`Invalid process pattern regex: "${pattern}"`);
      }
    }

    return errors;
  }

  // =====================================
  // Cleanup
  // =====================================

  /**
   * Release all hardware resources (SMU handle and shared library).
   */
  destroy(): void {
    this.ryzenAdj.destroy();
  }

  // =====================================
  // Helpers
  // =====================================

  /**
   * Query the currently active tuned-adm profile.
   * @returns The active profile name, or "unknown" if tuned-adm is unavailable
   */
  private async readTunedProfile(): Promise<string> {
    try {
      const proc = Bun.spawn(["tuned-adm", "active"], {
        stdout: "pipe",
        stderr: "ignore",
      });
      const output = await new Response(proc.stdout).text();
      const exitCode = await proc.exited;
      if (exitCode !== 0) return "unknown";

      // Format: "Current active profile: <name>"
      const match = output.match(/Current active profile:\s*(.+)/);
      return match ? match[1].trim() : "unknown";
    } catch {
      return "unknown";
    }
  }
}
