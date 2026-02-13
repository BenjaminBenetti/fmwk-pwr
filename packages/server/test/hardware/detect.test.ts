import { describe, expect, test } from "bun:test";

// We can't call detectHardware() directly in tests since it reads /proc/cpuinfo
// and instantiates StrixHaloStrategy (which needs libryzenadj.so + real hardware).
// Instead, we test the CPU model matching logic independently.

function matchCpuModel(modelName: string): string | null {
  const upper = modelName.toUpperCase();
  if (upper.includes("RYZEN AI MAX") || upper.includes("RYZEN AI 300")) {
    return "StrixHalo";
  }
  return null;
}

function extractModelName(cpuinfo: string): string | null {
  const modelLine = cpuinfo
    .split("\n")
    .find((line) => line.startsWith("model name"));

  if (!modelLine) return null;
  return modelLine.split(":")[1]?.trim() ?? "";
}

describe("hardware detection - CPU model matching", () => {
  test("matches Ryzen AI Max (Strix Halo)", () => {
    expect(matchCpuModel("AMD Ryzen AI Max+ 395")).toBe("StrixHalo");
    expect(matchCpuModel("AMD Ryzen AI Max 390")).toBe("StrixHalo");
  });

  test("matches uppercase model names from real hardware", () => {
    expect(matchCpuModel("AMD RYZEN AI MAX+ 395 w/ Radeon 8060S")).toBe("StrixHalo");
    expect(matchCpuModel("AMD RYZEN AI 300 Series")).toBe("StrixHalo");
  });

  test("matches Ryzen AI 300 series", () => {
    expect(matchCpuModel("AMD Ryzen AI 300 Series")).toBe("StrixHalo");
  });

  test("rejects unknown CPUs", () => {
    expect(matchCpuModel("AMD Ryzen 9 7950X")).toBeNull();
    expect(matchCpuModel("Intel Core i9-14900K")).toBeNull();
    expect(matchCpuModel("AMD Ryzen 7 7840HS")).toBeNull();
  });

  test("rejects empty model name", () => {
    expect(matchCpuModel("")).toBeNull();
  });
});

describe("hardware detection - /proc/cpuinfo parsing", () => {
  test("extracts model name from cpuinfo", () => {
    const cpuinfo = [
      "processor\t: 0",
      "vendor_id\t: AuthenticAMD",
      "model name\t: AMD Ryzen AI Max+ 395",
      "cpu MHz\t\t: 4200.000",
    ].join("\n");

    expect(extractModelName(cpuinfo)).toBe("AMD Ryzen AI Max+ 395");
  });

  test("handles multi-core cpuinfo (takes first match)", () => {
    const cpuinfo = [
      "processor\t: 0",
      "model name\t: AMD Ryzen AI Max+ 395",
      "",
      "processor\t: 1",
      "model name\t: AMD Ryzen AI Max+ 395",
    ].join("\n");

    expect(extractModelName(cpuinfo)).toBe("AMD Ryzen AI Max+ 395");
  });

  test("returns null when no model name found", () => {
    const cpuinfo = [
      "processor\t: 0",
      "vendor_id\t: AuthenticAMD",
      "cpu MHz\t\t: 4200.000",
    ].join("\n");

    expect(extractModelName(cpuinfo)).toBeNull();
  });

  test("handles empty cpuinfo", () => {
    expect(extractModelName("")).toBeNull();
  });

  test("end-to-end: parse cpuinfo then match", () => {
    const cpuinfo = [
      "processor\t: 0",
      "model name\t: AMD Ryzen AI Max+ 395",
    ].join("\n");

    const model = extractModelName(cpuinfo);
    expect(model).not.toBeNull();
    expect(matchCpuModel(model!)).toBe("StrixHalo");
  });

  test("end-to-end: unsupported CPU returns null match", () => {
    const cpuinfo = [
      "processor\t: 0",
      "model name\t: Intel Core i7-13700K",
    ].join("\n");

    const model = extractModelName(cpuinfo);
    expect(model).not.toBeNull();
    expect(matchCpuModel(model!)).toBeNull();
  });
});
