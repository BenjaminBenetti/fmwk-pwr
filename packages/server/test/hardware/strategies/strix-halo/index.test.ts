import { describe, expect, test, beforeEach } from "bun:test";
import type { Profile, HardwareLimits } from "@fmwk-pwr/shared";

// We can't instantiate StrixHaloStrategy in tests (requires real hardware),
// but we can test its validateProfile logic by replicating it.

const defaultLimits: HardwareLimits = {
  minPowerMw: 15_000,
  maxStapmMw: 132_000,
  maxSlowMw: 154_000,
  maxFastMw: 170_000,
  minGpuClockMhz: 200,
  maxGpuClockMhz: 3_000,
  minCpuClockMhz: 400,
  maxCpuClockMhz: 5_500,
};

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    name: "test",
    power: { stapmLimit: null, slowLimit: null, fastLimit: null },
    cpu: { maxClockMhz: null, minClockMhz: null },
    gpu: { maxClockMhz: null, minClockMhz: null, perfLevel: null },
    tunedProfile: null,
    match: { enabled: false, processPatterns: [], priority: 0, revertProfile: null },
    ...overrides,
  };
}

// Replicate StrixHaloStrategy.validateProfile for testing
function validateStrixHaloProfile(profile: Profile, limits: HardwareLimits): string[] {
  const errors: string[] = [];
  const { power, cpu, gpu, match } = profile;

  if (power.stapmLimit !== null) {
    if (power.stapmLimit < limits.minPowerMw || power.stapmLimit > limits.maxStapmMw) {
      errors.push(`STAPM limit must be between ${limits.minPowerMw} and ${limits.maxStapmMw} mW`);
    }
  }
  if (power.slowLimit !== null) {
    if (power.slowLimit < limits.minPowerMw || power.slowLimit > limits.maxSlowMw) {
      errors.push(`Slow PPT limit must be between ${limits.minPowerMw} and ${limits.maxSlowMw} mW`);
    }
  }
  if (power.fastLimit !== null) {
    if (power.fastLimit < limits.minPowerMw || power.fastLimit > limits.maxFastMw) {
      errors.push(`Fast PPT limit must be between ${limits.minPowerMw} and ${limits.maxFastMw} mW`);
    }
  }
  if (cpu.maxClockMhz !== null) {
    if (cpu.maxClockMhz < limits.minCpuClockMhz || cpu.maxClockMhz > limits.maxCpuClockMhz) {
      errors.push(`CPU clock must be between ${limits.minCpuClockMhz} and ${limits.maxCpuClockMhz} MHz`);
    }
  }
  if (gpu.maxClockMhz !== null) {
    if (gpu.maxClockMhz < limits.minGpuClockMhz || gpu.maxClockMhz > limits.maxGpuClockMhz) {
      errors.push(`GPU clock must be between ${limits.minGpuClockMhz} and ${limits.maxGpuClockMhz} MHz`);
    }
  }
  if (gpu.minClockMhz !== null) {
    if (gpu.minClockMhz < limits.minGpuClockMhz || gpu.minClockMhz > limits.maxGpuClockMhz) {
      errors.push(`GPU min clock must be between ${limits.minGpuClockMhz} and ${limits.maxGpuClockMhz} MHz`);
    }
  }
  if (cpu.minClockMhz !== null) {
    if (cpu.minClockMhz < limits.minCpuClockMhz || cpu.minClockMhz > limits.maxCpuClockMhz) {
      errors.push(`CPU min clock must be between ${limits.minCpuClockMhz} and ${limits.maxCpuClockMhz} MHz`);
    }
  }
  if (cpu.minClockMhz !== null && cpu.maxClockMhz !== null) {
    if (cpu.minClockMhz > cpu.maxClockMhz) {
      errors.push("CPU min clock must be less than or equal to max clock");
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

describe("Strix Halo profile validation", () => {
  describe("power limits", () => {
    test("null power limits are valid", () => {
      const errors = validateStrixHaloProfile(makeProfile(), defaultLimits);
      expect(errors).toHaveLength(0);
    });

    test("STAPM at minimum boundary (15000) is valid", () => {
      const errors = validateStrixHaloProfile(
        makeProfile({ power: { stapmLimit: 15000, slowLimit: null, fastLimit: null } }),
        defaultLimits,
      );
      expect(errors).toHaveLength(0);
    });

    test("STAPM at maximum boundary (132000) is valid", () => {
      const errors = validateStrixHaloProfile(
        makeProfile({ power: { stapmLimit: 132000, slowLimit: null, fastLimit: null } }),
        defaultLimits,
      );
      expect(errors).toHaveLength(0);
    });

    test("STAPM below minimum is invalid", () => {
      const errors = validateStrixHaloProfile(
        makeProfile({ power: { stapmLimit: 14999, slowLimit: null, fastLimit: null } }),
        defaultLimits,
      );
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("STAPM");
      expect(errors[0]).toContain(`${defaultLimits.minPowerMw}`);
      expect(errors[0]).toContain(`${defaultLimits.maxStapmMw}`);
    });

    test("STAPM above maximum is invalid", () => {
      const errors = validateStrixHaloProfile(
        makeProfile({ power: { stapmLimit: 132001, slowLimit: null, fastLimit: null } }),
        defaultLimits,
      );
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("STAPM");
      expect(errors[0]).toContain(`${defaultLimits.maxStapmMw}`);
    });

    test("slow limit at boundaries is valid", () => {
      const errorsLow = validateStrixHaloProfile(
        makeProfile({ power: { stapmLimit: null, slowLimit: 15000, fastLimit: null } }),
        defaultLimits,
      );
      const errorsHigh = validateStrixHaloProfile(
        makeProfile({ power: { stapmLimit: null, slowLimit: 154000, fastLimit: null } }),
        defaultLimits,
      );
      expect(errorsLow).toHaveLength(0);
      expect(errorsHigh).toHaveLength(0);
    });

    test("slow limit out of range is invalid", () => {
      const errors = validateStrixHaloProfile(
        makeProfile({ power: { stapmLimit: null, slowLimit: 10000, fastLimit: null } }),
        defaultLimits,
      );
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("Slow");
      expect(errors[0]).toContain(`${defaultLimits.minPowerMw}`);
      expect(errors[0]).toContain(`${defaultLimits.maxSlowMw}`);
    });

    test("fast limit at boundaries is valid", () => {
      const errorsLow = validateStrixHaloProfile(
        makeProfile({ power: { stapmLimit: null, slowLimit: null, fastLimit: 15000 } }),
        defaultLimits,
      );
      const errorsHigh = validateStrixHaloProfile(
        makeProfile({ power: { stapmLimit: null, slowLimit: null, fastLimit: 170000 } }),
        defaultLimits,
      );
      expect(errorsLow).toHaveLength(0);
      expect(errorsHigh).toHaveLength(0);
    });

    test("fast limit out of range is invalid", () => {
      const errors = validateStrixHaloProfile(
        makeProfile({ power: { stapmLimit: null, slowLimit: null, fastLimit: 200000 } }),
        defaultLimits,
      );
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("Fast");
      expect(errors[0]).toContain(`${defaultLimits.minPowerMw}`);
      expect(errors[0]).toContain(`${defaultLimits.maxFastMw}`);
    });

    test("multiple invalid limits produce multiple errors", () => {
      const errors = validateStrixHaloProfile(
        makeProfile({
          power: { stapmLimit: 5000, slowLimit: 5000, fastLimit: 5000 },
        }),
        defaultLimits,
      );
      expect(errors).toHaveLength(3);
    });

    test("typical gaming profile values are valid", () => {
      const errors = validateStrixHaloProfile(
        makeProfile({
          power: { stapmLimit: 132000, slowLimit: 154000, fastLimit: 170000 },
        }),
        defaultLimits,
      );
      expect(errors).toHaveLength(0);
    });
  });

  describe("GPU clock", () => {
    test("null GPU clock is valid", () => {
      const errors = validateStrixHaloProfile(makeProfile(), defaultLimits);
      expect(errors).toHaveLength(0);
    });

    test("GPU clock at minimum boundary (200) is valid", () => {
      const errors = validateStrixHaloProfile(
        makeProfile({ gpu: { maxClockMhz: 200, minClockMhz: null, perfLevel: null } }),
        defaultLimits,
      );
      expect(errors).toHaveLength(0);
    });

    test("GPU clock at maximum boundary (3000) is valid", () => {
      const errors = validateStrixHaloProfile(
        makeProfile({ gpu: { maxClockMhz: 3000, minClockMhz: null, perfLevel: null } }),
        defaultLimits,
      );
      expect(errors).toHaveLength(0);
    });

    test("GPU clock below minimum is invalid", () => {
      const errors = validateStrixHaloProfile(
        makeProfile({ gpu: { maxClockMhz: 100, minClockMhz: null, perfLevel: null } }),
        defaultLimits,
      );
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("GPU clock");
      expect(errors[0]).toContain(`${defaultLimits.minGpuClockMhz}`);
      expect(errors[0]).toContain(`${defaultLimits.maxGpuClockMhz}`);
    });

    test("GPU clock above maximum is invalid", () => {
      const errors = validateStrixHaloProfile(
        makeProfile({ gpu: { maxClockMhz: 3500, minClockMhz: null, perfLevel: null } }),
        defaultLimits,
      );
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("GPU clock");
    });

    test("typical GPU clock values are valid", () => {
      for (const mhz of [500, 1000, 1500, 2000, 2500, 2700]) {
        const errors = validateStrixHaloProfile(
          makeProfile({ gpu: { maxClockMhz: mhz, minClockMhz: null, perfLevel: null } }),
          defaultLimits,
        );
        expect(errors).toHaveLength(0);
      }
    });
  });

  describe("CPU min clock", () => {
    test("null CPU min clock is valid", () => {
      const errors = validateStrixHaloProfile(makeProfile(), defaultLimits);
      expect(errors).toHaveLength(0);
    });

    test("cpu.minClockMhz at boundaries is valid", () => {
      const errorsLow = validateStrixHaloProfile(
        makeProfile({ cpu: { maxClockMhz: null, minClockMhz: 400 } }),
        defaultLimits,
      );
      const errorsHigh = validateStrixHaloProfile(
        makeProfile({ cpu: { maxClockMhz: null, minClockMhz: 5500 } }),
        defaultLimits,
      );
      expect(errorsLow).toHaveLength(0);
      expect(errorsHigh).toHaveLength(0);
    });

    test("cpu.minClockMhz out of range is invalid", () => {
      const errorsLow = validateStrixHaloProfile(
        makeProfile({ cpu: { maxClockMhz: null, minClockMhz: 300 } }),
        defaultLimits,
      );
      expect(errorsLow).toHaveLength(1);
      expect(errorsLow[0]).toContain("CPU min clock");
      expect(errorsLow[0]).toContain(`${defaultLimits.minCpuClockMhz}`);
      expect(errorsLow[0]).toContain(`${defaultLimits.maxCpuClockMhz}`);

      const errorsHigh = validateStrixHaloProfile(
        makeProfile({ cpu: { maxClockMhz: null, minClockMhz: 6000 } }),
        defaultLimits,
      );
      expect(errorsHigh).toHaveLength(1);
      expect(errorsHigh[0]).toContain("CPU min clock");
    });

    test("cpu.minClockMhz > cpu.maxClockMhz is invalid", () => {
      const errors = validateStrixHaloProfile(
        makeProfile({ cpu: { maxClockMhz: 2000, minClockMhz: 3000 } }),
        defaultLimits,
      );
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("CPU min clock must be less than or equal to max clock");
    });

    test("cpu.minClockMhz <= cpu.maxClockMhz is valid", () => {
      const errors = validateStrixHaloProfile(
        makeProfile({ cpu: { maxClockMhz: 3000, minClockMhz: 2000 } }),
        defaultLimits,
      );
      expect(errors).toHaveLength(0);
    });

    test("cpu.minClockMhz equal to cpu.maxClockMhz is valid", () => {
      const errors = validateStrixHaloProfile(
        makeProfile({ cpu: { maxClockMhz: 3000, minClockMhz: 3000 } }),
        defaultLimits,
      );
      expect(errors).toHaveLength(0);
    });
  });

  describe("process patterns", () => {
    test("valid regex patterns are accepted", () => {
      const errors = validateStrixHaloProfile(
        makeProfile({
          match: {
            enabled: true,
            processPatterns: ["steam.*game", "gamescope", "^/usr/bin/.*"],
            priority: 10,
            revertProfile: null,
          },
        }),
        defaultLimits,
      );
      expect(errors).toHaveLength(0);
    });

    test("invalid regex pattern produces error", () => {
      const errors = validateStrixHaloProfile(
        makeProfile({
          match: {
            enabled: true,
            processPatterns: ["[invalid"],
            priority: 10,
            revertProfile: null,
          },
        }),
        defaultLimits,
      );
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("Invalid process pattern");
    });

    test("empty patterns array is valid", () => {
      const errors = validateStrixHaloProfile(
        makeProfile({
          match: { enabled: true, processPatterns: [], priority: 0, revertProfile: null },
        }),
        defaultLimits,
      );
      expect(errors).toHaveLength(0);
    });
  });

  describe("combined validation", () => {
    test("profile with all valid values passes", () => {
      const errors = validateStrixHaloProfile(
        makeProfile({
          power: { stapmLimit: 100000, slowLimit: 120000, fastLimit: 150000 },
          gpu: { maxClockMhz: 2500, minClockMhz: null, perfLevel: null },
          match: {
            enabled: true,
            processPatterns: ["steam", "lutris"],
            priority: 5,
            revertProfile: null,
          },
        }),
        defaultLimits,
      );
      expect(errors).toHaveLength(0);
    });

    test("profile with multiple violations reports all", () => {
      const errors = validateStrixHaloProfile(
        makeProfile({
          power: { stapmLimit: 1000, slowLimit: 200000, fastLimit: null },
          gpu: { maxClockMhz: 50, minClockMhz: null, perfLevel: null },
          match: {
            enabled: true,
            processPatterns: ["[bad"],
            priority: 0,
            revertProfile: null,
          },
        }),
        defaultLimits,
      );
      expect(errors.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe("custom limits", () => {
    test("custom limits change validation boundaries", () => {
      // 140000 mW would fail with default STAPM max of 132000
      const failProfile = makeProfile({
        power: { stapmLimit: 140000, slowLimit: null, fastLimit: null },
      });
      const defaultErrors = validateStrixHaloProfile(failProfile, defaultLimits);
      expect(defaultErrors).toHaveLength(1);
      expect(defaultErrors[0]).toContain("STAPM");

      // With custom limits that raise the STAPM max, it should pass
      const customLimits: HardwareLimits = {
        ...defaultLimits,
        maxStapmMw: 150_000,
      };
      const customErrors = validateStrixHaloProfile(failProfile, customLimits);
      expect(customErrors).toHaveLength(0);
    });
  });
});

// =====================================
// GPU perf level transition logic
// =====================================
// StrixHaloStrategy can't be instantiated in tests (requires real hardware),
// so we replicate the applyGpuClock logic to verify the critical
// "auto" -> "manual" transition that works around an amdgpu driver limitation.

interface GpuCall {
  method: "setPerfLevel" | "setClockRange";
  arg: string | { min: number | null; max: number | null };
}

/**
 * Mock GPU controller that records all calls in order.
 */
function createMockGpu() {
  const calls: GpuCall[] = [];
  return {
    calls,
    async setPerfLevel(level: string) {
      calls.push({ method: "setPerfLevel", arg: level });
    },
    async setClockRange(minMhz: number | null, maxMhz: number | null) {
      calls.push({ method: "setClockRange", arg: { min: minMhz, max: maxMhz } });
    },
  };
}

/**
 * Replicate StrixHaloStrategy.applyGpuClock for testing.
 * This must match the production implementation in index.ts.
 */
async function applyGpuClock(
  gpu: ReturnType<typeof createMockGpu>,
  maxClockMhz: number | null,
  minClockMhz: number | null,
): Promise<void> {
  if (maxClockMhz === null && minClockMhz === null) return;
  // Must cycle through "auto" first — the amdgpu driver won't accept
  // a direct "high" → "manual" transition.
  await gpu.setPerfLevel("auto");
  await gpu.setPerfLevel("manual");
  await gpu.setClockRange(minClockMhz, maxClockMhz);
}

/**
 * Replicate StrixHaloStrategy.applyGpuPerfLevel for testing.
 * This must match the production implementation in index.ts lines 88-91.
 */
async function applyGpuPerfLevel(
  gpu: ReturnType<typeof createMockGpu>,
  level: "auto" | "high" | null,
): Promise<void> {
  if (level === null) return;
  await gpu.setPerfLevel(level);
}

describe("Strix Halo GPU perf level transitions", () => {
  let gpu: ReturnType<typeof createMockGpu>;

  beforeEach(() => {
    gpu = createMockGpu();
  });

  describe("applyGpuClock", () => {
    test("cycles through auto before setting manual and clock range", async () => {
      await applyGpuClock(gpu, 2500, null);

      expect(gpu.calls).toHaveLength(3);
      expect(gpu.calls[0]).toEqual({ method: "setPerfLevel", arg: "auto" });
      expect(gpu.calls[1]).toEqual({ method: "setPerfLevel", arg: "manual" });
      expect(gpu.calls[2]).toEqual({ method: "setClockRange", arg: { min: null, max: 2500 } });
    });

    test("sets auto first to handle high-to-manual driver limitation", async () => {
      // The amdgpu driver rejects direct "high" -> "manual" transitions.
      // applyGpuClock must always go through "auto" as an intermediate step.
      await applyGpuClock(gpu, 1800, null);

      // First call must be "auto", NOT "manual"
      expect(gpu.calls[0].method).toBe("setPerfLevel");
      expect(gpu.calls[0].arg).toBe("auto");
      // Second call transitions to "manual"
      expect(gpu.calls[1].method).toBe("setPerfLevel");
      expect(gpu.calls[1].arg).toBe("manual");
    });

    test("does nothing when both clocks are null", async () => {
      await applyGpuClock(gpu, null, null);
      expect(gpu.calls).toHaveLength(0);
    });

    test("sets clock range after perf level transitions", async () => {
      await applyGpuClock(gpu, 600, null);

      // setClockRange must come after both setPerfLevel calls
      const clockCall = gpu.calls.find((c) => c.method === "setClockRange");
      expect(clockCall).toBeDefined();
      expect(clockCall!.arg).toEqual({ min: null, max: 600 });

      const clockIndex = gpu.calls.indexOf(clockCall!);
      expect(clockIndex).toBe(2); // Must be the last call
    });

    test("passes both min and max in single setClockRange call", async () => {
      await applyGpuClock(gpu, 2500, 500);

      expect(gpu.calls).toHaveLength(3);
      expect(gpu.calls[0]).toEqual({ method: "setPerfLevel", arg: "auto" });
      expect(gpu.calls[1]).toEqual({ method: "setPerfLevel", arg: "manual" });
      expect(gpu.calls[2]).toEqual({ method: "setClockRange", arg: { min: 500, max: 2500 } });
    });

    test("works with minimum GPU clock value", async () => {
      await applyGpuClock(gpu, 200, null);

      expect(gpu.calls).toHaveLength(3);
      expect(gpu.calls[2]).toEqual({ method: "setClockRange", arg: { min: null, max: 200 } });
    });

    test("works with maximum GPU clock value", async () => {
      await applyGpuClock(gpu, 3000, null);

      expect(gpu.calls).toHaveLength(3);
      expect(gpu.calls[2]).toEqual({ method: "setClockRange", arg: { min: null, max: 3000 } });
    });
  });

  describe("applyGpuPerfLevel", () => {
    test("sets auto perf level directly (no intermediate step needed)", async () => {
      await applyGpuPerfLevel(gpu, "auto");

      expect(gpu.calls).toHaveLength(1);
      expect(gpu.calls[0]).toEqual({ method: "setPerfLevel", arg: "auto" });
    });

    test("sets high perf level directly", async () => {
      await applyGpuPerfLevel(gpu, "high");

      expect(gpu.calls).toHaveLength(1);
      expect(gpu.calls[0]).toEqual({ method: "setPerfLevel", arg: "high" });
    });

    test("does nothing when level is null", async () => {
      await applyGpuPerfLevel(gpu, null);
      expect(gpu.calls).toHaveLength(0);
    });
  });

  describe("transition sequences", () => {
    test("applying clock after perf level auto produces correct sequence", async () => {
      // Simulate: first apply "auto" perf level, then apply a clock
      await applyGpuPerfLevel(gpu, "auto");
      await applyGpuClock(gpu, 2000, null);

      expect(gpu.calls).toEqual([
        { method: "setPerfLevel", arg: "auto" },
        { method: "setPerfLevel", arg: "auto" },
        { method: "setPerfLevel", arg: "manual" },
        { method: "setClockRange", arg: { min: null, max: 2000 } },
      ]);
    });

    test("applying clock after perf level high produces correct sequence", async () => {
      // Simulate: currently at "high", then switch to a specific clock
      // This is the scenario the fix addresses — without the auto
      // intermediate step, the "high" -> "manual" transition would fail.
      await applyGpuPerfLevel(gpu, "high");
      await applyGpuClock(gpu, 2500, null);

      expect(gpu.calls).toEqual([
        { method: "setPerfLevel", arg: "high" },
        // applyGpuClock resets to "auto" first to avoid high->manual failure
        { method: "setPerfLevel", arg: "auto" },
        { method: "setPerfLevel", arg: "manual" },
        { method: "setClockRange", arg: { min: null, max: 2500 } },
      ]);
    });
  });
});
