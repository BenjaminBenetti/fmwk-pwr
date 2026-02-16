import { describe, test, expect } from "bun:test";
import { pushHistory, emptyHistories, formatPower } from "../../../src/renderer/components/SensorReadout.js";

const MAX_BARS = 40;

describe("emptyHistories", () => {
  test("returns object with all sensor keys as empty arrays", () => {
    const h = emptyHistories();
    const keys = Object.keys(h);
    expect(keys).toContain("socketPower");
    expect(keys).toContain("cpuPower");
    expect(keys).toContain("gpuPower");
    expect(keys).toContain("apu_temp");
    expect(keys).toContain("cpu_clock");
    expect(keys).toContain("cpu_usage");
    expect(keys).toContain("gpu_clock");
    expect(keys).toContain("gpu_usage");
    expect(keys).toHaveLength(8);
  });

  test("all arrays start empty", () => {
    const h = emptyHistories();
    for (const key of Object.keys(h)) {
      expect(h[key as keyof typeof h]).toEqual([]);
    }
  });

  test("returns a new object each call (no shared state)", () => {
    const h1 = emptyHistories();
    const h2 = emptyHistories();
    h1.socketPower.push(100);
    expect(h2.socketPower).toEqual([]);
  });
});

describe("pushHistory", () => {
  test("pushes value to the correct key", () => {
    const h = emptyHistories();
    pushHistory(h, "socketPower", 65000);
    expect(h.socketPower).toEqual([65000]);
  });

  test("appends multiple values in order", () => {
    const h = emptyHistories();
    pushHistory(h, "apu_temp", 55);
    pushHistory(h, "apu_temp", 60);
    pushHistory(h, "apu_temp", 65);
    expect(h.apu_temp).toEqual([55, 60, 65]);
  });

  test("does not push null values", () => {
    const h = emptyHistories();
    pushHistory(h, "cpuPower", null);
    expect(h.cpuPower).toEqual([]);
  });

  test("caps history at MAX_BARS (40) entries", () => {
    const h = emptyHistories();
    for (let i = 0; i < 50; i++) {
      pushHistory(h, "gpu_clock", i * 100);
    }
    expect(h.gpu_clock).toHaveLength(MAX_BARS);
  });

  test("drops oldest value when history is full", () => {
    const h = emptyHistories();
    for (let i = 0; i < MAX_BARS; i++) {
      pushHistory(h, "socketPower", i);
    }
    expect(h.socketPower[0]).toBe(0);
    expect(h.socketPower).toHaveLength(MAX_BARS);

    // Push one more — oldest (0) should be dropped
    pushHistory(h, "socketPower", 999);
    expect(h.socketPower).toHaveLength(MAX_BARS);
    expect(h.socketPower[0]).toBe(1);
    expect(h.socketPower[MAX_BARS - 1]).toBe(999);
  });

  test("different keys are independent", () => {
    const h = emptyHistories();
    pushHistory(h, "cpuPower", 10000);
    pushHistory(h, "gpuPower", 20000);
    expect(h.cpuPower).toEqual([10000]);
    expect(h.gpuPower).toEqual([20000]);
    expect(h.socketPower).toEqual([]);
  });

  test("handles zero values (not treated as null)", () => {
    const h = emptyHistories();
    pushHistory(h, "cpu_usage", 0);
    expect(h.cpu_usage).toEqual([0]);
  });
});

describe("formatPower", () => {
  test("converts milliwatts to watts with one decimal", () => {
    expect(formatPower(65000)).toBe("65.0");
  });

  test("rounds to one decimal place", () => {
    expect(formatPower(65432)).toBe("65.4");
  });

  test("returns em dash for null", () => {
    expect(formatPower(null)).toBe("\u2014");
  });

  test("handles zero", () => {
    expect(formatPower(0)).toBe("0.0");
  });

  test("handles small values", () => {
    expect(formatPower(500)).toBe("0.5");
  });

  test("handles large values", () => {
    expect(formatPower(180000)).toBe("180.0");
  });
});
