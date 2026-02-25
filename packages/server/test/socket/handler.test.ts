import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Request, ErrorResponse, Profile, HardwareInfo } from "@fmwk-pwr/shared";
import { Methods } from "@fmwk-pwr/shared";
import type { HardwareStrategy } from "../../src/hardware/strategy.js";
import type { ServerState } from "../../src/state.js";
import { ProfileManager } from "../../src/profiles/manager.js";
import { createHandler } from "../../src/socket/handler.js";

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    name: "test-profile",
    power: { stapmLimit: null, slowLimit: null, fastLimit: null },
    cpu: { maxClockMhz: null },
    gpu: { maxClockMhz: null, minClockMhz: null, perfLevel: null },
    tunedProfile: null,
    match: { enabled: false, processPatterns: [], priority: 0, revertProfile: null },
    ...overrides,
  };
}

const mockHwInfo: HardwareInfo = {
  stapmLimit: 65000,
  slowLimit: 75000,
  fastLimit: 85000,
  cpuClockMhz: null,
  gpuClockMhz: null,
  gpuClockLimitMhz: null,
  gpuMinClockLimitMhz: null,
  tcpuTemp: 45,
  cpuPower: null,
  gpuPower: null,
  socketPower: 60000,
  cpuUsagePercent: null,
  gpuUsagePercent: null,
  tunedProfile: "balanced",
};

function createMockHardware(): HardwareStrategy {
  return {
    name: "Mock",
    hardwareLimits: {
      minPowerMw: 15_000,
      maxStapmMw: 132_000,
      maxSlowMw: 154_000,
      maxFastMw: 170_000,
      minGpuClockMhz: 200,
      maxGpuClockMhz: 3_000,
      minCpuClockMhz: 400,
      maxCpuClockMhz: 5_500,
    },
    setHardwareLimits() {},
    applyPowerLimits() {},
    async applyCpuMaxClock() {},
    async applyGpuClock() {},
    async applyGpuPerfLevel() {},
    async applyTunedProfile() {},
    async readHardwareInfo() {
      return { ...mockHwInfo };
    },
    validateProfile() {
      return [];
    },
    destroy() {},
  };
}

function createState(): ServerState {
  return {
    activeProfile: "default",
    activatedBy: "startup",
    lastHwInfo: null,
    lastHwInfoTime: null,
    configPath: join(import.meta.dir, ".tmp-handler-test", "config.json"),
    config: {
      gpuSysfsPath: "/sys/class/drm/card1/device",
      socketPath: "/run/fmwk-pwr/fmwk-pwr.sock",
      watcherIntervalMs: 5000,
      defaultProfile: "default",
      firstTimeSetup: true,
      hardwareLimits: {
        minPowerMw: 15_000,
        maxStapmMw: 132_000,
        maxSlowMw: 154_000,
        maxFastMw: 170_000,
        minGpuClockMhz: 200,
        maxGpuClockMhz: 3_000,
        minCpuClockMhz: 400,
        maxCpuClockMhz: 5_500,
      },
      user: { theme: "default", compact: false, collapsedSections: { power: false, cpu: false, gpu: false, sensors: true, autoMatch: true } },
    },
  };
}

function isError(response: unknown): response is ErrorResponse {
  return typeof response === "object" && response !== null && "error" in response;
}

