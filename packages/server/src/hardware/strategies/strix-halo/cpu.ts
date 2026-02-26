import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const CPUFREQ_BASE = "/sys/devices/system/cpu";

export class CpuController {
  private readonly corePaths: string[];

  constructor() {
    this.corePaths = [];
    try {
      const entries = readdirSync(CPUFREQ_BASE);
      for (const entry of entries) {
        if (!/^cpu\d+$/.test(entry)) continue;
        const freqPath = join(CPUFREQ_BASE, entry, "cpufreq", "scaling_max_freq");
        if (existsSync(freqPath)) {
          this.corePaths.push(join(CPUFREQ_BASE, entry, "cpufreq"));
        }
      }
    } catch {
      // cpufreq not available
    }
  }

  async setMaxClock(mhz: number): Promise<void> {
    const khz = String(mhz * 1000);
    await Promise.all(
      this.corePaths.map((p) => Bun.write(join(p, "scaling_max_freq"), khz)),
    );
  }

  async setMinClock(mhz: number): Promise<void> {
    const khz = String(mhz * 1000);
    await Promise.all(
      this.corePaths.map((p) => Bun.write(join(p, "scaling_min_freq"), khz)),
    );
  }

  async readMaxClock(): Promise<number | null> {
    if (this.corePaths.length === 0) return null;
    try {
      const raw = await Bun.file(join(this.corePaths[0], "scaling_max_freq")).text();
      const khz = parseInt(raw.trim(), 10);
      if (isNaN(khz)) return null;
      return Math.round(khz / 1000);
    } catch {
      return null;
    }
  }

  async readMinClock(): Promise<number | null> {
    if (this.corePaths.length === 0) return null;
    try {
      const raw = await Bun.file(join(this.corePaths[0], "scaling_min_freq")).text();
      const khz = parseInt(raw.trim(), 10);
      if (isNaN(khz)) return null;
      return Math.round(khz / 1000);
    } catch {
      return null;
    }
  }

  /** Read the hardware-reported maximum CPU clock from cpuinfo_max_freq (synchronous). */
  readHardwareMaxClock(): number | null {
    return this.readCpuInfoFreq("cpuinfo_max_freq");
  }

  /** Read the hardware-reported minimum CPU clock from cpuinfo_min_freq (synchronous). */
  readHardwareMinClock(): number | null {
    return this.readCpuInfoFreq("cpuinfo_min_freq");
  }

  private readCpuInfoFreq(filename: string): number | null {
    if (this.corePaths.length === 0) return null;
    try {
      const raw = readFileSync(join(this.corePaths[0], filename), "utf-8");
      const khz = parseInt(raw.trim(), 10);
      if (isNaN(khz)) return null;
      return Math.round(khz / 1000);
    } catch {
      return null;
    }
  }
}
