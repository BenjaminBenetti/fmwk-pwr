import { describe, expect, test, beforeEach } from "bun:test";

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

// =====================================
// GPU busy percent parsing
// =====================================

// HwmonReader.readGpuUsage reads gpu_busy_percent from sysfs and parses it.
// We replicate the parsing logic here since HwmonReader requires real hardware.

/**
 * Replicate the gpu_busy_percent parsing logic from HwmonReader.readGpuUsage.
 * This must match the production implementation in hwmon.ts.
 *
 * @param raw - Raw content of gpu_busy_percent file, or null to simulate missing gpuCardPath/file
 * @returns GPU busy percentage (0-100), or null if unavailable
 */
function parseGpuBusyPercent(raw: string | null): number | null {
  if (raw === null) return null;
  const percent = parseInt(raw.trim(), 10);
  if (isNaN(percent)) return null;
  return percent;
}

describe("GPU busy percent parsing", () => {
  describe("valid values", () => {
    test("parses typical GPU usage percentage", () => {
      expect(parseGpuBusyPercent("42\n")).toBe(42);
    });

    test("parses 0% usage", () => {
      expect(parseGpuBusyPercent("0\n")).toBe(0);
    });

    test("parses 100% usage", () => {
      expect(parseGpuBusyPercent("100\n")).toBe(100);
    });

    test("handles value without trailing newline", () => {
      expect(parseGpuBusyPercent("75")).toBe(75);
    });

    test("handles value with extra whitespace", () => {
      expect(parseGpuBusyPercent("  55  \n")).toBe(55);
    });
  });

  describe("invalid values", () => {
    test("returns null for non-numeric content", () => {
      expect(parseGpuBusyPercent("not_a_number\n")).toBeNull();
    });

    test("returns null for empty string", () => {
      expect(parseGpuBusyPercent("")).toBeNull();
    });

    test("returns null for whitespace-only string", () => {
      expect(parseGpuBusyPercent("   \n")).toBeNull();
    });
  });

  describe("missing GPU", () => {
    test("returns null when gpuCardPath is missing (null input)", () => {
      expect(parseGpuBusyPercent(null)).toBeNull();
    });
  });
});

// =====================================
// CPU usage parsing (/proc/stat delta)
// =====================================

// HwmonReader.readCpuUsage uses parseProcStat + delta calculation.
// We replicate both the parsing and stateful delta logic here.

/** Parsed CPU time counters from /proc/stat. */
interface CpuTimes {
  idle: number;
  total: number;
}

/**
 * Replicate parseProcStat from hwmon.ts.
 * This must match the production implementation.
 *
 * /proc/stat "cpu" line fields: user nice system idle iowait irq softirq steal guest guest_nice
 * iowait is counted as idle time.
 */
function parseProcStat(raw: string): CpuTimes | null {
  const line = raw.split("\n").find((l) => l.startsWith("cpu "));
  if (!line) return null;
  const fields = line.trim().split(/\s+/).slice(1).map(Number);
  if (fields.length < 5 || fields.some(isNaN)) return null;

  const idle = fields[3] + (fields[4] ?? 0); // idle + iowait
  const total = fields.reduce((a, b) => a + b, 0);
  return { idle, total };
}

/**
 * Replicate the stateful CPU usage calculation from HwmonReader.readCpuUsage.
 * Takes two consecutive parseProcStat results and computes the delta percentage.
 *
 * @param prev - Previous CPU time counters (null on first call)
 * @param current - Current CPU time counters (null if parseProcStat failed)
 * @returns CPU usage percentage (0-100), or null if unavailable
 */
function computeCpuUsage(
  prev: CpuTimes | null,
  current: CpuTimes | null,
): number | null {
  if (!current) return null;
  if (!prev) return null;

  const totalDelta = current.total - prev.total;
  const idleDelta = current.idle - prev.idle;
  if (totalDelta <= 0) return null;

  return Math.round(((totalDelta - idleDelta) / totalDelta) * 100);
}

