import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";
import type { Profile, HardwareInfo } from "@fmwk-pwr/shared";
import type { HardwareStrategy } from "../hardware/strategy.js";

// =====================================
// Constants
// =====================================

/** Pattern for valid profile names: alphanumeric and hyphens, must start with a letter or digit. */
const NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9-]*$/;

// =====================================
// Profile Manager
// =====================================

/**
 * Manages the lifecycle of power profiles: loading from disk, CRUD operations,
 * hardware validation, and applying profiles to the hardware via HardwareStrategy.
 */
export class ProfileManager {
  private profiles = new Map<string, Profile>();
  private profilesDir: string;
  private hardware: HardwareStrategy;

  /**
   * Creates a new ProfileManager.
   * @param profilesDir - Absolute path to the directory containing profile JSON files
   * @param hardware - Hardware strategy used for validation and applying power/GPU settings
   */
  constructor(profilesDir: string, hardware: HardwareStrategy) {
    this.profilesDir = profilesDir;
    this.hardware = hardware;
  }

  // =====================================
  // Lifecycle
  // =====================================

  /**
   * Loads all profile JSON files from the profiles directory into memory.
   * Clears any previously loaded profiles before scanning. Invalid files
   * are logged and skipped rather than causing a fatal error.
   */
  loadAll(): void {
    this.profiles.clear();

    if (!existsSync(this.profilesDir)) {
      console.log(`[profiles] Profiles directory not found: ${this.profilesDir}`);
      return;
    }

    const files = readdirSync(this.profilesDir).filter((f: string) =>
      f.endsWith(".json"),
    );

    for (const file of files) {
      const filePath = join(this.profilesDir, file);
      try {
        const raw = JSON.parse(readFileSync(filePath, "utf-8"));
        const profile = validateProfile(raw);
        this.profiles.set(profile.name, profile);
        console.log(`[profiles] Loaded profile: ${profile.name}`);
      } catch (err) {
        console.error(
          `[profiles] Failed to load ${file}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    console.log(`[profiles] Loaded ${this.profiles.size} profiles`);
  }

  // =====================================
  // CRUD
  // =====================================

  /**
   * Returns all loaded profiles as an array.
   * @returns Array of all profiles currently in memory
   */
  list(): Profile[] {
    return Array.from(this.profiles.values());
  }

  /**
   * Retrieves a single profile by name.
   * @param name - The profile name to look up
   * @returns The matching profile, or undefined if not found
   */
  get(name: string): Profile | undefined {
    return this.profiles.get(name);
  }

  /**
   * Creates a new profile after validating its structure and checking
   * hardware constraints. Persists the profile to disk on success.
   * @param profile - The profile data to create
   * @returns The validated and saved profile
   * @throws If a profile with the same name already exists or validation fails
   */
  async create(profile: Profile): Promise<Profile> {
    const validated = validateProfile(profile);

    if (this.profiles.has(validated.name)) {
      throw new Error(`Profile "${validated.name}" already exists`);
    }

    const hwErrors = this.hardware.validateProfile(validated);
    if (hwErrors.length > 0) {
      throw new Error(`Validation failed: ${hwErrors.join(", ")}`);
    }

    this.profiles.set(validated.name, validated);
    this.saveToDisk(validated);

    console.log(`[profiles] Created profile: ${validated.name}`);
    return validated;
  }

  /**
   * Updates an existing profile. Supports renaming: if the new profile name
   * differs from the original, the old file is removed from disk.
   * @param name - Current name of the profile to update
   * @param profile - The new profile data (may have a different name for renaming)
   * @returns The validated and saved profile
   * @throws If the profile does not exist or validation fails
   */
  async update(name: string, profile: Profile): Promise<Profile> {
    if (!this.profiles.has(name)) {
      throw new Error(`Profile "${name}" not found`);
    }

    const validated = validateProfile(profile);

    const hwErrors = this.hardware.validateProfile(validated);
    if (hwErrors.length > 0) {
      throw new Error(`Validation failed: ${hwErrors.join(", ")}`);
    }

    // If renaming, remove old entry and file
    if (name !== validated.name) {
      this.profiles.delete(name);
      const oldPath = join(this.profilesDir, `${name}.json`);
      if (existsSync(oldPath)) {
        unlinkSync(oldPath);
      }
    }

    this.profiles.set(validated.name, validated);
    this.saveToDisk(validated);

    console.log(`[profiles] Updated profile: ${validated.name}`);
    return validated;
  }

  /**
   * Deletes a profile from memory and removes its JSON file from disk.
   * @param name - The name of the profile to delete
   * @throws If the profile does not exist
   */
  async delete(name: string): Promise<void> {
    if (!this.profiles.has(name)) {
      throw new Error(`Profile "${name}" not found`);
    }

    this.profiles.delete(name);
    const filePath = join(this.profilesDir, `${name}.json`);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }

    console.log(`[profiles] Deleted profile: ${name}`);
  }

  // =====================================
  // Apply
  // =====================================

  /**
   * Applies a profile to the hardware: sets power limits (stapm/slow/fast) via
   * libryzenadj, configures GPU clock or performance level, activates the
   * TuneD profile, and reads back current hardware info.
   * @param name - The name of the profile to apply
   * @returns The applied profile and the hardware info snapshot taken after application
   * @throws If the profile does not exist
   */
  async apply(
    name: string,
  ): Promise<{ profile: Profile; hwInfo: HardwareInfo }> {
    const profile = this.profiles.get(name);
    if (!profile) {
      throw new Error(`Profile "${name}" not found`);
    }

    console.log(`[profiles] Applying profile: ${name}`);

    this.hardware.applyPowerLimits(
      profile.power.stapmLimit,
      profile.power.slowLimit,
      profile.power.fastLimit,
    );

    await this.hardware.applyCpuMaxClock(profile.cpu.maxClockMhz);

    if (profile.gpu.clockMhz !== null) {
      await this.hardware.applyGpuClock(profile.gpu.clockMhz);
    } else {
      await this.hardware.applyGpuPerfLevel(profile.gpu.perfLevel);
    }

    await this.hardware.applyTunedProfile(profile.tunedProfile);

    const hwInfo = await this.hardware.readHardwareInfo();

    return { profile, hwInfo };
  }

  // =====================================
  // Persistence
  // =====================================

  /**
   * Writes a profile to disk as pretty-printed JSON.
   * @param profile - The profile to persist
   */
  private saveToDisk(profile: Profile): void {
    if (!existsSync(this.profilesDir)) {
      mkdirSync(this.profilesDir, { recursive: true });
    }
    const filePath = join(this.profilesDir, `${profile.name}.json`);
    writeFileSync(filePath, JSON.stringify(profile, null, 2) + "\n");
  }
}

// =====================================
// Validation
// =====================================

/**
 * Validates and normalizes a raw object into a well-typed Profile.
 * Checks all required fields, types, and constraints including profile name format,
 * power limits (mW, nullable), GPU settings, TuneD profile, and process match rules.
 * @param raw - Parsed JSON value to validate
 * @returns A fully validated Profile object
 * @throws If any field is missing, has an invalid type, or fails a constraint
 */
function validateProfile(raw: unknown): Profile {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Profile must be a JSON object");
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj.name !== "string" || !NAME_PATTERN.test(obj.name)) {
    throw new Error(
      "Profile name must be alphanumeric with hyphens, not starting with a hyphen",
    );
  }

  if (obj.description !== undefined && typeof obj.description !== "string") {
    throw new Error("description must be a string");
  }

  // Validate power
  if (typeof obj.power !== "object" || obj.power === null) {
    throw new Error("power must be an object");
  }
  const power = obj.power as Record<string, unknown>;
  validateNullableNumber(power.stapmLimit, "power.stapmLimit");
  validateNullableNumber(power.slowLimit, "power.slowLimit");
  validateNullableNumber(power.fastLimit, "power.fastLimit");

  // Validate cpu
  if (typeof obj.cpu !== "object" || obj.cpu === null) {
    throw new Error("cpu must be an object");
  }
  const cpu = obj.cpu as Record<string, unknown>;
  validateNullableNumber(cpu.maxClockMhz, "cpu.maxClockMhz");

  // Validate gpu
  if (typeof obj.gpu !== "object" || obj.gpu === null) {
    throw new Error("gpu must be an object");
  }
  const gpu = obj.gpu as Record<string, unknown>;
  validateNullableNumber(gpu.clockMhz, "gpu.clockMhz");
  if (
    gpu.perfLevel !== null &&
    gpu.perfLevel !== "auto" &&
    gpu.perfLevel !== "high"
  ) {
    throw new Error('gpu.perfLevel must be "auto", "high", or null');
  }

  // Validate tunedProfile
  if (obj.tunedProfile !== null && typeof obj.tunedProfile !== "string") {
    throw new Error("tunedProfile must be a string or null");
  }

  // Validate match
  if (typeof obj.match !== "object" || obj.match === null) {
    throw new Error("match must be an object");
  }
  const match = obj.match as Record<string, unknown>;
  if (typeof match.enabled !== "boolean") {
    throw new Error("match.enabled must be a boolean");
  }
  if (!Array.isArray(match.processPatterns)) {
    throw new Error("match.processPatterns must be an array");
  }
  for (const pattern of match.processPatterns) {
    if (typeof pattern !== "string") {
      throw new Error("match.processPatterns must contain only strings");
    }
    try {
      new RegExp(pattern);
    } catch {
      throw new Error(`Invalid regex pattern: ${pattern}`);
    }
  }
  if (typeof match.priority !== "number") {
    throw new Error("match.priority must be a number");
  }
  if (match.revertProfile !== null && typeof match.revertProfile !== "string") {
    throw new Error("match.revertProfile must be a string or null");
  }

  return {
    name: obj.name,
    ...(obj.description !== undefined && { description: obj.description as string }),
    power: {
      stapmLimit: power.stapmLimit as number | null,
      slowLimit: power.slowLimit as number | null,
      fastLimit: power.fastLimit as number | null,
    },
    cpu: {
      maxClockMhz: cpu.maxClockMhz as number | null,
    },
    gpu: {
      clockMhz: gpu.clockMhz as number | null,
      perfLevel: gpu.perfLevel as "auto" | "high" | null,
    },
    tunedProfile: obj.tunedProfile as string | null,
    match: {
      enabled: match.enabled as boolean,
      processPatterns: match.processPatterns as string[],
      priority: match.priority as number,
      revertProfile: (match.revertProfile as string | null) ?? null,
    },
  };
}

/**
 * Asserts that a value is either a number or null, throwing a descriptive error otherwise.
 * Used to validate nullable numeric profile fields like power limits (mW) and GPU clock (MHz).
 * @param value - The value to check
 * @param field - The field name for error messages (e.g. "power.stapmLimit")
 */
function validateNullableNumber(
  value: unknown,
  field: string,
): asserts value is number | null {
  if (value !== null && typeof value !== "number") {
    throw new Error(`${field} must be a number or null`);
  }
}
