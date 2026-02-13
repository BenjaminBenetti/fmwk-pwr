import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Profile, HardwareInfo } from "@fmwk-pwr/shared";
import type { HardwareStrategy } from "../../src/hardware/strategy.js";
import { ProfileManager } from "../../src/profiles/manager.js";

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    name: "test-profile",
    power: { stapmLimit: null, slowLimit: null, fastLimit: null },
    gpu: { clockMhz: null, perfLevel: null },
    tunedProfile: null,
    match: { enabled: false, processPatterns: [], priority: 0 },
    ...overrides,
  };
}

const mockHwInfo: HardwareInfo = {
  stapmLimit: 65000,
  slowLimit: 75000,
  fastLimit: 85000,
  gpuClockMhz: null,
  tcpuTemp: 45,
  cpuPower: null,
  gpuPower: null,
  socketPower: 60000,
  tunedProfile: "balanced",
};

function createMockHardware(): HardwareStrategy {
  return {
    name: "Mock",
    hardwareLimits: {
      minPowerMw: 5000,
      maxStapmMw: 120000,
      maxSlowMw: 120000,
      maxFastMw: 140000,
      minGpuClockMhz: 200,
      maxGpuClockMhz: 3000,
    },
    applyPowerLimits() {},
    async applyGpuClock() {},
    async applyGpuPerfLevel() {},
    async applyTunedProfile() {},
    async readHardwareInfo() {
      return { ...mockHwInfo };
    },
    validateProfile() {
      return [];
    },
    setHardwareLimits() {},
    destroy() {},
  };
}

