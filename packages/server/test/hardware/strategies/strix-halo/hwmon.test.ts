import { describe, expect, test } from "bun:test";

// HwmonReader can't be instantiated in tests (requires real sysfs paths),
// so we replicate the gpu_metrics binary parsing logic from readGpuMetricsPower.

/**
 * Replicate the gpu_metrics v3.0 parsing logic from HwmonReader.readGpuMetricsPower.
 * This must match the production implementation in hwmon.ts.
 *
 * CPU power = average_apu_power - average_gfx_power (same approach as MangoHud).
 * average_all_core_power (offset 132) only covers CPU cores and misses SoC/uncore
 * power, so we don't use it.
 *
 * @param buf - Raw binary content of the gpu_metrics file (or null to simulate missing gpuCardPath)
 * @returns Object with gpuPower and cpuPower in mW, or nulls if unavailable
 */
function parseGpuMetricsPower(
  buf: ArrayBuffer | null,
): { gpuPower: number | null; cpuPower: number | null } {
  if (buf === null) return { gpuPower: null, cpuPower: null };

  const bytes = new DataView(buf);

  // Minimum size: need at least through average_gfx_power at offset 124 + 4 = 128 bytes
  if (buf.byteLength < 128) return { gpuPower: null, cpuPower: null };

  // Header check: byte 2 = format_revision must be 3 (v3.x series).
  const formatRevision = bytes.getUint8(2);
  if (formatRevision !== 3) {
    return { gpuPower: null, cpuPower: null };
  }

  // gpu_metrics_v3_0 with natural C alignment (not packed):
  // average_apu_power: uint32_t at byte offset 120 (total APU power, in mW)
  // average_gfx_power: uint32_t at byte offset 124 (GPU power, in mW)
  const apuPower = bytes.getUint32(120, true);
  const gfxPower = bytes.getUint32(124, true);

  const gpuPower = gfxPower === 0xffffffff ? null : gfxPower;
  const cpuPower =
    apuPower === 0xffffffff || gfxPower === 0xffffffff
      ? null
      : Math.max(0, apuPower - gfxPower);

  return { gpuPower, cpuPower };
}

/**
 * Build a synthetic gpu_metrics v3.0 binary buffer.
 * Sets the header fields and power values at the correct offsets.
 */
function buildGpuMetricsBuffer(opts: {
  formatRevision?: number;
  contentRevision?: number;
  apuPower?: number;
  gfxPower?: number;
  size?: number;
}): ArrayBuffer {
  const size = opts.size ?? 256;
  const buf = new ArrayBuffer(size);
  const view = new DataView(buf);

  // Header: bytes 0-1 are structure_size (not checked), byte 2 = format_revision, byte 3 = content_revision
  view.setUint8(2, opts.formatRevision ?? 3);
  view.setUint8(3, opts.contentRevision ?? 0);

  // APU power at offset 120 (uint32_t, little-endian)
  if (opts.apuPower !== undefined && size >= 124) {
    view.setUint32(120, opts.apuPower, true);
  }
  // GFX (GPU) power at offset 124 (uint32_t, little-endian)
  if (opts.gfxPower !== undefined && size >= 128) {
    view.setUint32(124, opts.gfxPower, true);
  }

  return buf;
}

