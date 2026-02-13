import { readdir, readFile } from "node:fs/promises";

/**
 * Scans /proc to collect command lines of all running processes.
 * Returns an array of non-empty command line strings.
 */
export async function scanProcesses(): Promise<string[]> {
  const entries = await readdir("/proc");
  const pids = entries.filter((e) => /^\d+$/.test(e));

  const results: string[] = [];

  for (const pid of pids) {
    try {
      const raw = await readFile(`/proc/${pid}/cmdline`, "utf-8");
      if (raw.length === 0) continue; // kernel thread
      // cmdline is null-byte separated; join args with spaces
      const cmdline = raw.replace(/\0+$/, "").replaceAll("\0", " ");
      if (cmdline.length > 0) {
        results.push(cmdline);
      }
    } catch {
      // Process may have exited (ENOENT) or be inaccessible (EACCES) — skip
    }
  }

  return results;
}
