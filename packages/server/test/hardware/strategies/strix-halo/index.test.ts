import { describe, expect, test } from "bun:test";
import type { Profile } from "@fmwk-pwr/shared";

// We can't instantiate StrixHaloStrategy in tests (requires real hardware),
// but we can test its validateProfile logic by replicating it.
// Limits: STAPM 15000-132000 mW, Slow 15000-154000 mW, Fast 15000-170000 mW, GPU 200-3000 MHz

const MIN_POWER_LIMIT_MW = 15_000;
const MAX_STAPM_LIMIT_MW = 132_000;
const MAX_SLOW_LIMIT_MW = 154_000;
const MAX_FAST_LIMIT_MW = 170_000;
const MIN_GPU_CLOCK_MHZ = 200;
const MAX_GPU_CLOCK_MHZ = 3_000;

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
function validateStrixHaloProfile(profile: Profile): string[] {
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

describe("Strix Halo profile validation", () => {
  describe("power limits", () => {
    test("null power limits are valid", () => {
      const errors = validateStrixHaloProfile(makeProfile());
      expect(errors).toHaveLength(0);
    });

    test("STAPM at minimum boundary (15000) is valid", () => {
      const errors = validateStrixHaloProfile(
        makeProfile({ power: { stapmLimit: 15000, slowLimit: null, fastLimit: null } }),
      );
      expect(errors).toHaveLength(0);
    });

    test("STAPM at maximum boundary (132000) is valid", () => {
      const errors = validateStrixHaloProfile(
        makeProfile({ power: { stapmLimit: 132000, slowLimit: null, fastLimit: null } }),
      );
      expect(errors).toHaveLength(0);
    });

    test("STAPM below minimum is invalid", () => {
      const errors = validateStrixHaloProfile(
        makeProfile({ power: { stapmLimit: 14999, slowLimit: null, fastLimit: null } }),
      );
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("STAPM");
    });

    test("STAPM above maximum is invalid", () => {
      const errors = validateStrixHaloProfile(
        makeProfile({ power: { stapmLimit: 132001, slowLimit: null, fastLimit: null } }),
      );
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("STAPM");
    });

    test("slow limit at boundaries is valid", () => {
      const errorsLow = validateStrixHaloProfile(
        makeProfile({ power: { stapmLimit: null, slowLimit: 15000, fastLimit: null } }),
      );
      const errorsHigh = validateStrixHaloProfile(
        makeProfile({ power: { stapmLimit: null, slowLimit: 154000, fastLimit: null } }),
      );
      expect(errorsLow).toHaveLength(0);
      expect(errorsHigh).toHaveLength(0);
    });

    test("slow limit out of range is invalid", () => {
      const errors = validateStrixHaloProfile(
        makeProfile({ power: { stapmLimit: null, slowLimit: 10000, fastLimit: null } }),
      );
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("Slow");
    });

    test("fast limit at boundaries is valid", () => {
      const errorsLow = validateStrixHaloProfile(
        makeProfile({ power: { stapmLimit: null, slowLimit: null, fastLimit: 15000 } }),
      );
      const errorsHigh = validateStrixHaloProfile(
        makeProfile({ power: { stapmLimit: null, slowLimit: null, fastLimit: 170000 } }),
      );
      expect(errorsLow).toHaveLength(0);
      expect(errorsHigh).toHaveLength(0);
    });

    test("fast limit out of range is invalid", () => {
      const errors = validateStrixHaloProfile(
        makeProfile({ power: { stapmLimit: null, slowLimit: null, fastLimit: 200000 } }),
      );
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("Fast");
    });

    test("multiple invalid limits produce multiple errors", () => {
      const errors = validateStrixHaloProfile(
        makeProfile({
          power: { stapmLimit: 5000, slowLimit: 5000, fastLimit: 5000 },
        }),
      );
      expect(errors).toHaveLength(3);
    });

    test("typical gaming profile values are valid", () => {
      const errors = validateStrixHaloProfile(
        makeProfile({
          power: { stapmLimit: 132000, slowLimit: 154000, fastLimit: 170000 },
        }),
      );
      expect(errors).toHaveLength(0);
    });
  });

  describe("GPU clock", () => {
    test("null GPU clock is valid", () => {
      const errors = validateStrixHaloProfile(makeProfile());
      expect(errors).toHaveLength(0);
    });

    test("GPU clock at minimum boundary (200) is valid", () => {
      const errors = validateStrixHaloProfile(
        makeProfile({ gpu: { clockMhz: 200, perfLevel: null } }),
      );
      expect(errors).toHaveLength(0);
    });

    test("GPU clock at maximum boundary (3000) is valid", () => {
      const errors = validateStrixHaloProfile(
        makeProfile({ gpu: { clockMhz: 3000, perfLevel: null } }),
      );
      expect(errors).toHaveLength(0);
    });

    test("GPU clock below minimum is invalid", () => {
      const errors = validateStrixHaloProfile(
        makeProfile({ gpu: { clockMhz: 100, perfLevel: null } }),
      );
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("GPU clock");
    });

    test("GPU clock above maximum is invalid", () => {
      const errors = validateStrixHaloProfile(
        makeProfile({ gpu: { clockMhz: 3500, perfLevel: null } }),
      );
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("GPU clock");
    });

    test("typical GPU clock values are valid", () => {
      for (const mhz of [500, 1000, 1500, 2000, 2500, 2700]) {
        const errors = validateStrixHaloProfile(
          makeProfile({ gpu: { clockMhz: mhz, perfLevel: null } }),
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
      );
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("Invalid process pattern");
    });

    test("empty patterns array is valid", () => {
      const errors = validateStrixHaloProfile(
        makeProfile({
          match: { enabled: true, processPatterns: [], priority: 0 },
        }),
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
      );
      expect(errors.length).toBeGreaterThanOrEqual(4);
    });
  });
});