describe("gpu_metrics power parsing", () => {
  describe("successful parsing", () => {
    test("extracts GPU and CPU power from valid v3.0 buffer", () => {
      const buf = buildGpuMetricsBuffer({
        apuPower: 90_000,
        gfxPower: 10_000,
      });

      const result = parseGpuMetricsPower(buf);
      expect(result.gpuPower).toBe(10_000);
      expect(result.cpuPower).toBe(80_000); // 90000 - 10000
    });

    test("CPU + GPU power equals APU power", () => {
      const buf = buildGpuMetricsBuffer({
        apuPower: 120_000,
        gfxPower: 30_000,
      });

      const result = parseGpuMetricsPower(buf);
      expect(result.gpuPower! + result.cpuPower!).toBe(120_000);
    });

    test("handles zero GPU power (all power to CPU)", () => {
      const buf = buildGpuMetricsBuffer({
        apuPower: 45_000,
        gfxPower: 0,
      });

      const result = parseGpuMetricsPower(buf);
      expect(result.gpuPower).toBe(0);
      expect(result.cpuPower).toBe(45_000);
    });

    test("handles equal APU and GFX power (zero CPU)", () => {
      const buf = buildGpuMetricsBuffer({
        apuPower: 15_000,
        gfxPower: 15_000,
      });

      const result = parseGpuMetricsPower(buf);
      expect(result.gpuPower).toBe(15_000);
      expect(result.cpuPower).toBe(0);
    });

    test("clamps CPU power to zero when gfx exceeds apu (transient)", () => {
      // Can happen briefly due to sampling timing
      const buf = buildGpuMetricsBuffer({
        apuPower: 10_000,
        gfxPower: 12_000,
      });

      const result = parseGpuMetricsPower(buf);
      expect(result.gpuPower).toBe(12_000);
      expect(result.cpuPower).toBe(0);
    });

    test("reads GFX power as little-endian uint32", () => {
      const buf = new ArrayBuffer(256);
      const view = new DataView(buf);
      view.setUint8(2, 3); // format_revision

      // Write 0x01020304 in little-endian at offset 124
      view.setUint8(124, 0x04);
      view.setUint8(125, 0x03);
      view.setUint8(126, 0x02);
      view.setUint8(127, 0x01);

      const result = parseGpuMetricsPower(buf);
      expect(result.gpuPower).toBe(0x01020304);
    });
  });

  describe("null gpuCardPath (no GPU found)", () => {
    test("returns null for both values when buffer is null", () => {
      const result = parseGpuMetricsPower(null);
      expect(result.gpuPower).toBeNull();
      expect(result.cpuPower).toBeNull();
    });
  });

  describe("header validation", () => {
    test("returns null when format_revision is not 3", () => {
      const buf = buildGpuMetricsBuffer({
        formatRevision: 2,
        apuPower: 90_000,
        gfxPower: 10_000,
      });

      const result = parseGpuMetricsPower(buf);
      expect(result.gpuPower).toBeNull();
      expect(result.cpuPower).toBeNull();
    });

    test("accepts any content_revision within format 3", () => {
      const buf = buildGpuMetricsBuffer({
        contentRevision: 1,
        apuPower: 90_000,
        gfxPower: 10_000,
      });

      const result = parseGpuMetricsPower(buf);
      expect(result.gpuPower).toBe(10_000);
      expect(result.cpuPower).toBe(80_000);
    });

    test("returns null when format_revision is wrong regardless of content_revision", () => {
      const buf = buildGpuMetricsBuffer({
        formatRevision: 1,
        contentRevision: 2,
        apuPower: 90_000,
        gfxPower: 10_000,
      });

      const result = parseGpuMetricsPower(buf);
      expect(result.gpuPower).toBeNull();
      expect(result.cpuPower).toBeNull();
    });
  });

  describe("sentinel values", () => {
    test("treats 0xFFFF as valid power (65535 mW is a legitimate reading)", () => {
      const buf = buildGpuMetricsBuffer({
        apuPower: 90_000,
        gfxPower: 0xffff,
      });

      const result = parseGpuMetricsPower(buf);
      expect(result.gpuPower).toBe(0xffff);
      expect(result.cpuPower).toBe(90_000 - 0xffff);
    });

    test("returns null GPU for 0xFFFFFFFF gfx sentinel", () => {
      const buf = buildGpuMetricsBuffer({
        apuPower: 90_000,
        gfxPower: 0xffffffff,
      });

      const result = parseGpuMetricsPower(buf);
      expect(result.gpuPower).toBeNull();
      expect(result.cpuPower).toBeNull(); // can't compute CPU without GPU
    });

    test("returns null CPU when apu is 0xFFFFFFFF sentinel", () => {
      const buf = buildGpuMetricsBuffer({
        apuPower: 0xffffffff,
        gfxPower: 10_000,
      });

      const result = parseGpuMetricsPower(buf);
      expect(result.gpuPower).toBe(10_000);
      expect(result.cpuPower).toBeNull();
    });

    test("returns null for both when both are 0xFFFFFFFF sentinel", () => {
      const buf = buildGpuMetricsBuffer({
        apuPower: 0xffffffff,
        gfxPower: 0xffffffff,
      });

      const result = parseGpuMetricsPower(buf);
      expect(result.gpuPower).toBeNull();
      expect(result.cpuPower).toBeNull();
    });
  });

  describe("buffer size validation", () => {
    test("returns null when buffer is too small (< 128 bytes)", () => {
      const buf = buildGpuMetricsBuffer({
        size: 127,
        apuPower: 90_000,
        gfxPower: 10_000,
      });

      const result = parseGpuMetricsPower(buf);
      expect(result.gpuPower).toBeNull();
      expect(result.cpuPower).toBeNull();
    });

    test("returns null when buffer is empty", () => {
      const buf = new ArrayBuffer(0);
      const result = parseGpuMetricsPower(buf);
      expect(result.gpuPower).toBeNull();
      expect(result.cpuPower).toBeNull();
    });

    test("works with exactly 128 bytes (minimum valid size)", () => {
      const buf = buildGpuMetricsBuffer({
        size: 128,
        apuPower: 90_000,
        gfxPower: 10_000,
      });

      const result = parseGpuMetricsPower(buf);
      expect(result.gpuPower).toBe(10_000);
      expect(result.cpuPower).toBe(80_000);
    });

    test("works with larger buffer sizes", () => {
      const buf = buildGpuMetricsBuffer({
        size: 1024,
        apuPower: 90_000,
        gfxPower: 10_000,
      });

      const result = parseGpuMetricsPower(buf);
      expect(result.gpuPower).toBe(10_000);
      expect(result.cpuPower).toBe(80_000);
    });
  });
});
