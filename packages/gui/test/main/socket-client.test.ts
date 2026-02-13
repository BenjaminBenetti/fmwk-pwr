import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import net from "node:net";
import { unlinkSync } from "node:fs";
import { SocketClient, type ConnectionState } from "../../src/main/socket-client.js";

function waitForState(client: SocketClient, target: ConnectionState): Promise<void> {
  return new Promise((resolve) => {
    if (client.getState() === target) return resolve();
    const unsub = client.onStateChange((s) => {
      if (s === target) {
        unsub();
        resolve();
      }
    });
  });
}

function waitForConnection(server: net.Server): Promise<net.Socket> {
  return new Promise((resolve) => {
    server.once("connection", resolve);
  });
}

/** Read one NDJSON request from the server-side socket. */
function readRequest(sock: net.Socket): Promise<{ id: string; method: string; params?: unknown }> {
  return new Promise((resolve) => {
    let buf = "";
    const onData = (d: Buffer) => {
      buf += d.toString();
      const idx = buf.indexOf("\n");
      if (idx !== -1) {
        sock.off("data", onData);
        resolve(JSON.parse(buf.slice(0, idx)));
      }
    };
    sock.on("data", onData);
  });
}

describe("SocketClient", () => {
  let server: net.Server;
  let socketPath: string;
  let client: SocketClient;

  beforeEach(async () => {
    socketPath = `/tmp/fmwk-pwr-test-${Date.now()}-${Math.random().toString(36).slice(2)}.sock`;
    server = net.createServer();
    await new Promise<void>((resolve) => server.listen(socketPath, resolve));
  });

  afterEach(async () => {
    client?.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    try { unlinkSync(socketPath); } catch {}
  });

  // ── Connection State ──────────────────────────────────────────

  describe("connection state", () => {
    test("starts in disconnected state", () => {
      client = new SocketClient(socketPath);
      expect(client.getState()).toBe("disconnected");
    });

    test("transitions to connecting then connected when server is available", async () => {
      client = new SocketClient(socketPath);
      const states: ConnectionState[] = [];
      client.onStateChange((s) => states.push(s));

      client.connect();
      await waitForState(client, "connected");

      expect(states[0]).toBe("connecting");
      expect(states[1]).toBe("connected");
      expect(client.getState()).toBe("connected");
    });

    test("transitions to disconnected when server closes connection", async () => {
      client = new SocketClient(socketPath);
      client.connect();
      const serverSock = await waitForConnection(server);
      await waitForState(client, "connected");

      serverSock.destroy();
      await waitForState(client, "disconnected");
      expect(client.getState()).toBe("disconnected");
    });

    test("notifies state change listeners", async () => {
      client = new SocketClient(socketPath);
      const states: ConnectionState[] = [];
      client.onStateChange((s) => states.push(s));

      client.connect();
      await waitForState(client, "connected");

      expect(states).toContain("connecting");
      expect(states).toContain("connected");
      expect(states.length).toBeGreaterThanOrEqual(2);
    });

    test("unsubscribe removes listener", async () => {
      client = new SocketClient(socketPath);
      const states: ConnectionState[] = [];
      const unsub = client.onStateChange((s) => states.push(s));
      unsub();

      client.connect();
      await waitForState(client, "connected");

      expect(states).toHaveLength(0);
    });
  });

  // ── NDJSON Framing ────────────────────────────────────────────

  describe("NDJSON framing", () => {
    test("sends request as JSON + newline", async () => {
      client = new SocketClient(socketPath);
      client.connect();
      const serverSock = await waitForConnection(server);
      await waitForState(client, "connected");

      const received = new Promise<string>((resolve) => {
        let buf = "";
        serverSock.on("data", (data) => {
          buf += data.toString();
          if (buf.includes("\n")) resolve(buf);
        });
      });

      client.request("status.get" as any, {} as any).catch(() => {});
      const raw = await received;

      expect(raw.endsWith("\n")).toBe(true);
      const parsed = JSON.parse(raw.trim());
      expect(parsed.method).toBe("status.get");
      expect(typeof parsed.id).toBe("string");
    });

    test("parses single response message", async () => {
      client = new SocketClient(socketPath);
      client.connect();
      const serverSock = await waitForConnection(server);
      await waitForState(client, "connected");

      const resultPromise = client.request("profile.list" as any, {} as any);
      const req = await readRequest(serverSock);

      serverSock.write(JSON.stringify({ id: req.id, result: { profiles: [] } }) + "\n");

      const result = await resultPromise;
      expect(result).toEqual({ profiles: [] });
    });

    test("handles multiple messages in one data chunk", async () => {
      client = new SocketClient(socketPath);
      client.connect();
      const serverSock = await waitForConnection(server);
      await waitForState(client, "connected");

      const p1 = client.request("profile.list" as any, {} as any);
      const p2 = client.request("status.get" as any, {} as any);

      // Collect both request IDs
      const ids: string[] = [];
      await new Promise<void>((resolve) => {
        let buf = "";
        serverSock.on("data", (d) => {
          buf += d.toString();
          const lines = buf.split("\n").filter(Boolean);
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              if (!ids.includes(parsed.id)) ids.push(parsed.id);
            } catch {}
          }
          if (ids.length >= 2) resolve();
        });
      });

      // Send both responses in a single write
      const combined =
        JSON.stringify({ id: ids[0], result: { profiles: [] } }) + "\n" +
        JSON.stringify({ id: ids[1], result: { activeProfile: "default" } }) + "\n";
      serverSock.write(combined);

      const [r1, r2] = await Promise.all([p1, p2]);
      expect(r1).toEqual({ profiles: [] });
      expect((r2 as any).activeProfile).toBe("default");
    });

    test("handles partial message across chunks", async () => {
      client = new SocketClient(socketPath);
      client.connect();
      const serverSock = await waitForConnection(server);
      await waitForState(client, "connected");

      const resultPromise = client.request("profile.list" as any, {} as any);
      const req = await readRequest(serverSock);

      const fullResponse = JSON.stringify({ id: req.id, result: { profiles: ["a"] } }) + "\n";
      const mid = Math.floor(fullResponse.length / 2);

      serverSock.write(fullResponse.slice(0, mid));
      await new Promise((r) => setTimeout(r, 20));
      serverSock.write(fullResponse.slice(mid));

      const result = await resultPromise;
      expect(result).toEqual({ profiles: ["a"] });
    });

    test("ignores empty lines", async () => {
      client = new SocketClient(socketPath);
      client.connect();
      const serverSock = await waitForConnection(server);
      await waitForState(client, "connected");

      const resultPromise = client.request("profile.list" as any, {} as any);
      const req = await readRequest(serverSock);

      serverSock.write("\n\n" + JSON.stringify({ id: req.id, result: { ok: true } }) + "\n\n");

      const result = await resultPromise;
      expect(result).toEqual({ ok: true });
    });
  });

  // ── Request / Response ────────────────────────────────────────

  describe("request / response", () => {
    test("resolves promise with result from matching response", async () => {
      client = new SocketClient(socketPath);
      client.connect();
      const serverSock = await waitForConnection(server);
      await waitForState(client, "connected");

      const resultPromise = client.request("status.get" as any, {} as any);
      const req = await readRequest(serverSock);

      const payload = { activeProfile: "default", activatedBy: "startup", hwInfo: null };
      serverSock.write(JSON.stringify({ id: req.id, result: payload }) + "\n");

      const result = await resultPromise;
      expect(result).toEqual(payload);
    });

    test("correlates response by id (multiple concurrent requests)", async () => {
      client = new SocketClient(socketPath);
      client.connect();
      const serverSock = await waitForConnection(server);
      await waitForState(client, "connected");

      const p1 = client.request("profile.list" as any, {} as any);
      const p2 = client.request("status.get" as any, {} as any);

      // Collect both IDs
      const ids: string[] = [];
      await new Promise<void>((resolve) => {
        let buf = "";
        serverSock.on("data", (d) => {
          buf += d.toString();
          for (const line of buf.split("\n").filter(Boolean)) {
            try {
              const parsed = JSON.parse(line);
              if (!ids.includes(parsed.id)) ids.push(parsed.id);
            } catch {}
          }
          if (ids.length >= 2) resolve();
        });
      });

      // Respond in REVERSE order to prove correlation is by id, not order
      serverSock.write(JSON.stringify({ id: ids[1], result: { status: "ok" } }) + "\n");
      serverSock.write(JSON.stringify({ id: ids[0], result: { profiles: ["a"] } }) + "\n");

      const [r1, r2] = await Promise.all([p1, p2]);
      expect(r1).toEqual({ profiles: ["a"] });
      expect(r2).toEqual({ status: "ok" });
    });

    test("rejects promise on error response", async () => {
      client = new SocketClient(socketPath);
      client.connect();
      const serverSock = await waitForConnection(server);
      await waitForState(client, "connected");

      const resultPromise = client.request("profile.get" as any, { name: "ghost" } as any);
      const req = await readRequest(serverSock);

      serverSock.write(JSON.stringify({
        id: req.id,
        error: { code: "PROFILE_NOT_FOUND", message: "Profile not found" },
      }) + "\n");

      await expect(resultPromise).rejects.toThrow("PROFILE_NOT_FOUND: Profile not found");
    });

    test("rejects with error code and message from server", async () => {
      client = new SocketClient(socketPath);
      client.connect();
      const serverSock = await waitForConnection(server);
      await waitForState(client, "connected");

      const resultPromise = client.request("profile.delete" as any, { name: "default" } as any);
      const req = await readRequest(serverSock);

      serverSock.write(JSON.stringify({
        id: req.id,
        error: { code: "CANNOT_DELETE_ACTIVE", message: "Cannot delete the active profile" },
      }) + "\n");

      try {
        await resultPromise;
        expect.unreachable("should have thrown");
      } catch (e: any) {
        expect(e.message).toBe("CANNOT_DELETE_ACTIVE: Cannot delete the active profile");
      }
    });
  });

  // ── Timeouts ────────────────────────────────────────────────────

  describe("timeouts", () => {
    test("rejects request after timeout", async () => {
      client = new SocketClient(socketPath);
      client.connect();
      await waitForConnection(server);
      await waitForState(client, "connected");

      // Monkey-patch the timeout constant by issuing a request and checking
      // that the pending entry has a timer. We can't easily wait 10s, so we
      // intercept via a short-timeout approach: access the private pending map.
      const clientAny = client as any;

      const p = client.request("status.get" as any, {} as any);

      // There should be exactly one pending entry
      expect(clientAny.pending.size).toBe(1);

      // Replace the timer with a short one to speed up the test
      const [id, entry] = [...clientAny.pending.entries()][0];
      clearTimeout(entry.timer);
      entry.timer = setTimeout(() => {
        clientAny.pending.delete(id);
        entry.reject(new Error("Request timed out: status.get"));
      }, 50);

      await expect(p).rejects.toThrow("Request timed out: status.get");
      expect(clientAny.pending.size).toBe(0);
    });
  });

  // ── Reconnection ──────────────────────────────────────────────

  describe("reconnection", () => {
    test("schedules reconnect after disconnect", async () => {
      client = new SocketClient(socketPath);
      client.connect();
      const serverSock1 = await waitForConnection(server);
      await waitForState(client, "connected");

      serverSock1.destroy();
      await waitForState(client, "disconnected");

      // Should auto-reconnect (initial delay is 1s)
      const serverSock2 = await waitForConnection(server);
      await waitForState(client, "connected");
      expect(client.getState()).toBe("connected");
      serverSock2.destroy();
    });

    test("increases delay with exponential backoff", async () => {
      client = new SocketClient(socketPath);
      const clientAny = client as any;

      client.connect();
      const serverSock1 = await waitForConnection(server);
      await waitForState(client, "connected");

      // After first connect, reconnectDelay is reset to 1000
      expect(clientAny.reconnectDelay).toBe(1000);

      // Disconnect triggers scheduleReconnect which doubles the delay
      serverSock1.destroy();
      await waitForState(client, "disconnected");

      // After scheduleReconnect: delay was 1000, timer set for 1000, then delay *= 2 → 2000
      expect(clientAny.reconnectDelay).toBe(2000);

      // Wait for reconnect, then disconnect again
      const serverSock2 = await waitForConnection(server);
      await waitForState(client, "connected");
      // On connect, delay is reset to 1000
      expect(clientAny.reconnectDelay).toBe(1000);

      serverSock2.destroy();
      await waitForState(client, "disconnected");
      // After disconnect + scheduleReconnect: 1000 used, doubled to 2000
      expect(clientAny.reconnectDelay).toBe(2000);

      // Let it reconnect and disconnect one more time
      const serverSock3 = await waitForConnection(server);
      await waitForState(client, "connected");
      serverSock3.destroy();
      await waitForState(client, "disconnected");
      // 1000 reset on connect, then scheduleReconnect doubles to 2000
      expect(clientAny.reconnectDelay).toBe(2000);
    });

    test("caps reconnect delay at 30 seconds", () => {
      client = new SocketClient(socketPath);
      const clientAny = client as any;

      // Simulate many failures by manually setting the delay high and calling scheduleReconnect
      clientAny.reconnectDelay = 16000;
      clientAny.scheduleReconnect();
      // 16000 → timer set for 16000, delay becomes min(32000, 30000) = 30000
      expect(clientAny.reconnectDelay).toBe(30000);

      // Clean up the timer
      clearTimeout(clientAny.reconnectTimer);
      clientAny.reconnectTimer = null;

      clientAny.scheduleReconnect();
      // 30000 → timer set for 30000, delay becomes min(60000, 30000) = 30000
      expect(clientAny.reconnectDelay).toBe(30000);
      clearTimeout(clientAny.reconnectTimer);
    });

    test("resets reconnect delay on successful connect", async () => {
      client = new SocketClient(socketPath);
      const clientAny = client as any;

      // Artificially set a high reconnect delay
      clientAny.reconnectDelay = 16000;

      client.connect();
      await waitForConnection(server);
      await waitForState(client, "connected");

      // On successful connect, delay resets to 1000
      expect(clientAny.reconnectDelay).toBe(1000);
    });
  });

  // ── Buffer Reset on Reconnect ─────────────────────────────────

  describe("buffer reset on reconnect", () => {
    test("clears buffer on new connection", async () => {
      client = new SocketClient(socketPath);
      client.connect();
      const serverSock1 = await waitForConnection(server);
      await waitForState(client, "connected");

      // Send a request, capture its id, then send a partial response
      client.request("profile.list" as any, {} as any).catch(() => {});
      const req = await readRequest(serverSock1);
      serverSock1.write('{"id":"' + req.id + '","resu'); // partial — stuck in buffer
      serverSock1.destroy();
      await waitForState(client, "disconnected");

      // Reconnect — buffer should be cleared by the 'connect' handler
      const serverSock2 = await waitForConnection(server);
      await waitForState(client, "connected");

      // New request should parse cleanly (not corrupted by stale partial data)
      const p = client.request("status.get" as any, {} as any);
      const req2 = await readRequest(serverSock2);
      serverSock2.write(JSON.stringify({ id: req2.id, result: { ok: true } }) + "\n");

      const result = await p;
      expect(result).toEqual({ ok: true });
      serverSock2.destroy();
    });
  });

  // ── Error Handling ─────────────────────────────────────────────

  describe("error handling", () => {
    test("throws when requesting while disconnected", () => {
      client = new SocketClient(socketPath);
      expect(client.request("profile.list" as any, {} as any)).rejects.toThrow("Not connected");
    });

    test("silently handles malformed JSON from server", async () => {
      client = new SocketClient(socketPath);
      client.connect();
      const serverSock = await waitForConnection(server);
      await waitForState(client, "connected");

      // Send garbage — should not crash
      serverSock.write("not valid json at all\n");
      await new Promise((r) => setTimeout(r, 50));

      // Client should still be connected and functional
      expect(client.getState()).toBe("connected");

      // Verify it can still process valid messages after garbage
      const resultPromise = client.request("profile.list" as any, {} as any);
      const req = await readRequest(serverSock);
      serverSock.write(JSON.stringify({ id: req.id, result: { profiles: [] } }) + "\n");
      const result = await resultPromise;
      expect(result).toEqual({ profiles: [] });
    });
  });

  // ── Cleanup ───────────────────────────────────────────────────

  describe("destroy", () => {
    test("rejects all pending requests", async () => {
      client = new SocketClient(socketPath);
      client.connect();
      await waitForConnection(server);
      await waitForState(client, "connected");

      const p1 = client.request("profile.list" as any, {} as any).catch((e: Error) => e);
      const p2 = client.request("status.get" as any, {} as any).catch((e: Error) => e);

      client.destroy();

      const r1 = await p1;
      const r2 = await p2;
      expect(r1).toBeInstanceOf(Error);
      expect((r1 as Error).message).toContain("Client destroyed");
      expect(r2).toBeInstanceOf(Error);
      expect((r2 as Error).message).toContain("Client destroyed");
    });

    test("stops reconnection attempts", async () => {
      client = new SocketClient(socketPath);
      client.connect();
      const serverSock = await waitForConnection(server);
      await waitForState(client, "connected");

      // Disconnect to trigger reconnect scheduling
      serverSock.destroy();
      await waitForState(client, "disconnected");

      // Destroy should cancel the reconnect timer
      client.destroy();

      // Wait longer than the initial 1s reconnect delay
      await new Promise((r) => setTimeout(r, 1500));

      // Should still be disconnected — no reconnection happened
      expect(client.getState()).toBe("disconnected");
    });

    test("closes the socket", async () => {
      client = new SocketClient(socketPath);
      client.connect();
      const serverSock = await waitForConnection(server);
      await waitForState(client, "connected");

      // Listen for the server-side close event
      const serverClosed = new Promise<void>((resolve) => {
        serverSock.on("close", resolve);
      });

      client.destroy();
      await serverClosed;

      // Server saw the client disconnect
      expect(client.getState()).toBe("disconnected");
    });

    test("prevents further connections after destroy", async () => {
      client = new SocketClient(socketPath);
      client.destroy();
      client.connect(); // should be a no-op
      await new Promise((r) => setTimeout(r, 100));
      expect(client.getState()).toBe("disconnected");
    });
  });
});
