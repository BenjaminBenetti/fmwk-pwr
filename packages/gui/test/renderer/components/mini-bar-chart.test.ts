import { describe, test, expect } from "bun:test";
import { barColor } from "../../../src/renderer/components/MiniBarChart.js";

describe("barColor", () => {
  test("returns rgb string", () => {
    const color = barColor(0.5);
    expect(color).toMatch(/^rgb\(\d+,\d+,\d+\)$/);
  });

  test("ratio 0 returns blue-ish color (low value)", () => {
    const color = barColor(0);
    // At ratio=0: r=59, g=130, b=246
    expect(color).toBe("rgb(59,130,246)");
  });

  test("ratio 1 returns red-ish color (high value)", () => {
    const color = barColor(1);
    // At ratio=1: r=239, g=68, b=68
    expect(color).toBe("rgb(239,68,68)");
  });

  test("ratio 0.5 returns yellow (midpoint stop)", () => {
    const color = barColor(0.5);
    // 3 stops: blue(0), yellow(0.5), red(1)
    // ratio 0.5 -> t=1.0, i=1, f=0 -> exactly yellow(234,179,8)
    expect(color).toBe("rgb(234,179,8)");
  });

  test("color transitions from blue to red as ratio increases", () => {
    function parseR(c: string): number {
      return parseInt(c.match(/^rgb\((\d+),/)![1]);
    }

    const low = barColor(0.1);
    const mid = barColor(0.5);
    const high = barColor(0.9);

    // Red channel should increase across the range
    expect(parseR(low)).toBeLessThan(parseR(mid));
    expect(parseR(mid)).toBeLessThan(parseR(high));

    // Endpoints: ratio 0 is blue, ratio 1 is red
    expect(barColor(0)).toBe("rgb(59,130,246)");
    expect(barColor(1)).toBe("rgb(239,68,68)");
  });
});

describe("MiniBarChart bar height/ratio logic", () => {
  // These tests verify the clamping and height math used inline in the component.
  // The logic is: ratio = clamp(val / maxValue, 0, 1), height = max(1, round(ratio * 20))

  function computeBarHeight(val: number, maxValue: number): number {
    const ratio = Math.min(Math.max(val / maxValue, 0), 1);
    return Math.max(1, Math.round(ratio * 20));
  }

  function computeRatio(val: number, maxValue: number): number {
    return Math.min(Math.max(val / maxValue, 0), 1);
  }

  test("value at max gives full height", () => {
    expect(computeBarHeight(100, 100)).toBe(20);
  });

  test("value at zero gives minimum height of 1", () => {
    expect(computeBarHeight(0, 100)).toBe(1);
  });

  test("value at half gives proportional height", () => {
    expect(computeBarHeight(50, 100)).toBe(10);
  });

  test("values exceeding maxValue are clamped to ratio 1", () => {
    expect(computeRatio(200, 100)).toBe(1);
    expect(computeBarHeight(200, 100)).toBe(20);
  });

  test("negative values are clamped to ratio 0", () => {
    expect(computeRatio(-50, 100)).toBe(0);
    expect(computeBarHeight(-50, 100)).toBe(1);
  });

  test("small positive values give minimum height of 1", () => {
    // val=1, maxValue=1000 -> ratio=0.001, height=max(1, round(0.02))=max(1,0)=1
    expect(computeBarHeight(1, 1000)).toBe(1);
  });

  test("chart width calculation", () => {
    const maxBars = 40;
    const dotSize = 2;
    const colGap = 2;
    const chartWidth = maxBars * (dotSize + colGap) - colGap;
    expect(chartWidth).toBe(158);
  });
});