describe("parseProcStat", () => {
  describe("valid /proc/stat content", () => {
    test("parses typical /proc/stat cpu line", () => {
      const raw =
        "cpu  10132153 290696 3084719 46828483 16683 0 25195 0 0 0\n" +
        "cpu0 1393280 32966 572056 13343292 6130 0 17875 0 0 0\n";
      const result = parseProcStat(raw);
      expect(result).not.toBeNull();
      // idle = 46828483 + 16683 = 46845166
      expect(result!.idle).toBe(46828483 + 16683);
      // total = sum of all fields
      expect(result!.total).toBe(10132153 + 290696 + 3084719 + 46828483 + 16683 + 0 + 25195 + 0 + 0 + 0);
    });

    test("counts iowait as idle time", () => {
      // user=100 nice=0 system=50 idle=800 iowait=50 irq=0 softirq=0 steal=0
      const raw = "cpu  100 0 50 800 50 0 0 0 0 0\n";
      const result = parseProcStat(raw);
      expect(result).not.toBeNull();
      // idle = idle(800) + iowait(50) = 850
      expect(result!.idle).toBe(850);
      expect(result!.total).toBe(1000);
    });

    test("parses minimum 5 fields", () => {
      // Only user nice system idle iowait (5 fields after "cpu")
      const raw = "cpu  100 0 50 800 50\n";
      const result = parseProcStat(raw);
      expect(result).not.toBeNull();
      expect(result!.idle).toBe(850);
      expect(result!.total).toBe(1000);
    });

    test("handles large counter values", () => {
      // Typical values after long uptime
      const raw = "cpu  1234567890 12345678 123456789 9876543210 98765432 0 1234567 0 0 0\n";
      const result = parseProcStat(raw);
      expect(result).not.toBeNull();
      expect(result!.idle).toBe(9876543210 + 98765432);
      expect(result!.total).toBe(
        1234567890 + 12345678 + 123456789 + 9876543210 + 98765432 + 0 + 1234567 + 0 + 0 + 0,
      );
    });
  });

  describe("malformed /proc/stat", () => {
    test("returns null when no cpu line exists", () => {
      expect(parseProcStat("some random text\n")).toBeNull();
    });

    test("returns null for empty string", () => {
      expect(parseProcStat("")).toBeNull();
    });

    test("returns null when cpu line has non-numeric fields", () => {
      const raw = "cpu  abc def ghi jkl mno\n";
      expect(parseProcStat(raw)).toBeNull();
    });

    test("returns null when cpu line has fewer than 5 fields", () => {
      const raw = "cpu  100 0 50 800\n"; // only 4 fields
      expect(parseProcStat(raw)).toBeNull();
    });

    test("does not match 'cpu0' line as aggregate", () => {
      // Only "cpu " (with space) is the aggregate line
      const raw = "cpu0 100 0 50 800 50 0 0 0 0 0\n";
      expect(parseProcStat(raw)).toBeNull();
    });
  });
});

