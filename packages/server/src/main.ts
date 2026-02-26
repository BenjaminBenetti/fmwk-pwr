import { loadConfig, resolveProfilesDir, resolvePresetsDir } from "./config/config.js";
import { SocketServer } from "./socket/server.js";
import { createHandler } from "./socket/handler.js";
import { ProfileManager } from "./profiles/manager.js";
import { detectHardware } from "./hardware/detect.js";
import { ProcessWatcher } from "./watcher/watcher.js";
import type { ServerState } from "./state.js";

// =====================================
// Startup
// =====================================

/**
 * Main entry point for the fmwk-pwr server. Initializes configuration,
 * detects hardware, loads profiles, applies the default profile, and
 * starts the Unix socket server. Registers signal handlers for graceful shutdown.
 */
async function main(): Promise<void> {
  console.log("fmwk-pwr server starting...");

  // Load config
  const { config, configPath } = loadConfig();
  const profilesDir = resolveProfilesDir(configPath);
  const presetsDir = resolvePresetsDir(configPath);

  // Detect hardware
  const hardware = await detectHardware(config.hardwareLimits);
  console.log(`[main] Detected hardware: ${hardware.name}`);

  // Initialize state
  const state: ServerState = {
    activeProfile: config.defaultProfile,
    activatedBy: "startup",
    lastHwInfo: null,
    lastHwInfoTime: null,
    config,
    configPath,
  };

  // Load profiles
  const profileManager = new ProfileManager(profilesDir, hardware);
  profileManager.loadAll();

  // If no profiles exist, create a default with all settings off
  if (profileManager.list().length === 0) {
    console.log("[main] No profiles found, creating default profile");
    await profileManager.create({
      name: config.defaultProfile,
      power: { stapmLimit: null, slowLimit: null, fastLimit: null },
      cpu: { maxClockMhz: null, minClockMhz: null },
      gpu: { maxClockMhz: null, minClockMhz: null, perfLevel: null },
      tunedProfile: null,
      match: { enabled: false, processPatterns: [], priority: 0, revertProfile: null },
    });
  }

  // Apply default profile on startup
  try {
    const { hwInfo } = await profileManager.apply(config.defaultProfile);
    state.lastHwInfo = hwInfo;
    state.lastHwInfoTime = Date.now();
    console.log(`[main] Applied default profile: ${config.defaultProfile}`);
  } catch (err) {
    console.error(
      `[main] Failed to apply default profile "${config.defaultProfile}":`,
      err instanceof Error ? err.message : err,
    );
  }

  // Start socket server
  const handler = createHandler(profileManager, state, hardware, presetsDir);
  const socketServer = new SocketServer(config.socketPath, handler);
  socketServer.start();

  // Start process watcher
  const watcher = new ProcessWatcher({
    profileManager,
    state,
    intervalMs: config.watcherIntervalMs,
  });
  watcher.start();

  // =====================================
  // Shutdown
  // =====================================

  /**
   * Gracefully shuts down the server: stops the process watcher, socket
   * listener, releases hardware resources (closes libryzenadj handle), and exits.
   */
  const shutdown = (): void => {
    console.log("\n[main] Shutting down...");
    watcher.stop();
    socketServer.stop();
    hardware.destroy();
    console.log("[main] Goodbye");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  console.log("[main] Server ready");
}

// =====================================
// Entry Point
// =====================================

main().catch((err) => {
  console.error("[main] Fatal error:", err);
  process.exit(1);
});