describe("message handler", () => {
  const tmpDir = join(import.meta.dir, ".tmp-handler-test");
  const presetsDir = join(import.meta.dir, ".tmp-handler-presets");
  let handler: (request: Request) => Promise<unknown>;
  let state: ServerState;
  let profileManager: ProfileManager;

  beforeEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    rmSync(presetsDir, { recursive: true, force: true });
    mkdirSync(tmpDir, { recursive: true });
    mkdirSync(presetsDir, { recursive: true });

    const defaultProfile = makeProfile({ name: "default" });
    writeFileSync(join(tmpDir, "default.json"), JSON.stringify(defaultProfile));

    const mockHw = createMockHardware();
    profileManager = new ProfileManager(tmpDir, mockHw);
    profileManager.loadAll();
    state = createState();
    handler = createHandler(profileManager, state, mockHw, presetsDir);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    rmSync(presetsDir, { recursive: true, force: true });
  });

  describe("profile.list", () => {
    test("returns list of profiles", async () => {
      const response = await handler({ id: "1", method: Methods.ProfileList });
      expect(isError(response)).toBe(false);
      const result = (response as { id: string; result: { profiles: Profile[] } }).result;
      expect(result.profiles).toHaveLength(1);
      expect(result.profiles[0].name).toBe("default");
    });
  });

  describe("profile.get", () => {
    test("returns a profile by name", async () => {
      const response = await handler({
        id: "1",
        method: Methods.ProfileGet,
        params: { name: "default" },
      });
      expect(isError(response)).toBe(false);
      const result = (response as { id: string; result: { profile: Profile } }).result;
      expect(result.profile.name).toBe("default");
    });

    test("returns error for missing profile", async () => {
      const response = await handler({
        id: "1",
        method: Methods.ProfileGet,
        params: { name: "ghost" },
      });
      expect(isError(response)).toBe(true);
      expect((response as ErrorResponse).error.code).toBe("PROFILE_NOT_FOUND");
    });

    test("returns error when name is missing", async () => {
      const response = await handler({
        id: "1",
        method: Methods.ProfileGet,
        params: {},
      });
      expect(isError(response)).toBe(true);
      expect((response as ErrorResponse).error.code).toBe("INVALID_PARAMS");
    });
  });

  describe("profile.create", () => {
    test("creates a new profile", async () => {
      const response = await handler({
        id: "1",
        method: Methods.ProfileCreate,
        params: { profile: makeProfile({ name: "new-one" }) },
      });
      expect(isError(response)).toBe(false);
      const result = (response as { id: string; result: { profile: Profile } }).result;
      expect(result.profile.name).toBe("new-one");
    });

    test("returns error for duplicate name", async () => {
      const response = await handler({
        id: "1",
        method: Methods.ProfileCreate,
        params: { profile: makeProfile({ name: "default" }) },
      });
      expect(isError(response)).toBe(true);
      expect((response as ErrorResponse).error.code).toBe("VALIDATION_ERROR");
    });

    test("returns error when profile is missing", async () => {
      const response = await handler({
        id: "1",
        method: Methods.ProfileCreate,
        params: {},
      });
      expect(isError(response)).toBe(true);
      expect((response as ErrorResponse).error.code).toBe("INVALID_PARAMS");
    });
  });

  describe("profile.update", () => {
    test("updates an existing profile", async () => {
      const response = await handler({
        id: "1",
        method: Methods.ProfileUpdate,
        params: {
          name: "default",
          profile: makeProfile({ name: "default", description: "updated" }),
        },
      });
      expect(isError(response)).toBe(false);
      const result = (response as { id: string; result: { profile: Profile } }).result;
      expect(result.profile.description).toBe("updated");
    });

    test("returns error for non-existent profile", async () => {
      const response = await handler({
        id: "1",
        method: Methods.ProfileUpdate,
        params: {
          name: "ghost",
          profile: makeProfile({ name: "ghost" }),
        },
      });
      expect(isError(response)).toBe(true);
      expect((response as ErrorResponse).error.code).toBe("PROFILE_NOT_FOUND");
    });

    test("returns error when params missing", async () => {
      const response = await handler({
        id: "1",
        method: Methods.ProfileUpdate,
        params: {},
      });
      expect(isError(response)).toBe(true);
      expect((response as ErrorResponse).error.code).toBe("INVALID_PARAMS");
    });
  });

  describe("profile.delete", () => {
    test("deletes a non-active, non-default profile", async () => {
      await handler({
        id: "1",
        method: Methods.ProfileCreate,
        params: { profile: makeProfile({ name: "deletable" }) },
      });

      const response = await handler({
        id: "2",
        method: Methods.ProfileDelete,
        params: { name: "deletable" },
      });
      expect(isError(response)).toBe(false);
      const result = (response as { id: string; result: { success: boolean } }).result;
      expect(result.success).toBe(true);
    });

    test("prevents deleting active profile", async () => {
      const response = await handler({
        id: "1",
        method: Methods.ProfileDelete,
        params: { name: "default" },
      });
      expect(isError(response)).toBe(true);
      expect((response as ErrorResponse).error.code).toBe("CANNOT_DELETE_ACTIVE");
    });

    test("allows deleting default profile and reassigns defaultProfile", async () => {
      // Create another profile and make it active, so "default" is not active
      await handler({
        id: "1",
        method: Methods.ProfileCreate,
        params: { profile: makeProfile({ name: "other" }) },
      });
      await handler({
        id: "2",
        method: Methods.ProfileApply,
        params: { name: "other" },
      });

      // Now delete "default" (still the defaultProfile in config)
      const response = await handler({
        id: "3",
        method: Methods.ProfileDelete,
        params: { name: "default" },
      });
      expect(isError(response)).toBe(false);
      // defaultProfile should be reassigned to the active profile
      expect(state.config.defaultProfile).toBe("other");
    });

    test("returns error for non-existent profile", async () => {
      const response = await handler({
        id: "1",
        method: Methods.ProfileDelete,
        params: { name: "ghost" },
      });
      expect(isError(response)).toBe(true);
      expect((response as ErrorResponse).error.code).toBe("PROFILE_NOT_FOUND");
    });
  });

  describe("profile.apply", () => {
    test("applies a profile and updates state", async () => {
      const response = await handler({
        id: "1",
        method: Methods.ProfileApply,
        params: { name: "default" },
      });
      expect(isError(response)).toBe(false);

      expect(state.activeProfile).toBe("default");
      expect(state.activatedBy).toBe("manual");
      expect(state.lastHwInfo).not.toBeNull();
      expect(state.lastHwInfoTime).not.toBeNull();
    });

    test("returns profile and hwInfo in result", async () => {
      const response = await handler({
        id: "1",
        method: Methods.ProfileApply,
        params: { name: "default" },
      });
      expect(isError(response)).toBe(false);
      const result = (response as { id: string; result: { profile: Profile; hwInfo: HardwareInfo } }).result;
      expect(result.profile.name).toBe("default");
      expect(result.hwInfo.stapmLimit).toBe(65000);
    });

    test("returns error for non-existent profile", async () => {
      const response = await handler({
        id: "1",
        method: Methods.ProfileApply,
        params: { name: "ghost" },
      });
      expect(isError(response)).toBe(true);
      expect((response as ErrorResponse).error.code).toBe("APPLY_ERROR");
    });
  });

  describe("status.get", () => {
    test("returns current server state", async () => {
      const response = await handler({ id: "1", method: Methods.StatusGet });
      expect(isError(response)).toBe(false);
      const result = (response as { id: string; result: { activeProfile: string; activatedBy: string; hwInfo: HardwareInfo | null } }).result;
      expect(result.activeProfile).toBe("default");
      expect(result.activatedBy).toBe("startup");
      expect(result.hwInfo).not.toBeNull();
    });

    test("reflects state changes after apply", async () => {
      await handler({
        id: "1",
        method: Methods.ProfileApply,
        params: { name: "default" },
      });

      const response = await handler({ id: "2", method: Methods.StatusGet });
      const result = (response as { id: string; result: { activeProfile: string; activatedBy: string; hwInfo: HardwareInfo | null } }).result;
      expect(result.activeProfile).toBe("default");
      expect(result.activatedBy).toBe("manual");
      expect(result.hwInfo).not.toBeNull();
    });
  });

  describe("config.get", () => {
    test("returns server config", async () => {
      const response = await handler({ id: "1", method: Methods.ConfigGet });
      expect(isError(response)).toBe(false);
      const result = (response as { id: string; result: { config: { defaultProfile: string } } }).result;
      expect(result.config.defaultProfile).toBe("default");
    });
  });

  describe("config.update", () => {
    test("updates config partially", async () => {
      const response = await handler({
        id: "1",
        method: Methods.ConfigUpdate,
        params: { config: { watcherIntervalMs: 10000 } },
      });
      expect(isError(response)).toBe(false);
      expect(state.config.watcherIntervalMs).toBe(10000);
      // Other fields unchanged
      expect(state.config.defaultProfile).toBe("default");
    });

    test("validates watcherIntervalMs must be positive", async () => {
      const response = await handler({
        id: "1",
        method: Methods.ConfigUpdate,
        params: { config: { watcherIntervalMs: -1 } },
      });
      expect(isError(response)).toBe(true);
      expect((response as ErrorResponse).error.code).toBe("INVALID_PARAMS");
    });

    test("validates defaultProfile must be non-empty", async () => {
      const response = await handler({
        id: "1",
        method: Methods.ConfigUpdate,
        params: { config: { defaultProfile: "" } },
      });
      expect(isError(response)).toBe(true);
      expect((response as ErrorResponse).error.code).toBe("INVALID_PARAMS");
    });

    test("returns error when config is missing", async () => {
      const response = await handler({
        id: "1",
        method: Methods.ConfigUpdate,
        params: {},
      });
      expect(isError(response)).toBe(true);
      expect((response as ErrorResponse).error.code).toBe("INVALID_PARAMS");
    });
  });

  describe("unknown method", () => {
    test("returns METHOD_NOT_FOUND for unknown methods", async () => {
      const response = await handler({
        id: "1",
        method: "unknown.method",
      });
      expect(isError(response)).toBe(true);
      expect((response as ErrorResponse).error.code).toBe("METHOD_NOT_FOUND");
    });
  });

  describe("preset.list", () => {
    test("returns empty list when no preset files", async () => {
      const response = await handler({ id: "1", method: Methods.PresetList });
      expect(isError(response)).toBe(false);
      const result = (response as { id: string; result: { presets: unknown[] } }).result;
      expect(result.presets).toHaveLength(0);
    });

    test("returns presets from JSON files", async () => {
      const preset = {
        name: "Framework Desktop",
        description: "Default limits for Framework Desktop",
        hardwareLimits: {
          minPowerMw: 15_000,
          maxStapmMw: 132_000,
          maxSlowMw: 154_000,
          maxFastMw: 170_000,
          minGpuClockMhz: 200,
          maxGpuClockMhz: 3_000,
          minCpuClockMhz: 400,
          maxCpuClockMhz: 5_500,
        },
      };
      writeFileSync(join(presetsDir, "framework-desktop.json"), JSON.stringify(preset));

      const response = await handler({ id: "1", method: Methods.PresetList });
      expect(isError(response)).toBe(false);
      const result = (response as { id: string; result: { presets: { name: string }[] } }).result;
      expect(result.presets).toHaveLength(1);
      expect(result.presets[0].name).toBe("Framework Desktop");
    });
  });

  describe("preset.load", () => {
    const testPreset = {
      name: "Custom Device",
      description: "Custom limits",
      hardwareLimits: {
        minPowerMw: 10_000,
        maxStapmMw: 100_000,
        maxSlowMw: 120_000,
        maxFastMw: 140_000,
        minGpuClockMhz: 100,
        maxGpuClockMhz: 2_500,
        minCpuClockMhz: 400,
        maxCpuClockMhz: 5_500,
      },
    };

    test("loads a preset and updates config", async () => {
      writeFileSync(join(presetsDir, "custom.json"), JSON.stringify(testPreset));

      const response = await handler({
        id: "1",
        method: Methods.PresetLoad,
        params: { name: "Custom Device" },
      });
      expect(isError(response)).toBe(false);
      expect(state.config.hardwareLimits.maxStapmMw).toBe(100_000);
      expect(state.config.hardwareLimits.minGpuClockMhz).toBe(100);
    });

    test("sets firstTimeSetup to false", async () => {
      writeFileSync(join(presetsDir, "custom.json"), JSON.stringify(testPreset));
      expect(state.config.firstTimeSetup).toBe(true);

      await handler({
        id: "1",
        method: Methods.PresetLoad,
        params: { name: "Custom Device" },
      });
      expect(state.config.firstTimeSetup).toBe(false);
    });

    test("returns error for non-existent preset", async () => {
      const response = await handler({
        id: "1",
        method: Methods.PresetLoad,
        params: { name: "nonexistent" },
      });
      expect(isError(response)).toBe(true);
      expect((response as ErrorResponse).error.code).toBe("INVALID_PARAMS");
    });

    test("calls setHardwareLimits on hardware", async () => {
      writeFileSync(join(presetsDir, "custom.json"), JSON.stringify(testPreset));

      let capturedLimits: unknown = null;
      const trackingHw = createMockHardware();
      trackingHw.setHardwareLimits = (limits) => {
        capturedLimits = limits;
      };

      const trackingProfileManager = new ProfileManager(tmpDir, trackingHw);
      trackingProfileManager.loadAll();
      const trackingState = createState();
      const trackingHandler = createHandler(trackingProfileManager, trackingState, trackingHw, presetsDir);

      await trackingHandler({
        id: "1",
        method: Methods.PresetLoad,
        params: { name: "Custom Device" },
      });
      expect(capturedLimits).not.toBeNull();
      expect((capturedLimits as { maxStapmMw: number }).maxStapmMw).toBe(100_000);
    });
  });

  describe("request ID preservation", () => {
    test("response preserves the request id", async () => {
      const response = await handler({
        id: "my-unique-id-123",
        method: Methods.ProfileList,
      });
      expect((response as { id: string }).id).toBe("my-unique-id-123");
    });

    test("error response preserves the request id", async () => {
      const response = await handler({
        id: "err-id-456",
        method: "nonexistent",
      });
      expect((response as ErrorResponse).id).toBe("err-id-456");
    });
  });
});
