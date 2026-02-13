import type { HardwareLimits } from "@fmwk-pwr/shared";
import type { HardwareStrategy } from "./strategy.js";
import { StrixHaloStrategy } from "./strategies/strix-halo/index.js";

// =====================================
// Detection
// =====================================

/**
 * Detect the current CPU/APU and return the appropriate hardware strategy.
 *
 * Reads /proc/cpuinfo to identify the processor model, then instantiates
 * the matching {@link HardwareStrategy} implementation. Throws if the
 * CPU is not recognized or supported.
 *
 * @param hardwareLimits - Hardware-specific bounds for profile validation
 * @returns The hardware strategy for the detected platform
 * @throws If the CPU model cannot be determined or is unsupported
 */
export async function detectHardware(hardwareLimits: HardwareLimits): Promise<HardwareStrategy> {
  const cpuinfo = await Bun.file("/proc/cpuinfo").text();

  const modelLine = cpuinfo
    .split("\n")
    .find((line) => line.startsWith("model name"));

  if (!modelLine) {
    throw new Error("Could not determine CPU model from /proc/cpuinfo");
  }

  const modelName = modelLine.split(":")[1]?.trim() ?? "";
  const modelUpper = modelName.toUpperCase();

  if (modelUpper.includes("RYZEN AI MAX") || modelUpper.includes("RYZEN AI 300")) {
    return new StrixHaloStrategy(hardwareLimits);
  }

  throw new Error(`Unsupported CPU: ${modelName}`);
}
