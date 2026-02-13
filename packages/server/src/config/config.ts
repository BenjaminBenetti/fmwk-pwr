import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import type { ServerConfig } from "@fmwk-pwr/shared";

// =====================================
// Configuration Defaults
// =====================================

const SYSTEM_CONFIG_PATH = "/etc/fmwk-pwr/config.json";

const DEFAULT_CONFIG: ServerConfig = {
  gpuSysfsPath: "/sys/class/drm/card1/device",
  socketPath: "/run/fmwk-pwr/fmwk-pwr.sock",
  watcherIntervalMs: 5000,
  defaultProfile: "default",
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
 * Determines which config file to load using a fallback chain:
 * 1. Dev mode: `<project-root>/config/config.json`
 * 2. System path: `/etc/fmwk-pwr/config.json`
 * 3. Empty string if no config file exists (triggers defaults)
 * @returns Absolute path to the config file, or empty string if none found
 */
function resolveConfigPath(): string {
  if (isDev()) {
    const devPath = resolve(findProjectRoot(), "config/config.json");
    if (existsSync(devPath)) {
      return devPath;
    }
  }
  if (existsSync(SYSTEM_CONFIG_PATH)) {
    return SYSTEM_CONFIG_PATH;
  }
  return "";
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

  return config;
}

// =====================================
// Public API
// =====================================

/**
 * Loads the server configuration from disk with fallback chain:
 * dev path -> system path -> built-in defaults.
 * @returns The resolved config and the path it was loaded from (empty string if defaults were used)
 */
export function loadConfig(): { config: ServerConfig; configPath: string } {
  const configPath = resolveConfigPath();

  if (!configPath) {
    console.log("[config] No config file found, using defaults");
    return { config: { ...DEFAULT_CONFIG }, configPath: "" };
  }

  console.log(`[config] Loading config from ${configPath}`);
  const raw = JSON.parse(readFileSync(configPath, "utf-8"));
  const config = validateConfig(raw);
  return { config, configPath };
}

/**
 * Resolves the profiles directory path based on the loaded config location.
 * Uses the directory adjacent to the config file, falling back to the system
 * path `/etc/fmwk-pwr/profiles` or the dev `config/profiles` directory.
 * @param configPath - Path to the loaded config file (empty string if defaults were used)
 * @returns Absolute path to the profiles directory
 */
export function resolveProfilesDir(configPath: string): string {
  if (configPath) {
    return resolve(dirname(configPath), "profiles");
  }
  if (existsSync("/etc/fmwk-pwr/profiles")) {
    return "/etc/fmwk-pwr/profiles";
  }
  return resolve(findProjectRoot(), "config/profiles");
}
