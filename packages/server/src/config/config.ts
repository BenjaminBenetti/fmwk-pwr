import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import type { HardwareLimits, ServerConfig, UserConfig } from "@fmwk-pwr/shared";

// =====================================
// Configuration Defaults
// =====================================

const SYSTEM_CONFIG_PATH = "/etc/fmwk-pwr/config.json";

const DEFAULT_USER: UserConfig = {
  theme: "default",
};

const DEFAULT_CONFIG: ServerConfig = {
  gpuSysfsPath: "/sys/class/drm/card1/device",
  socketPath: "/run/fmwk-pwr/fmwk-pwr.sock",
  watcherIntervalMs: 5000,
  defaultProfile: "default",
  firstTimeSetup: true,
  hardwareLimits: {
    minPowerMw: 15_000,
    maxStapmMw: 132_000,
    maxSlowMw: 154_000,
    maxFastMw: 170_000,
    minGpuClockMhz: 200,
    maxGpuClockMhz: 3_000,
    minCpuClockMhz: 400,
    maxCpuClockMhz: 5_500,
  },
  user: { ...DEFAULT_USER },
};

// =====================================
// Path Resolution
// =====================================

/**
 * Checks whether the server is running in development mode.
 * @returns true if NODE_ENV is not "production"
 */
function isDev(): boolean {
  return process.env.NODE_ENV !== "production";
}

/**
 * Walks up from the server package directory to find the monorepo root,
 * identified by a package.json with name "fmwk-pwr".
 * Falls back to the server package's parent directory if not found.
 * @returns Absolute path to the project root directory
 */
function findProjectRoot(): string {
  let dir = dirname(import.meta.dir);
  while (dir !== "/") {
    if (existsSync(join(dir, "package.json"))) {
      const pkg = JSON.parse(
        readFileSync(join(dir, "package.json"), "utf-8"),
      );
      if (pkg.name === "fmwk-pwr") return dir;
    }
    dir = dirname(dir);
  }
  return dirname(import.meta.dir);
}

/**
 * Determines the config file path using a fallback chain:
 * 1. Dev mode: `<project-root>/config/config.json`
 * 2. Production: `/etc/fmwk-pwr/config.json`
 *
 * Always returns a target path even if the file does not exist yet,
 * so that first-time setup can create it via {@link saveConfig}.
 * @returns Absolute path to the config file
 */
function resolveConfigPath(): string {
  if (isDev()) {
    return resolve(findProjectRoot(), "config/config.json");
  }
  return SYSTEM_CONFIG_PATH;
}

// =====================================
// Validation
// =====================================

/**
 * Validates a raw parsed JSON object against the ServerConfig schema.
 * Merges validated fields over DEFAULT_CONFIG so unspecified fields retain defaults.
 * @param raw - Parsed JSON value to validate
 * @returns A fully populated ServerConfig
 * @throws If the input is not an object or any field has an invalid type/value
 */
function validateConfig(raw: unknown): ServerConfig {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Config must be a JSON object");
  }

  const obj = raw as Record<string, unknown>;

  const config: ServerConfig = { ...DEFAULT_CONFIG };

  if ("gpuSysfsPath" in obj) {
    if (typeof obj.gpuSysfsPath !== "string") {
      throw new Error("gpuSysfsPath must be a string");
    }
    config.gpuSysfsPath = obj.gpuSysfsPath;
  }

  if ("socketPath" in obj) {
    if (typeof obj.socketPath !== "string") {
      throw new Error("socketPath must be a string");
    }
    config.socketPath = obj.socketPath;
  }

  if ("watcherIntervalMs" in obj) {
    if (
      typeof obj.watcherIntervalMs !== "number" ||
      obj.watcherIntervalMs <= 0
    ) {
      throw new Error("watcherIntervalMs must be a positive number");
    }
    config.watcherIntervalMs = obj.watcherIntervalMs;
  }

  if ("defaultProfile" in obj) {
    if (typeof obj.defaultProfile !== "string" || obj.defaultProfile === "") {
      throw new Error("defaultProfile must be a non-empty string");
    }
    config.defaultProfile = obj.defaultProfile;
  }

  if ("firstTimeSetup" in obj) {
    if (typeof obj.firstTimeSetup !== "boolean") {
      throw new Error("firstTimeSetup must be a boolean");
    }
    config.firstTimeSetup = obj.firstTimeSetup;
  }

  if ("hardwareLimits" in obj) {
    if (typeof obj.hardwareLimits !== "object" || obj.hardwareLimits === null) {
      throw new Error("hardwareLimits must be an object");
    }
    const hl = obj.hardwareLimits as Record<string, unknown>;
    const fields: (keyof HardwareLimits)[] = [
      "minPowerMw",
      "maxStapmMw",
      "maxSlowMw",
      "maxFastMw",
      "minGpuClockMhz",
      "maxGpuClockMhz",
    ];
    for (const field of fields) {
      if (typeof hl[field] !== "number" || (hl[field] as number) <= 0) {
        throw new Error(`hardwareLimits.${field} must be a positive number`);
      }
    }
    config.hardwareLimits = { ...DEFAULT_CONFIG.hardwareLimits, ...hl } as unknown as HardwareLimits;
  }

  if ("user" in obj) {
    if (typeof obj.user !== "object" || obj.user === null) {
      throw new Error("user must be an object");
    }
    const u = obj.user as Record<string, unknown>;
    config.user = { ...DEFAULT_USER };
    if ("theme" in u) {
      if (typeof u.theme !== "string") {
        throw new Error("user.theme must be a string");
      }
      config.user.theme = u.theme;
    }
  }

  return config;
}

// =====================================
// Public API
// =====================================

/**
 * Loads the server configuration from disk, falling back to built-in
 * defaults if the config file does not exist yet (first-time startup).
 * @returns The resolved config and the target config file path
 */
export function loadConfig(): { config: ServerConfig; configPath: string } {
  const configPath = resolveConfigPath();

  if (!existsSync(configPath)) {
    console.log("[config] No config file found, using defaults (first-time setup)");
    return { config: { ...DEFAULT_CONFIG }, configPath };
  }

  console.log(`[config] Loading config from ${configPath}`);
  const raw = JSON.parse(readFileSync(configPath, "utf-8"));
  const config = validateConfig(raw);
  return { config, configPath };
}

/**
 * Resolves the profiles directory as a sibling of the config file.
 * @param configPath - Absolute path to the config file
 * @returns Absolute path to the profiles directory
 */
export function resolveProfilesDir(configPath: string): string {
  return resolve(dirname(configPath), "profiles");
}

/**
 * Resolves the presets directory as a sibling of the config file.
 * @param configPath - Absolute path to the config file
 * @returns Absolute path to the presets directory
 */
export function resolvePresetsDir(configPath: string): string {
  return resolve(dirname(configPath), "presets");
}

/**
 * Writes the server configuration to disk as formatted JSON.
 * Creates the parent directory if it does not exist (first-time setup).
 * @param configPath - Absolute path to the config file
 * @param config - The server configuration to persist
 */
export function saveConfig(configPath: string, config: ServerConfig): void {
  const dir = dirname(configPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
}