describe("ProfileManager", () => {
  const tmpDir = join(import.meta.dir, ".tmp-profiles-test");
  let manager: ProfileManager;
  let mockHw: HardwareStrategy;

  beforeEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(tmpDir, { recursive: true });
    mockHw = createMockHardware();
    manager = new ProfileManager(tmpDir, mockHw);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("loadAll", () => {
    test("loads profiles from JSON files in directory", () => {
      const profile = makeProfile({ name: "loaded" });
      writeFileSync(join(tmpDir, "loaded.json"), JSON.stringify(profile));

      manager.loadAll();
      expect(manager.list()).toHaveLength(1);
      expect(manager.get("loaded")).toBeDefined();
      expect(manager.get("loaded")!.name).toBe("loaded");
    });

    test("loads multiple profiles", () => {
      writeFileSync(join(tmpDir, "a.json"), JSON.stringify(makeProfile({ name: "a" })));
      writeFileSync(join(tmpDir, "b.json"), JSON.stringify(makeProfile({ name: "b" })));
      writeFileSync(join(tmpDir, "c.json"), JSON.stringify(makeProfile({ name: "c" })));

      manager.loadAll();
      expect(manager.list()).toHaveLength(3);
    });

    test("ignores non-JSON files", () => {
      writeFileSync(join(tmpDir, "a.json"), JSON.stringify(makeProfile({ name: "a" })));
      writeFileSync(join(tmpDir, "readme.txt"), "not a profile");

      manager.loadAll();
      expect(manager.list()).toHaveLength(1);
    });

    test("skips invalid profile files without crashing", () => {
      writeFileSync(join(tmpDir, "valid.json"), JSON.stringify(makeProfile({ name: "valid" })));
      writeFileSync(join(tmpDir, "invalid.json"), "not valid json{{{");

      manager.loadAll();
      expect(manager.list()).toHaveLength(1);
      expect(manager.get("valid")).toBeDefined();
    });

    test("handles missing directory gracefully", () => {
      const missingManager = new ProfileManager("/tmp/does-not-exist-fmwk-pwr-test", mockHw);
      missingManager.loadAll();
      expect(missingManager.list()).toHaveLength(0);
    });

    test("clears previous profiles on reload", () => {
      writeFileSync(join(tmpDir, "a.json"), JSON.stringify(makeProfile({ name: "a" })));
      manager.loadAll();
      expect(manager.list()).toHaveLength(1);

      // Remove the file and reload
      rmSync(join(tmpDir, "a.json"));
      manager.loadAll();
      expect(manager.list()).toHaveLength(0);
    });
  });

  describe("create", () => {
    test("creates a new profile", async () => {
      const profile = makeProfile({ name: "new-profile" });
      const created = await manager.create(profile);

      expect(created.name).toBe("new-profile");
      expect(manager.get("new-profile")).toBeDefined();
    });

    test("persists profile to disk", async () => {
      const profile = makeProfile({ name: "persisted" });
      await manager.create(profile);

      const filePath = join(tmpDir, "persisted.json");
      expect(existsSync(filePath)).toBe(true);

      const onDisk = JSON.parse(readFileSync(filePath, "utf-8"));
      expect(onDisk.name).toBe("persisted");
    });

    test("rejects duplicate profile name", async () => {
      await manager.create(makeProfile({ name: "dup" }));
      await expect(manager.create(makeProfile({ name: "dup" }))).rejects.toThrow(
        "already exists",
      );
    });

    test("rejects invalid profile name (starts with hyphen)", async () => {
      await expect(
        manager.create(makeProfile({ name: "-bad" })),
      ).rejects.toThrow("Profile name must be alphanumeric");
    });

    test("rejects invalid profile name (spaces)", async () => {
      await expect(
        manager.create(makeProfile({ name: "has space" })),
      ).rejects.toThrow("Profile name must be alphanumeric");
    });

    test("rejects invalid profile name (empty)", async () => {
      await expect(
        manager.create(makeProfile({ name: "" })),
      ).rejects.toThrow("Profile name must be alphanumeric");
    });

    test("accepts profile with description", async () => {
      const profile = makeProfile({ name: "described", description: "A test profile" });
      const created = await manager.create(profile);
      expect(created.description).toBe("A test profile");
    });

    test("validates through hardware strategy", async () => {
      const failHw = createMockHardware();
      failHw.validateProfile = () => ["STAPM too high"];
      const failManager = new ProfileManager(tmpDir, failHw);

      await expect(
        failManager.create(makeProfile({ name: "fail" })),
      ).rejects.toThrow("Validation failed");
    });
  });

  describe("update", () => {
    test("updates an existing profile", async () => {
      await manager.create(makeProfile({ name: "original" }));

      const updated = await manager.update(
        "original",
        makeProfile({ name: "original", description: "updated desc" }),
      );
      expect(updated.description).toBe("updated desc");
    });

    test("rejects update of non-existent profile", async () => {
      await expect(
        manager.update("ghost", makeProfile({ name: "ghost" })),
      ).rejects.toThrow("not found");
    });

    test("handles rename by removing old file", async () => {
      await manager.create(makeProfile({ name: "old-name" }));
      expect(existsSync(join(tmpDir, "old-name.json"))).toBe(true);

      await manager.update("old-name", makeProfile({ name: "new-name" }));

      expect(existsSync(join(tmpDir, "old-name.json"))).toBe(false);
      expect(existsSync(join(tmpDir, "new-name.json"))).toBe(true);
      expect(manager.get("old-name")).toBeUndefined();
      expect(manager.get("new-name")).toBeDefined();
    });

    test("persists updated profile to disk", async () => {
      await manager.create(makeProfile({ name: "updatable" }));
      await manager.update(
        "updatable",
        makeProfile({
          name: "updatable",
          power: { stapmLimit: 100000, slowLimit: 120000, fastLimit: null },
        }),
      );

      const onDisk = JSON.parse(readFileSync(join(tmpDir, "updatable.json"), "utf-8"));
      expect(onDisk.power.stapmLimit).toBe(100000);
      expect(onDisk.power.slowLimit).toBe(120000);
    });
  });

  describe("delete", () => {
    test("deletes an existing profile", async () => {
      await manager.create(makeProfile({ name: "doomed" }));
      expect(manager.get("doomed")).toBeDefined();

      await manager.delete("doomed");
      expect(manager.get("doomed")).toBeUndefined();
    });

    test("removes file from disk", async () => {
      await manager.create(makeProfile({ name: "doomed" }));
      expect(existsSync(join(tmpDir, "doomed.json"))).toBe(true);

      await manager.delete("doomed");
      expect(existsSync(join(tmpDir, "doomed.json"))).toBe(false);
    });

    test("rejects delete of non-existent profile", async () => {
      await expect(manager.delete("ghost")).rejects.toThrow("not found");
    });
  });

  describe("apply", () => {
    test("returns profile and hwInfo on apply", async () => {
      await manager.create(makeProfile({ name: "apply-me" }));
      const result = await manager.apply("apply-me");

      expect(result.profile.name).toBe("apply-me");
      expect(result.hwInfo.stapmLimit).toBe(65000);
    });

    test("rejects apply of non-existent profile", async () => {
      await expect(manager.apply("ghost")).rejects.toThrow("not found");
    });

    test("calls applyPowerLimits with profile values", async () => {
      const captured: { stapm: number | null; slow: number | null; fast: number | null }[] = [];
      mockHw.applyPowerLimits = (stapm, slow, fast) => {
        captured.push({ stapm, slow, fast });
      };

      await manager.create(
        makeProfile({
          name: "power-test",
          power: { stapmLimit: 100000, slowLimit: 120000, fastLimit: 150000 },
        }),
      );
      await manager.apply("power-test");

      expect(captured).toHaveLength(1);
      expect(captured[0].stapm).toBe(100000);
      expect(captured[0].slow).toBe(120000);
      expect(captured[0].fast).toBe(150000);
    });

    test("calls applyGpuClock when clockMhz is set", async () => {
      const capturedClocks: (number | null)[] = [];
      mockHw.applyGpuClock = async (clockMhz) => {
        capturedClocks.push(clockMhz);
      };

      await manager.create(
        makeProfile({
          name: "gpu-clock-test",
          gpu: { clockMhz: 2500, perfLevel: null },
        }),
      );
      await manager.apply("gpu-clock-test");

      expect(capturedClocks).toHaveLength(1);
      expect(capturedClocks[0]).toBe(2500);
    });

    test("calls applyGpuPerfLevel when clockMhz is null", async () => {
      const capturedLevels: ("auto" | "high" | null)[] = [];
      mockHw.applyGpuPerfLevel = async (level) => {
        capturedLevels.push(level);
      };

      await manager.create(
        makeProfile({
          name: "perf-level-test",
          gpu: { clockMhz: null, perfLevel: "high" },
        }),
      );
      await manager.apply("perf-level-test");

      expect(capturedLevels).toHaveLength(1);
      expect(capturedLevels[0]).toBe("high");
    });

    test("calls applyGpuPerfLevel with null when both are null", async () => {
      let capturedLevel: "auto" | "high" | null = "auto";
      mockHw.applyGpuPerfLevel = async (level) => {
        capturedLevel = level;
      };

      await manager.create(
        makeProfile({
          name: "null-perf-test",
          gpu: { clockMhz: null, perfLevel: null },
        }),
      );
      await manager.apply("null-perf-test");

      expect(capturedLevel).toBeNull();
    });

    test("calls applyTunedProfile with profile value", async () => {
      const capturedTuned: (string | null)[] = [];
      mockHw.applyTunedProfile = async (name) => {
        capturedTuned.push(name);
      };

      await manager.create(
        makeProfile({
          name: "tuned-test",
          tunedProfile: "throughput-performance",
        }),
      );
      await manager.apply("tuned-test");

      expect(capturedTuned).toHaveLength(1);
      expect(capturedTuned[0]).toBe("throughput-performance");
    });

    test("does not call applyGpuClock when clockMhz is null", async () => {
      let gpuClockCalled = false;
      mockHw.applyGpuClock = async () => {
        gpuClockCalled = true;
      };

      await manager.create(
        makeProfile({
          name: "no-clock-test",
          gpu: { clockMhz: null, perfLevel: "auto" },
        }),
      );
      await manager.apply("no-clock-test");

      expect(gpuClockCalled).toBe(false);
    });
  });

  describe("list and get", () => {
    test("list returns all loaded profiles", async () => {
      await manager.create(makeProfile({ name: "a" }));
      await manager.create(makeProfile({ name: "b" }));

      const all = manager.list();
      expect(all).toHaveLength(2);
      expect(all.map((p) => p.name).sort()).toEqual(["a", "b"]);
    });

    test("get returns undefined for missing profile", () => {
      expect(manager.get("missing")).toBeUndefined();
    });

    test("get returns the profile by name", async () => {
      await manager.create(makeProfile({ name: "findable" }));
      const found = manager.get("findable");
      expect(found).toBeDefined();
      expect(found!.name).toBe("findable");
    });
  });
});