describe("CPU usage delta calculation", () => {
  describe("first call (no baseline)", () => {
    test("returns null on first call (no previous sample)", () => {
      const current = parseProcStat("cpu  100 0 50 800 50 0 0 0 0 0\n");
      expect(computeCpuUsage(null, current)).toBeNull();
    });
  });

  describe("normal operation", () => {
    test("calculates usage from two consecutive samples", () => {
      const prev: CpuTimes = { idle: 850, total: 1000 };
      const current: CpuTimes = { idle: 900, total: 1100 };
      // totalDelta = 100, idleDelta = 50, usage = (100-50)/100 = 50%
      expect(computeCpuUsage(prev, current)).toBe(50);
    });

    test("returns 0% when all delta is idle", () => {
      const prev: CpuTimes = { idle: 800, total: 1000 };
      const current: CpuTimes = { idle: 900, total: 1100 };
      // totalDelta = 100, idleDelta = 100, usage = 0/100 = 0%
      expect(computeCpuUsage(prev, current)).toBe(0);
    });

    test("returns 100% when no idle time in delta", () => {
      const prev: CpuTimes = { idle: 800, total: 1000 };
      const current: CpuTimes = { idle: 800, total: 1100 };
      // totalDelta = 100, idleDelta = 0, usage = 100/100 = 100%
      expect(computeCpuUsage(prev, current)).toBe(100);
    });

    test("rounds to nearest integer", () => {
      const prev: CpuTimes = { idle: 0, total: 0 };
      const current: CpuTimes = { idle: 670, total: 1000 };
      // totalDelta = 1000, idleDelta = 670, usage = 330/1000 = 33%
      expect(computeCpuUsage(prev, current)).toBe(33);
    });

    test("typical workload scenario", () => {
      // Simulate ~25% busy
      const prev: CpuTimes = { idle: 7500, total: 10000 };
      const current: CpuTimes = { idle: 8250, total: 11000 };
      // totalDelta = 1000, idleDelta = 750, usage = 250/1000 = 25%
      expect(computeCpuUsage(prev, current)).toBe(25);
    });
  });

  describe("edge cases", () => {
    test("returns null when totalDelta is zero (no time passed)", () => {
      const prev: CpuTimes = { idle: 800, total: 1000 };
      const current: CpuTimes = { idle: 800, total: 1000 };
      expect(computeCpuUsage(prev, current)).toBeNull();
    });

    test("returns null when totalDelta is negative (counter overflow/reset)", () => {
      const prev: CpuTimes = { idle: 800, total: 1000 };
      const current: CpuTimes = { idle: 500, total: 900 };
      expect(computeCpuUsage(prev, current)).toBeNull();
    });

    test("returns null when current parse failed", () => {
      const prev: CpuTimes = { idle: 800, total: 1000 };
      expect(computeCpuUsage(prev, null)).toBeNull();
    });
  });
});

describe("CPU usage stateful sequence", () => {
  // Simulates the stateful behavior of HwmonReader.readCpuUsage
  // which stores prevCpuTimes across calls.

  let prevCpuTimes: CpuTimes | null;

  function simulateReadCpuUsage(raw: string | null): number | null {
    if (raw === null) return null;
    const current = parseProcStat(raw);
    if (!current) return null;

    const prev = prevCpuTimes;
    prevCpuTimes = current;
    if (!prev) return null;

    const totalDelta = current.total - prev.total;
    const idleDelta = current.idle - prev.idle;
    if (totalDelta <= 0) return null;

    return Math.round(((totalDelta - idleDelta) / totalDelta) * 100);
  }

  beforeEach(() => {
    prevCpuTimes = null;
  });

  test("first call returns null and stores baseline", () => {
    const result = simulateReadCpuUsage("cpu  100 0 50 800 50 0 0 0 0 0\n");
    expect(result).toBeNull();
  });

  test("second call returns calculated usage", () => {
    simulateReadCpuUsage("cpu  100 0 50 800 50 0 0 0 0 0\n");
    const result = simulateReadCpuUsage("cpu  200 0 100 850 50 0 0 0 0 0\n");
    // prev total=1000, prev idle=850
    // curr total=1200, curr idle=900
    // totalDelta=200, idleDelta=50, usage = 150/200 = 75%
    expect(result).toBe(75);
  });

  test("third call uses second as baseline", () => {
    simulateReadCpuUsage("cpu  100 0 50 800 50 0 0 0 0 0\n");
    simulateReadCpuUsage("cpu  200 0 100 850 50 0 0 0 0 0\n");
    const result = simulateReadCpuUsage("cpu  250 0 125 950 50 0 0 0 0 0\n");
    // prev total=1200, prev idle=900
    // curr total=1375, curr idle=1000
    // totalDelta=175, idleDelta=100, usage = 75/175 = 43%
    expect(result).toBe(43);
  });

  test("malformed input preserves previous baseline", () => {
    simulateReadCpuUsage("cpu  100 0 50 800 50 0 0 0 0 0\n");
    const badResult = simulateReadCpuUsage("garbage data\n");
    expect(badResult).toBeNull();
    // Previous baseline should still be the first call
    const result = simulateReadCpuUsage("cpu  200 0 100 850 50 0 0 0 0 0\n");
    expect(result).toBe(75);
  });
});
