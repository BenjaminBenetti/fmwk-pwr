import { describe, expect, test } from "bun:test";
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
};

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    name: "test",
    power: { stapmLimit: null, slowLimit: null, fastLimit: null },
    gpu: { clockMhz: null, perfLevel: null },
    tunedProfile: null,
    match: { enabled: false, processPatterns: [], priority: 0 },
    ...overrides,
  };
}

// Replicate StrixHaloStrategy.validateProfile for testing
function validateStrixHaloProfile(profile: Profile, limits: HardwareLimits): string[] {
  const errors: string[] = [];
  const { power, gpu, match } = profile;

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
  if (gpu.clockMhz !== null) {
    if (gpu.clockMhz < limits.minGpuClockMhz || gpu.clockMhz > limits.maxGpuClockMhz) {
      errors.push(`GPU clock must be between ${limits.minGpuClockMhz} and ${limits.maxGpuClockMhz} MHz`);
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
        makeProfile({ gpu: { clockMhz: 200, perfLevel: null } }),
        defaultLimits,
      );
      expect(errors).toHaveLength(0);
    });

    test("GPU clock at maximum boundary (3000) is valid", () => {
      const errors = validateStrixHaloProfile(
        makeProfile({ gpu: { clockMhz: 3000, perfLevel: null } }),
        defaultLimits,
      );
      expect(errors).toHaveLength(0);
    });

    test("GPU clock below minimum is invalid", () => {
      const errors = validateStrixHaloProfile(
        makeProfile({ gpu: { clockMhz: 100, perfLevel: null } }),
        defaultLimits,
      );
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("GPU clock");
      expect(errors[0]).toContain(`${defaultLimits.minGpuClockMhz}`);
      expect(errors[0]).toContain(`${defaultLimits.maxGpuClockMhz}`);
    });

    test("GPU clock above maximum is invalid", () => {
      const errors = validateStrixHaloProfile(
        makeProfile({ gpu: { clockMhz: 3500, perfLevel: null } }),
        defaultLimits,
      );
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("GPU clock");
    });

    test("typical GPU clock values are valid", () => {
      for (const mhz of [500, 1000, 1500, 2000, 2500, 2700]) {
        const errors = validateStrixHaloProfile(
          makeProfile({ gpu: { clockMhz: mhz, perfLevel: null } }),
          defaultLimits,
        );
        expect(errors).toHaveLength(0);
      }
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
          match: { enabled: true, processPatterns: [], priority: 0 },
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
          gpu: { clockMhz: 2500, perfLevel: null },
          match: {
            enabled: true,
            processPatterns: ["steam", "lutris"],
            priority: 5,
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
          gpu: { clockMhz: 50, perfLevel: null },
          match: {
            enabled: true,
            processPatterns: ["[bad"],
            priority: 0,
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