describe("profile validation", () => {
  const tmpDir = join(import.meta.dir, ".tmp-validation-test");
  let manager: ProfileManager;

  beforeEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(tmpDir, { recursive: true });
    manager = new ProfileManager(tmpDir, createMockHardware());
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("rejects profile with non-string name", async () => {
    const bad = { ...makeProfile(), name: 123 } as unknown as Profile;
    await expect(manager.create(bad)).rejects.toThrow("Profile name");
  });

  test("rejects profile with missing power object", async () => {
    const bad = { name: "x", gpu: { clockMhz: null, perfLevel: null }, tunedProfile: null, match: { enabled: false, processPatterns: [], priority: 0 } } as unknown as Profile;
    await expect(manager.create(bad)).rejects.toThrow("power must be an object");
  });

  test("rejects profile with missing gpu object", async () => {
    const bad = { name: "x", power: { stapmLimit: null, slowLimit: null, fastLimit: null }, tunedProfile: null, match: { enabled: false, processPatterns: [], priority: 0 } } as unknown as Profile;
    await expect(manager.create(bad)).rejects.toThrow("gpu must be an object");
  });

  test("rejects profile with non-number power limit", async () => {
    const bad = makeProfile();
    (bad.power as Record<string, unknown>).stapmLimit = "not a number";
    await expect(manager.create(bad)).rejects.toThrow("must be a number or null");
  });

  test("rejects profile with invalid perfLevel", async () => {
    const bad = makeProfile();
    (bad.gpu as Record<string, unknown>).perfLevel = "manual";
    await expect(manager.create(bad)).rejects.toThrow("perfLevel");
  });

  test("rejects profile with non-boolean match.enabled", async () => {
    const bad = makeProfile();
    (bad.match as Record<string, unknown>).enabled = "yes";
    await expect(manager.create(bad)).rejects.toThrow("match.enabled must be a boolean");
  });

  test("rejects profile with non-array processPatterns", async () => {
    const bad = makeProfile();
    (bad.match as Record<string, unknown>).processPatterns = "not-array";
    await expect(manager.create(bad)).rejects.toThrow("must be an array");
  });

  test("rejects profile with invalid regex pattern", async () => {
    const bad = makeProfile();
    bad.match.processPatterns = ["valid", "[invalid"];
    await expect(manager.create(bad)).rejects.toThrow("Invalid regex pattern");
  });

  test("rejects profile with non-number priority", async () => {
    const bad = makeProfile();
    (bad.match as Record<string, unknown>).priority = "high";
    await expect(manager.create(bad)).rejects.toThrow("match.priority must be a number");
  });

  test("rejects profile with non-string tunedProfile", async () => {
    const bad = makeProfile();
    (bad as unknown as Record<string, unknown>).tunedProfile = 123;
    await expect(manager.create(bad)).rejects.toThrow("tunedProfile must be a string or null");
  });

  test("rejects profile with non-string description", async () => {
    const bad = makeProfile();
    (bad as unknown as Record<string, unknown>).description = 42;
    await expect(manager.create(bad)).rejects.toThrow("description must be a string");
  });

  test("accepts profile with valid name patterns", async () => {
    await manager.create(makeProfile({ name: "a" }));
    await manager.create(makeProfile({ name: "my-profile" }));
    await manager.create(makeProfile({ name: "Profile123" }));
    await manager.create(makeProfile({ name: "a1-b2-c3" }));
    expect(manager.list()).toHaveLength(4);
  });
});
