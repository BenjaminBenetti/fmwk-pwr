import type { Profile } from "@fmwk-pwr/shared";

interface CompiledProfile {
  name: string;
  patterns: RegExp[];
  priority: number;
}

export class PatternMatcher {
  private compiled: CompiledProfile[] = [];

  /** Pre-compile regex patterns from enabled profiles. */
  updateProfiles(profiles: Profile[]): void {
    this.compiled = [];

    for (const profile of profiles) {
      if (!profile.match.enabled) continue;
      if (profile.match.processPatterns.length === 0) continue;

      const patterns: RegExp[] = [];
      for (const raw of profile.match.processPatterns) {
        try {
          patterns.push(new RegExp(raw, "i"));
        } catch {
          console.warn(
            `[PatternMatcher] Skipping invalid regex "${raw}" in profile "${profile.name}"`,
          );
        }
      }

      if (patterns.length > 0) {
        this.compiled.push({
          name: profile.name,
          patterns,
          priority: profile.match.priority,
        });
      }
    }
  }

  /** Find the highest-priority matching profile. Returns profile name or null. */
  findMatch(processLines: string[]): string | null {
    let bestName: string | null = null;
    let bestPriority = -Infinity;

    for (const entry of this.compiled) {
      const matches = entry.patterns.some((re) =>
        processLines.some((line) => re.test(line)),
      );

      if (!matches) continue;

      if (
        entry.priority > bestPriority ||
        (entry.priority === bestPriority && (bestName === null || entry.name < bestName))
      ) {
        bestName = entry.name;
        bestPriority = entry.priority;
      }
    }

    return bestName;
  }
}
