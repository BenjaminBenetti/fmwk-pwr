import type { Profile, HardwareInfo, HardwareLimits } from "@fmwk-pwr/shared";
import type { HardwareStrategy } from "../../strategy.js";
import { RyzenAdj } from "./ryzenadj.js";
import { HwmonReader } from "./hwmon.js";
import { GpuController } from "./gpu.js";
import { CpuController } from "./cpu.js";

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

  hardwareLimits: HardwareLimits;

  private readonly ryzenAdj: RyzenAdj;
  private readonly hwmon: HwmonReader;
  private readonly gpu: GpuController;
  private readonly cpu: CpuController;

  /**
   * Initialize all hardware subsystems.
   * @param hardwareLimits - Hardware-specific bounds for profile validation
   * @throws If libryzenadj fails to load/init or no AMD GPU is found in sysfs
   */
  constructor(hardwareLimits: HardwareLimits) {
    this.hardwareLimits = hardwareLimits;
    this.ryzenAdj = new RyzenAdj();
    this.hwmon = new HwmonReader();

    const gpuPath = this.hwmon.getGpuCardPath();
    if (!gpuPath) {
      throw new Error("No AMD GPU found in /sys/class/drm");
    }
    this.gpu = new GpuController(gpuPath);
    this.cpu = new CpuController();

    // Auto-detect CPU clock limits from sysfs
    const maxCpu = this.cpu.readHardwareMaxClock();
    if (maxCpu !== null) this.hardwareLimits.maxCpuClockMhz = maxCpu;
    const minCpu = this.cpu.readHardwareMinClock();
    if (minCpu !== null) this.hardwareLimits.minCpuClockMhz = minCpu;
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
  // CPU Control
  // =====================================

  /**
   * Set the CPU clock frequency range via cpufreq.
   * Writes max first, then min (kernel rejects min > current max).
   * @param maxClockMhz - Maximum CPU clock in MHz, or null to skip
   * @param minClockMhz - Minimum CPU clock in MHz, or null to skip
   */
  async applyCpuClock(maxClockMhz: number | null, minClockMhz: number | null): Promise<void> {
    if (maxClockMhz === null && minClockMhz === null) return;
    if (maxClockMhz !== null) await this.cpu.setMaxClock(maxClockMhz);
    if (minClockMhz !== null) await this.cpu.setMinClock(minClockMhz);
  }

  // =====================================
  // GPU Control
  // =====================================

  /**
   * Set the GPU clock range. Writes min clock first, then max clock, then commits.
   * Automatically switches performance level to "manual" first.
   * @param maxClockMhz - Maximum GPU clock in MHz, or null to skip
   * @param minClockMhz - Minimum GPU clock in MHz, or null to skip
   */
  async applyGpuClock(maxClockMhz: number | null, minClockMhz: number | null): Promise<void> {
    if (maxClockMhz === null && minClockMhz === null) return;
    // Must cycle through "auto" first — the amdgpu driver won't accept
    // a direct "high" → "manual" transition.
    await this.gpu.setPerfLevel("auto");
    await this.gpu.setPerfLevel("manual");
    await this.gpu.setClockRange(minClockMhz, maxClockMhz);
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
    const [tcpuTemp, socketPower, gpuClockMhz, gpuClockLimitMhz, gpuMinClockLimitMhz, tunedProfile, cpuClockMhz, cpuMaxClockLimitMhz, cpuMinClockLimitMhz, metricsPower, cpuUsagePercent, gpuUsagePercent] =
      await Promise.all([
        this.hwmon.readCpuTemp(),
        this.hwmon.readSocketPower(),
        this.gpu.readCurrentClock(),
        this.gpu.readClockLimit(),
        this.gpu.readMinClockLimit(),
        this.readTunedProfile(),
        this.hwmon.readCpuClock(),
        this.cpu.readMaxClock(),
        this.cpu.readMinClock(),
        this.hwmon.readGpuMetricsPower(),
        this.hwmon.readCpuUsage(),
        this.hwmon.readGpuUsage(),
      ]);

    const limits = this.ryzenAdj.getLimits();

    return {
      stapmLimit: limits.stapm,
      slowLimit: limits.slow,
      fastLimit: limits.fast,
      cpuClockMhz,
      cpuMaxClockLimitMhz,
      cpuMinClockLimitMhz,
      gpuClockMhz,
      gpuClockLimitMhz,
      gpuMinClockLimitMhz,
      tcpuTemp,
      cpuPower: metricsPower.cpuPower,
      gpuPower: metricsPower.gpuPower,
      socketPower,
      cpuUsagePercent,
      gpuUsagePercent,
      tunedProfile,
    };
  }

  // =====================================
  // Validation
  // =====================================

  /**
   * Validate a profile's power and GPU settings against Strix Halo hardware limits.
   * Checks power limits, GPU clock, and process pattern regex syntax.
   * @param profile - The profile to validate
   * @returns Array of human-readable error strings (empty if valid)
   */
  validateProfile(profile: Profile): string[] {
    const errors: string[] = [];
    const { power, cpu, gpu, match } = profile;

    if (power.stapmLimit !== null) {
      if (power.stapmLimit < this.hardwareLimits.minPowerMw || power.stapmLimit > this.hardwareLimits.maxStapmMw) {
        errors.push(`STAPM limit must be between ${this.hardwareLimits.minPowerMw} and ${this.hardwareLimits.maxStapmMw} mW`);
      }
    }
    if (power.slowLimit !== null) {
      if (power.slowLimit < this.hardwareLimits.minPowerMw || power.slowLimit > this.hardwareLimits.maxSlowMw) {
        errors.push(`Slow PPT limit must be between ${this.hardwareLimits.minPowerMw} and ${this.hardwareLimits.maxSlowMw} mW`);
      }
    }
    if (power.fastLimit !== null) {
      if (power.fastLimit < this.hardwareLimits.minPowerMw || power.fastLimit > this.hardwareLimits.maxFastMw) {
        errors.push(`Fast PPT limit must be between ${this.hardwareLimits.minPowerMw} and ${this.hardwareLimits.maxFastMw} mW`);
      }
    }
    if (cpu.maxClockMhz !== null) {
      if (cpu.maxClockMhz < this.hardwareLimits.minCpuClockMhz || cpu.maxClockMhz > this.hardwareLimits.maxCpuClockMhz) {
        errors.push(`CPU max clock must be between ${this.hardwareLimits.minCpuClockMhz} and ${this.hardwareLimits.maxCpuClockMhz} MHz`);
      }
    }
    if (cpu.minClockMhz !== null) {
      if (cpu.minClockMhz < this.hardwareLimits.minCpuClockMhz || cpu.minClockMhz > this.hardwareLimits.maxCpuClockMhz) {
        errors.push(`CPU min clock must be between ${this.hardwareLimits.minCpuClockMhz} and ${this.hardwareLimits.maxCpuClockMhz} MHz`);
      }
    }
    if (cpu.minClockMhz !== null && cpu.maxClockMhz !== null) {
      if (cpu.minClockMhz > cpu.maxClockMhz) {
        errors.push("CPU min clock must be less than or equal to max clock");
      }
    }
    if (gpu.maxClockMhz !== null) {
      if (gpu.maxClockMhz < this.hardwareLimits.minGpuClockMhz || gpu.maxClockMhz > this.hardwareLimits.maxGpuClockMhz) {
        errors.push(`GPU max clock must be between ${this.hardwareLimits.minGpuClockMhz} and ${this.hardwareLimits.maxGpuClockMhz} MHz`);
      }
    }
    if (gpu.minClockMhz !== null) {
      if (gpu.minClockMhz < this.hardwareLimits.minGpuClockMhz || gpu.minClockMhz > this.hardwareLimits.maxGpuClockMhz) {
        errors.push(`GPU min clock must be between ${this.hardwareLimits.minGpuClockMhz} and ${this.hardwareLimits.maxGpuClockMhz} MHz`);
      }
    }
    if (gpu.minClockMhz !== null && gpu.maxClockMhz !== null) {
      if (gpu.minClockMhz > gpu.maxClockMhz) {
        errors.push("GPU min clock must be less than or equal to max clock");
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
  // Hardware Limits
  // =====================================

  /**
   * Update the hardware limits used for profile validation.
   * @param limits - New hardware limits to apply
   */
  setHardwareLimits(limits: HardwareLimits): void {
    this.hardwareLimits = limits;

    // Re-apply auto-detected CPU clock limits
    const maxCpu = this.cpu.readHardwareMaxClock();
    if (maxCpu !== null) this.hardwareLimits.maxCpuClockMhz = maxCpu;
    const minCpu = this.cpu.readHardwareMinClock();
    if (minCpu !== null) this.hardwareLimits.minCpuClockMhz = minCpu;
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
