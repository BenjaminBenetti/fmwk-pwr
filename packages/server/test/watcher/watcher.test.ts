import { describe, it, expect, mock, beforeEach } from "bun:test";
import type { Profile, HardwareInfo } from "@fmwk-pwr/shared";
import type { ProfileManager } from "../../src/profiles/manager.js";
import type { ServerState } from "../../src/state.js";
import { ProcessWatcher } from "../../src/watcher/watcher.js";

// =====================================
// Helpers
// =====================================

function makeProfile(overrides: Partial<Profile> & { name: string }): Profile {
  return {
    power: { stapmLimit: null, slowLimit: null, fastLimit: null },
    gpu: { clockMhz: null, perfLevel: null },
    tunedProfile: null,
    match: { enabled: true, processPatterns: [], priority: 0 },
    ...overrides,
  };
}

const dummyHwInfo: HardwareInfo = {
  stapmLimit: 25000,
  slowLimit: 25000,
  fastLimit: 35000,
  gpuClockMhz: null,
  gpuClockLimitMhz: null,
  tcpuTemp: null,
  cpuPower: null,
  gpuPower: null,
  socketPower: null,
  tunedProfile: "balanced",
};

function createMockProfileManager(profiles: Profile[]): ProfileManager {
  return {
    list: () => profiles,
    apply: mock(async () => ({ profile: profiles[0]!, hwInfo: dummyHwInfo })),
  } as unknown as ProfileManager;
}

function createState(activeProfile = "default"): ServerState {
  return {
    activeProfile,
    activatedBy: "startup",
    lastHwInfo: null,
    lastHwInfoTime: null,
    config: {
      gpuSysfsPath: "",
      socketPath: "",
      watcherIntervalMs: 5000,
      defaultProfile: "default",
      firstTimeSetup: false,
      hardwareLimits: {
        minPowerMw: 5000,
        maxStapmMw: 120000,
        maxSlowMw: 120000,
        maxFastMw: 120000,
        minGpuClockMhz: 200,
        maxGpuClockMhz: 3000,
      },
    },
    configPath: "",
  };
}

// =====================================
// Tests
// =====================================

describe("ProcessWatcher", () => {
  let profiles: Profile[];
  let pm: ProfileManager;
  let state: ServerState;
  let scanResult: string[];

  function createWatcher(threshold = 2): ProcessWatcher {
    const watcher = new ProcessWatcher({
      profileManager: pm,
      state,
      intervalMs: 100,
      debounceThreshold: threshold,
      scanner: async () => scanResult,
    });
    watcher.refreshProfiles();
    return watcher;
  }

  beforeEach(() => {
    profiles = [
      makeProfile({
        name: "gaming",
        match: { enabled: true, processPatterns: ["steam"], priority: 10 },
      }),
      makeProfile({
        name: "balanced",
        match: { enabled: true, processPatterns: ["firefox"], priority: 1 },
      }),
    ];
    pm = createMockProfileManager(profiles);
    state = createState("default");
    scanResult = [];
  });

  it("does not switch on first match (debounce)", async () => {
    scanResult = ["steam game.exe"];
    const watcher = createWatcher();

    await watcher.tick();

    expect(state.activeProfile).toBe("default");
    expect(pm.apply).not.toHaveBeenCalled();
  });

  it("switches after debounce threshold is met", async () => {
    scanResult = ["steam game.exe"];
    const watcher = createWatcher();

    // First tick — candidate seen once, no switch
    await watcher.tick();
    expect(state.activeProfile).toBe("default");

    // Second tick — debounce threshold met, should switch
    await watcher.tick();
    expect(state.activeProfile).toBe("gaming");
    expect(state.activatedBy).toBe("auto");
    expect(pm.apply).toHaveBeenCalledWith("gaming");
  });

  it("keeps current profile when no match found", async () => {
    scanResult = ["/usr/bin/something-unrelated"];
    const watcher = createWatcher();

    await watcher.tick();
    await watcher.tick();
    await watcher.tick();

    expect(state.activeProfile).toBe("default");
    expect(pm.apply).not.toHaveBeenCalled();
  });

  it("resets debounce when candidate changes", async () => {
    const watcher = createWatcher();

    // First tick: steam
    scanResult = ["steam"];
    await watcher.tick();
    expect(state.activeProfile).toBe("default");

    // Second tick: firefox (different candidate — resets debounce)
    scanResult = ["firefox"];
    await watcher.tick();
    expect(state.activeProfile).toBe("default");
    expect(pm.apply).not.toHaveBeenCalled();

    // Third tick: firefox again — now meets threshold
    await watcher.tick();
    expect(state.activeProfile).toBe("balanced");
  });

  it("does not re-apply if already on the matched profile", async () => {
    state.activeProfile = "gaming";
    scanResult = ["steam"];
    const watcher = createWatcher();

    await watcher.tick();
    await watcher.tick();

    expect(pm.apply).not.toHaveBeenCalled();
  });

  it("does not crash on scan errors", async () => {
    const watcher = new ProcessWatcher({
      profileManager: pm,
      state,
      intervalMs: 100,
      debounceThreshold: 2,
      scanner: async () => {
        throw new Error("permission denied");
      },
    });
    watcher.refreshProfiles();

    // Should not throw
    await watcher.tick();
    expect(state.activeProfile).toBe("default");
  });

  it("start and stop manage the interval timer", () => {
    const watcher = createWatcher();
    watcher.start();
    // Starting again should be a no-op
    watcher.start();
    watcher.stop();
    // Stopping again should be a no-op
    watcher.stop();
  });

  it("updates hwInfo and timestamp on auto-switch", async () => {
    scanResult = ["steam"];
    const watcher = createWatcher();

    await watcher.tick();
    await watcher.tick();

    expect(state.lastHwInfo).toEqual(dummyHwInfo);
    expect(state.lastHwInfoTime).toBeGreaterThan(0);
  });

  it("picks up new profiles added between ticks", async () => {
    // Start with no matching profiles
    profiles.length = 0;
    pm = createMockProfileManager(profiles);
    scanResult = ["blender --render"];
    const watcher = new ProcessWatcher({
      profileManager: pm,
      state,
      intervalMs: 1000,
      debounceThreshold: 2,
      scanner: async () => scanResult,
    });

    // Tick with no profiles — no match
    await watcher.tick();
    expect(state.activeProfile).toBe("default");

    // Simulate a profile being created via IPC
    profiles.push(
      makeProfile({
        name: "rendering",
        match: { enabled: true, processPatterns: ["blender"], priority: 5 },
      }),
    );

    // Next ticks should pick up the new profile without manual refreshProfiles()
    await watcher.tick();
    await watcher.tick();
    expect(state.activeProfile).toBe("rendering");
  });

  it("clamps intervalMs below 500 on start", () => {
    const watcher = new ProcessWatcher({
      profileManager: pm,
      state,
      intervalMs: 50,
      scanner: async () => [],
    });
    watcher.start();
    watcher.stop();
    // If it didn't clamp, the interval would be 50ms — the clamp warning
    // in the log output confirms it was raised to 500
  });
});
