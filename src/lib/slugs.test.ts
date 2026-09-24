import { describe, expect, it } from "vitest";
import { composeSlug, parseSlugId, slugifyName } from "./slugs";

describe("slugifyName", () => {
  it("lowercases and hyphenates simple string", () => {
    expect(slugifyName("Dungeons and Dads")).toBe("dungeons-and-dads");
  });

  it("strips non-alphanumerics and handles multiple spaces", () => {
    expect(slugifyName("Dungeons & Dads! 2026")).toBe("dungeons-dads-2026");
  });

  it("trims and collapses hyphens", () => {
    expect(slugifyName("---  Space   Wolves ---")).toBe("space-wolves");
  });

  it("returns empty string for pure special characters", () => {
    expect(slugifyName("!!! $$$ %%%")).toBe("");
  });
});

describe("composeSlug", () => {
  it("combines slugified name and slugId", () => {
    expect(composeSlug("Dungeons and Dads", "a1b2c3")).toBe("dungeons-and-dads-a1b2c3");
  });

  it("falls back to slugId when name slugifies to empty string", () => {
    expect(composeSlug("!!!", "a1b2c3")).toBe("a1b2c3");
    expect(composeSlug("", "a1b2c3")).toBe("a1b2c3");
  });
});

describe("parseSlugId", () => {
  it("extracts 6-character slugId from composed slug", () => {
    expect(parseSlugId("dungeons-and-dads-a1b2c3")).toBe("a1b2c3");
  });

  it("parses bare 6-character slugId", () => {
    expect(parseSlugId("a1b2c3")).toBe("a1b2c3");
  });

  it("returns null for malformed slugs", () => {
    expect(parseSlugId("dungeons-and-dads-12345")).toBeNull(); // 5 chars
    expect(parseSlugId("1234567")).toBeNull(); // 7 chars without hyphens
    expect(parseSlugId("invalid_slug!")).toBeNull();
    expect(parseSlugId("")).toBeNull();
    expect(parseSlugId(null)).toBeNull();
    expect(parseSlugId(undefined)).toBeNull();
  });

  it("handles multiple hyphens in group name", () => {
    expect(parseSlugId("renamed-cool-group-name-x9k2p4")).toBe("x9k2p4");
  });
});
