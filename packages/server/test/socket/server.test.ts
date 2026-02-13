import { describe, expect, test } from "bun:test";

describe("NDJSON protocol", () => {
  test("single JSON message followed by newline parses correctly", () => {
    const raw = '{"id":"1","method":"profile.list"}\n';
    const lines = raw.split("\n").filter((l) => l.trim());
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toEqual({ id: "1", method: "profile.list" });
  });

  test("multiple messages in one chunk split correctly", () => {
    const raw =
      '{"id":"1","method":"profile.list"}\n{"id":"2","method":"status.get"}\n';
    const lines = raw.split("\n").filter((l) => l.trim());
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).id).toBe("1");
    expect(JSON.parse(lines[1]).id).toBe("2");
  });

  test("partial message handling (buffer accumulation)", () => {
    // Simulate receiving data in chunks
    let buffer = "";

    // Chunk 1: partial message
    buffer += '{"id":"1","met';

    let lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    const completedLines1 = lines.filter((l) => l.trim());
    expect(completedLines1).toHaveLength(0); // No complete messages yet

    // Chunk 2: rest of message + newline
    buffer += 'hod":"profile.list"}\n';

    lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    const completedLines2 = lines.filter((l) => l.trim());
    expect(completedLines2).toHaveLength(1);
    expect(JSON.parse(completedLines2[0])).toEqual({
      id: "1",
      method: "profile.list",
    });
    expect(buffer).toBe(""); // Buffer should be empty
  });

  test("empty lines between messages are skipped", () => {
    const raw = '{"id":"1","method":"a"}\n\n\n{"id":"2","method":"b"}\n';
    const lines = raw
      .split("\n")
      .filter((l) => l.trim());
    expect(lines).toHaveLength(2);
  });

  test("response serialization produces NDJSON", () => {
    const response = { id: "1", result: { profiles: [] } };
    const serialized = JSON.stringify(response) + "\n";
    expect(serialized).toEndWith("\n");
    expect(serialized.split("\n").filter((l) => l.trim())).toHaveLength(1);
    expect(JSON.parse(serialized.trim())).toEqual(response);
  });

  test("error response serialization", () => {
    const error = {
      id: "1",
      error: { code: "NOT_FOUND", message: "Profile not found" },
    };
    const serialized = JSON.stringify(error) + "\n";
    const parsed = JSON.parse(serialized.trim());
    expect(parsed.error.code).toBe("NOT_FOUND");
    expect(parsed.error.message).toBe("Profile not found");
  });

  test("parse error on malformed JSON", () => {
    const raw = "not valid json";
    expect(() => JSON.parse(raw)).toThrow();
  });

  test("request validation: missing id", () => {
    const parsed = JSON.parse('{"method":"profile.list"}');
    expect(parsed.id).toBeUndefined();
    expect(!parsed.id).toBe(true); // falsy check used in server
  });

  test("request validation: missing method", () => {
    const parsed = JSON.parse('{"id":"1"}');
    expect(parsed.method).toBeUndefined();
    expect(!parsed.method).toBe(true);
  });

  test("buffer handles message split across three chunks", () => {
    let buffer = "";

    buffer += '{"id":';
    let lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    expect(lines.filter((l) => l.trim())).toHaveLength(0);

    buffer += '"1","method":';
    lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    expect(lines.filter((l) => l.trim())).toHaveLength(0);

    buffer += '"profile.list"}\n';
    lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    const completed = lines.filter((l) => l.trim());
    expect(completed).toHaveLength(1);
    expect(JSON.parse(completed[0]).method).toBe("profile.list");
  });
});
