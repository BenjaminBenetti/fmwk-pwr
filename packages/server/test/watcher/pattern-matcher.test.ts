import { describe, it, expect } from "bun:test";
import type { Profile } from "@fmwk-pwr/shared";
import { PatternMatcher } from "../../src/watcher/pattern-matcher.js";

function makeProfile(overrides: Partial<Profile> & { name: string }): Profile {
  return {
    power: { stapmLimit: null, slowLimit: null, fastLimit: null },
    cpu: { maxClockMhz: null },
    gpu: { clockMhz: null, perfLevel: null },
    tunedProfile: null,
    match: { enabled: true, processPatterns: [], priority: 0, revertProfile: null },
    ...overrides,
  };
}

describe("PatternMatcher", () => {
  describe("findMatch", () => {
    it("returns null with no profiles", () => {
      const matcher = new PatternMatcher();
      matcher.updateProfiles([]);
      expect(matcher.findMatch(["/usr/bin/bash"])).toBeNull();
    });

    it("returns matching profile name", () => {
      const matcher = new PatternMatcher();
      matcher.updateProfiles([
        makeProfile({ name: "gaming", match: { enabled: true, processPatterns: ["steam"], priority: 0, revertProfile: null } }),
      ]);
      expect(matcher.findMatch(["steam game.exe"])).toBe("gaming");
    });

    it("returns null when no pattern matches", () => {
      const matcher = new PatternMatcher();
      matcher.updateProfiles([
        makeProfile({ name: "gaming", match: { enabled: true, processPatterns: ["steam"], priority: 0, revertProfile: null } }),
      ]);
      expect(matcher.findMatch(["/usr/bin/firefox"])).toBeNull();
    });

    it("returns higher priority profile when multiple match", () => {
      const matcher = new PatternMatcher();
      matcher.updateProfiles([
        makeProfile({ name: "low", match: { enabled: true, processPatterns: ["game"], priority: 1, revertProfile: null } }),
        makeProfile({ name: "high", match: { enabled: true, processPatterns: ["game"], priority: 10, revertProfile: null } }),
      ]);
      expect(matcher.findMatch(["game.exe"])).toBe("high");
    });

    it("matches case-insensitively", () => {
      const matcher = new PatternMatcher();
      matcher.updateProfiles([
        makeProfile({ name: "gaming", match: { enabled: true, processPatterns: ["Steam"], priority: 0, revertProfile: null } }),
      ]);
      expect(matcher.findMatch(["STEAM"])).toBe("gaming");
      expect(matcher.findMatch(["steam"])).toBe("gaming");
      expect(matcher.findMatch(["sTeAm"])).toBe("gaming");
    });

    it("skips disabled profiles", () => {
      const matcher = new PatternMatcher();
      matcher.updateProfiles([
        makeProfile({ name: "disabled", match: { enabled: false, processPatterns: ["steam"], priority: 0, revertProfile: null } }),
      ]);
      expect(matcher.findMatch(["steam"])).toBeNull();
    });

    it("skips profiles with empty processPatterns", () => {
      const matcher = new PatternMatcher();
      matcher.updateProfiles([
        makeProfile({ name: "empty", match: { enabled: true, processPatterns: [], priority: 0, revertProfile: null } }),
      ]);
      expect(matcher.findMatch(["anything"])).toBeNull();
    });

    it("matches if ANY pattern in a profile matches", () => {
      const matcher = new PatternMatcher();
      matcher.updateProfiles([
        makeProfile({
          name: "gaming",
          match: { enabled: true, processPatterns: ["steam", "lutris", "heroic"], priority: 0, revertProfile: null },
        }),
      ]);
      expect(matcher.findMatch(["lutris --no-gui"])).toBe("gaming");
    });

    it("breaks priority ties alphabetically by name", () => {
      const matcher = new PatternMatcher();
      matcher.updateProfiles([
        makeProfile({ name: "zebra", match: { enabled: true, processPatterns: ["app"], priority: 5, revertProfile: null } }),
        makeProfile({ name: "alpha", match: { enabled: true, processPatterns: ["app"], priority: 5, revertProfile: null } }),
      ]);
      expect(matcher.findMatch(["app"])).toBe("alpha");
    });

    it("supports regex patterns", () => {
      const matcher = new PatternMatcher();
      matcher.updateProfiles([
        makeProfile({
          name: "gaming",
          match: { enabled: true, processPatterns: ["^/opt/games/.*\\.exe$"], priority: 0, revertProfile: null },
        }),
      ]);
      expect(matcher.findMatch(["/opt/games/doom.exe"])).toBe("gaming");
      expect(matcher.findMatch(["/usr/bin/doom.exe"])).toBeNull();
    });
  });

  describe("updateProfiles", () => {
    it("replaces previous state when called again", () => {
      const matcher = new PatternMatcher();
      matcher.updateProfiles([
        makeProfile({ name: "first", match: { enabled: true, processPatterns: ["first-app"], priority: 0, revertProfile: null } }),
      ]);
      expect(matcher.findMatch(["first-app"])).toBe("first");

      matcher.updateProfiles([
        makeProfile({ name: "second", match: { enabled: true, processPatterns: ["second-app"], priority: 0, revertProfile: null } }),
      ]);
      expect(matcher.findMatch(["first-app"])).toBeNull();
      expect(matcher.findMatch(["second-app"])).toBe("second");
    });

    it("skips invalid regex patterns without crashing", () => {
      const matcher = new PatternMatcher();
      matcher.updateProfiles([
        makeProfile({
          name: "bad-regex",
          match: { enabled: true, processPatterns: ["[invalid", "valid-pattern"], priority: 0, revertProfile: null },
        }),
      ]);
      // Should still match on the valid pattern
      expect(matcher.findMatch(["valid-pattern"])).toBe("bad-regex");
    });
  });
});
