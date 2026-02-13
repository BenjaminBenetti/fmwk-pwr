import { describe, expect, test } from "bun:test";
import {
  Methods,
  type Profile,
  type ServerConfig,
  type HardwareInfo,
  type Request,
  type Response,
  type ErrorResponse,
  type MethodName,
  type MethodMap,
  type ProfileApplyResult,
  type StatusGetResult,
} from "../src/index.js";

describe("shared type exports", () => {
  test("Methods constant has all expected method names", () => {
    expect(Methods.ProfileList).toBe("profile.list");
    expect(Methods.ProfileGet).toBe("profile.get");
    expect(Methods.ProfileCreate).toBe("profile.create");
    expect(Methods.ProfileUpdate).toBe("profile.update");
    expect(Methods.ProfileDelete).toBe("profile.delete");
    expect(Methods.ProfileApply).toBe("profile.apply");
    expect(Methods.StatusGet).toBe("status.get");
    expect(Methods.ConfigGet).toBe("config.get");
    expect(Methods.ConfigUpdate).toBe("config.update");
  });

  test("Methods constant has exactly 9 methods", () => {
    expect(Object.keys(Methods)).toHaveLength(9);
  });

  test("Profile type can be constructed", () => {
    const profile: Profile = {
      name: "test",
      power: { stapmLimit: null, slowLimit: null, fastLimit: null },
      gpu: { clockMhz: null, perfLevel: null },
      tunedProfile: null,
      match: { enabled: false, processPatterns: [], priority: 0 },
    };
    expect(profile.name).toBe("test");
    expect(profile.description).toBeUndefined();
  });

  test("Profile type accepts optional description", () => {
    const profile: Profile = {
      name: "test",
      description: "A test profile",
      power: { stapmLimit: 100000, slowLimit: 120000, fastLimit: 150000 },
      gpu: { clockMhz: 2500, perfLevel: null },
      tunedProfile: "balanced",
      match: { enabled: true, processPatterns: ["steam"], priority: 10 },
    };
    expect(profile.description).toBe("A test profile");
    expect(profile.power.stapmLimit).toBe(100000);
    expect(profile.gpu.clockMhz).toBe(2500);
  });

  test("ServerConfig type can be constructed", () => {
    const config: ServerConfig = {
      gpuSysfsPath: "/sys/class/drm/card1/device",
      socketPath: "/run/fmwk-pwr/fmwk-pwr.sock",
      watcherIntervalMs: 5000,
      defaultProfile: "default",
    };
    expect(config.defaultProfile).toBe("default");
    expect(config.watcherIntervalMs).toBe(5000);
  });

  test("HardwareInfo type can be constructed with nullable fields", () => {
    const hwInfo: HardwareInfo = {
      stapmLimit: 65000,
      slowLimit: 75000,
      fastLimit: 85000,
      gpuClockMhz: null,
      tcpuTemp: null,
      cpuPower: null,
      gpuPower: null,
      socketPower: null,
      tunedProfile: "balanced",
    };
    expect(hwInfo.stapmLimit).toBe(65000);
    expect(hwInfo.gpuClockMhz).toBeNull();
  });

  test("Request type can be constructed", () => {
    const req: Request = {
      id: "abc-123",
      method: "profile.list",
    };
    expect(req.id).toBe("abc-123");
    expect(req.params).toBeUndefined();
  });

  test("Request type accepts params", () => {
    const req: Request = {
      id: "abc-123",
      method: "profile.get",
      params: { name: "default" },
    };
    expect(req.params).toEqual({ name: "default" });
  });

  test("Response type can be constructed", () => {
    const res: Response = {
      id: "abc-123",
      result: { profiles: [] },
    };
    expect(res.id).toBe("abc-123");
  });

  test("ErrorResponse type can be constructed", () => {
    const err: ErrorResponse = {
      id: "abc-123",
      error: { code: "NOT_FOUND", message: "Profile not found" },
    };
    expect(err.error.code).toBe("NOT_FOUND");
  });

  test("MethodName type includes all method values", () => {
    const names: MethodName[] = [
      "profile.list",
      "profile.get",
      "profile.create",
      "profile.update",
      "profile.delete",
      "profile.apply",
      "status.get",
      "config.get",
      "config.update",
    ];
    expect(names).toHaveLength(9);
  });

  test("ProfileApplyResult includes both profile and hwInfo", () => {
    const result: ProfileApplyResult = {
      profile: {
        name: "test",
        power: { stapmLimit: null, slowLimit: null, fastLimit: null },
        gpu: { clockMhz: null, perfLevel: null },
        tunedProfile: null,
        match: { enabled: false, processPatterns: [], priority: 0 },
      },
      hwInfo: {
        stapmLimit: 65000,
        slowLimit: 75000,
        fastLimit: 85000,
        gpuClockMhz: null,
        tcpuTemp: null,
        cpuPower: null,
        gpuPower: null,
        socketPower: null,
        tunedProfile: "balanced",
      },
    };
    expect(result.profile.name).toBe("test");
    expect(result.hwInfo.stapmLimit).toBe(65000);
  });

  test("StatusGetResult has correct activatedBy union type", () => {
    const results: StatusGetResult[] = [
      { activeProfile: "default", activatedBy: "startup", hwInfo: null },
      { activeProfile: "gaming", activatedBy: "manual", hwInfo: null },
      { activeProfile: "gaming", activatedBy: "auto", hwInfo: null },
    ];
    expect(results).toHaveLength(3);
  });

  test("GPU perfLevel only accepts auto, high, or null", () => {
    const profile1: Profile = {
      name: "a",
      power: { stapmLimit: null, slowLimit: null, fastLimit: null },
      gpu: { clockMhz: null, perfLevel: "auto" },
      tunedProfile: null,
      match: { enabled: false, processPatterns: [], priority: 0 },
    };
    const profile2: Profile = {
      name: "b",
      power: { stapmLimit: null, slowLimit: null, fastLimit: null },
      gpu: { clockMhz: null, perfLevel: "high" },
      tunedProfile: null,
      match: { enabled: false, processPatterns: [], priority: 0 },
    };
    const profile3: Profile = {
      name: "c",
      power: { stapmLimit: null, slowLimit: null, fastLimit: null },
      gpu: { clockMhz: null, perfLevel: null },
      tunedProfile: null,
      match: { enabled: false, processPatterns: [], priority: 0 },
    };
    expect(profile1.gpu.perfLevel).toBe("auto");
    expect(profile2.gpu.perfLevel).toBe("high");
    expect(profile3.gpu.perfLevel).toBeNull();
  });

  test("MethodMap keys match Methods values", () => {
    type Keys = keyof MethodMap;
    const keys: Keys[] = [
      "profile.list",
      "profile.get",
      "profile.create",
      "profile.update",
      "profile.delete",
      "profile.apply",
      "status.get",
      "config.get",
      "config.update",
    ];
    expect(keys).toHaveLength(9);
  });
});
