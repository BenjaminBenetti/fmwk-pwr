import type { ProfileManager } from "../profiles/manager.js";
import type { ServerState } from "../state.js";
import { scanProcesses as defaultScanProcesses } from "./process-scanner.js";
import { PatternMatcher } from "./pattern-matcher.js";

/**
 * Periodically scans running processes and auto-switches the active profile
 * when a higher-priority match is detected. Implements debounce to avoid
 * rapid switching from transient processes.
 */
export class ProcessWatcher {
  private profileManager: ProfileManager;
  private state: ServerState;
  private matcher = new PatternMatcher();
  private scanner: () => Promise<string[]>;
  private intervalMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private debounceThreshold: number;

  /** Name of the candidate profile that must be seen consecutively. */
  private candidate: string | null = null;
  /** How many consecutive scans the candidate has been matched. */
  private candidateCount = 0;

  constructor(opts: {
    profileManager: ProfileManager;
    state: ServerState;
    intervalMs: number;
    debounceThreshold?: number;
    scanner?: () => Promise<string[]>;
  }) {
    this.profileManager = opts.profileManager;
    this.state = opts.state;
    this.intervalMs = opts.intervalMs;
    this.debounceThreshold = opts.debounceThreshold ?? 2;
    this.scanner = opts.scanner ?? defaultScanProcesses;
  }

  /**
   * Refreshes the compiled regex patterns from the current profile list.
   * Call after profiles are created, updated, or deleted.
   */
  refreshProfiles(): void {
    this.matcher.updateProfiles(this.profileManager.list());
  }

  /** Starts the periodic process scan loop. */
  start(): void {
    if (this.timer !== null) return;
    if (this.intervalMs < 500) {
      console.warn(
        `[watcher] intervalMs=${this.intervalMs} is too low, clamping to 500`,
      );
      this.intervalMs = 500;
    }
    this.refreshProfiles();
    this.timer = setInterval(() => this.tick(), this.intervalMs);
    console.log(
      `[watcher] Started (interval=${this.intervalMs}ms, debounce=${this.debounceThreshold})`,
    );
  }

  /** Stops the scan loop. */
  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
      console.log("[watcher] Stopped");
    }
  }

  /**
   * Single scan iteration. Exported for testing — not intended for direct use.
   */
  async tick(): Promise<void> {
    try {
      this.refreshProfiles();
      const processes = await this.scanner();
      const match = this.matcher.findMatch(processes);

      if (match === null) {
        // No match — keep current profile, reset debounce
        this.candidate = null;
        this.candidateCount = 0;
        return;
      }

      // Track consecutive matches for debounce
      if (match === this.candidate) {
        this.candidateCount++;
      } else {
        this.candidate = match;
        this.candidateCount = 1;
      }

      // Don't switch until debounce threshold is met
      if (this.candidateCount < this.debounceThreshold) return;

      // Don't re-apply if already on this profile
      if (match === this.state.activeProfile) return;

      // Apply the matched profile
      const { hwInfo } = await this.profileManager.apply(match);
      this.state.activeProfile = match;
      this.state.activatedBy = "auto";
      this.state.lastHwInfo = hwInfo;
      this.state.lastHwInfoTime = Date.now();

      console.log(`[watcher] Auto-switched to profile: ${match}`);
    } catch (err) {
      console.error(
        "[watcher] Scan error:",
        err instanceof Error ? err.message : err,
      );
    }
  }
}
