import { describe, expect, test } from "bun:test";
import { scanProcesses } from "../../src/watcher/process-scanner.js";

describe("process scanner", () => {
  test("returns an array", async () => {
    const processes = await scanProcesses();
    expect(Array.isArray(processes)).toBe(true);
  });

  test("array contains non-empty strings", async () => {
    const processes = await scanProcesses();
    for (const cmd of processes) {
      expect(typeof cmd).toBe("string");
      expect(cmd.length).toBeGreaterThan(0);
    }
  });

  test("finds at least some processes", async () => {
    const processes = await scanProcesses();
    expect(processes.length).toBeGreaterThan(0);
  });
});
