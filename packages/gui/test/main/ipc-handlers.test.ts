import { describe, test, expect, beforeEach, mock } from "bun:test";
import { Methods } from "@fmwk-pwr/shared";
import type { Profile, ServerConfig } from "@fmwk-pwr/shared";

// ── Mock electron before importing ipc-handlers ─────────────────

const handlers = new Map<string, (...args: unknown[]) => unknown>();

mock.module("electron", () => ({
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(channel, handler);
    },
  },
}));

// Import AFTER mock
const { registerIpcHandlers, setupConnectionForwarding } = await import(
  "../../src/main/ipc-handlers.js"
);

// ── Helpers ─────────────────────────────────────────────────────

function makeProfile(name = "test"): Profile {
  return {
    name,
    power: { stapmLimit: null, slowLimit: null, fastLimit: null },
    cpu: { maxClockMhz: null, minClockMhz: null },
    gpu: { maxClockMhz: null, minClockMhz: null, perfLevel: null },
    tunedProfile: null,
    match: { enabled: false, processPatterns: [], priority: 0, revertProfile: null },
  };
}

function createMockClient() {
  return {
    request: mock(async (_method: string, params: unknown) => ({ mocked: true, params })),
    getState: mock(() => "connected" as const),
    onStateChange: mock((_cb: (state: string) => void) => {
      return () => {};
    }),
  };
}

// ── Tests ───────────────────────────────────────────────────────

describe("registerIpcHandlers", () => {
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    handlers.clear();
    mockClient = createMockClient();
    registerIpcHandlers(mockClient as any);
  });

  test("registers all expected channels", () => {
    const expected = [
      "profile:list", "profile:get", "profile:create", "profile:update",
      "profile:delete", "profile:apply", "status:get", "config:get",
      "config:update", "preset:list", "preset:load", "connection:state",
    ];
    for (const channel of expected) {
      expect(handlers.has(channel)).toBe(true);
    }
  });

  test("profile:list forwards to profile.list with empty params", async () => {
    const handler = handlers.get("profile:list")!;
    await handler({});
    expect(mockClient.request).toHaveBeenCalledWith(Methods.ProfileList, {});
  });

  test("profile:get forwards name param", async () => {
    const handler = handlers.get("profile:get")!;
    await handler({}, "my-profile");
    expect(mockClient.request).toHaveBeenCalledWith(Methods.ProfileGet, { name: "my-profile" });
  });

  test("profile:create forwards profile param", async () => {
    const handler = handlers.get("profile:create")!;
    const profile = makeProfile("new");
    await handler({}, profile);
    expect(mockClient.request).toHaveBeenCalledWith(Methods.ProfileCreate, { profile });
  });

  test("profile:update forwards name and profile params", async () => {
    const handler = handlers.get("profile:update")!;
    const profile = makeProfile("updated");
    await handler({}, "old-name", profile);
    expect(mockClient.request).toHaveBeenCalledWith(Methods.ProfileUpdate, {
      name: "old-name",
      profile,
    });
  });

  test("profile:delete forwards name param", async () => {
    const handler = handlers.get("profile:delete")!;
    await handler({}, "to-delete");
    expect(mockClient.request).toHaveBeenCalledWith(Methods.ProfileDelete, { name: "to-delete" });
  });

  test("profile:apply forwards name param", async () => {
    const handler = handlers.get("profile:apply")!;
    await handler({}, "gaming");
    expect(mockClient.request).toHaveBeenCalledWith(Methods.ProfileApply, { name: "gaming" });
  });

  test("status:get forwards with empty params", async () => {
    const handler = handlers.get("status:get")!;
    await handler({});
    expect(mockClient.request).toHaveBeenCalledWith(Methods.StatusGet, {});
  });

  test("config:get forwards with empty params", async () => {
    const handler = handlers.get("config:get")!;
    await handler({});
    expect(mockClient.request).toHaveBeenCalledWith(Methods.ConfigGet, {});
  });

  test("config:update forwards config param", async () => {
    const handler = handlers.get("config:update")!;
    const config: Partial<ServerConfig> = { watcherIntervalMs: 3000 };
    await handler({}, config);
    expect(mockClient.request).toHaveBeenCalledWith(Methods.ConfigUpdate, { config });
  });

  test("preset:list forwards with empty params", async () => {
    const handler = handlers.get("preset:list")!;
    await handler({});
    expect(mockClient.request).toHaveBeenCalledWith(Methods.PresetList, {});
  });

  test("preset:load forwards name param", async () => {
    const handler = handlers.get("preset:load")!;
    await handler({}, "framework-desktop");
    expect(mockClient.request).toHaveBeenCalledWith(Methods.PresetLoad, { name: "framework-desktop" });
  });

  test("connection:state returns client state", async () => {
    const handler = handlers.get("connection:state")!;
    const result = await handler({});
    expect(result).toBe("connected");
    expect(mockClient.getState).toHaveBeenCalled();
  });

  test("propagates errors from socket client", async () => {
    mockClient.request.mockImplementationOnce(async () => {
      throw new Error("PROFILE_NOT_FOUND: not found");
    });

    const handler = handlers.get("profile:get")!;
    await expect(handler({}, "ghost")).rejects.toThrow("PROFILE_NOT_FOUND");
  });
});

describe("setupConnectionForwarding", () => {
  test("subscribes to client state changes", () => {
    const mockClient = createMockClient();
    setupConnectionForwarding(mockClient as any, () => null);
    expect(mockClient.onStateChange).toHaveBeenCalled();
  });

  test("forwards state to window webContents", () => {
    let capturedCallback: ((state: string) => void) | null = null;
    const mockClient = createMockClient();
    mockClient.onStateChange.mockImplementation((cb: (state: string) => void) => {
      capturedCallback = cb;
      return () => {};
    });

    const sendMock = mock((_channel: string, _state: string) => {});
    const mockWindow = { webContents: { send: sendMock } };

    setupConnectionForwarding(mockClient as any, () => mockWindow as any);
    capturedCallback!("disconnected");

    expect(sendMock).toHaveBeenCalledWith("connection:state-changed", "disconnected");
  });

  test("handles null window gracefully", () => {
    let capturedCallback: ((state: string) => void) | null = null;
    const mockClient = createMockClient();
    mockClient.onStateChange.mockImplementation((cb: (state: string) => void) => {
      capturedCallback = cb;
      return () => {};
    });

    setupConnectionForwarding(mockClient as any, () => null);
    // Should not throw
    expect(() => capturedCallback!("disconnected")).not.toThrow();
  });

  test("returns unsubscribe function", () => {
    const unsubMock = mock(() => {});
    const mockClient = createMockClient();
    mockClient.onStateChange.mockImplementation(() => unsubMock);

    const unsub = setupConnectionForwarding(mockClient as any, () => null);
    expect(typeof unsub).toBe("function");

    unsub();
    expect(unsubMock).toHaveBeenCalled();
  });
});
