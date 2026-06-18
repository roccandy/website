import { describe, expect, it } from "vitest";
import {
  countCustomTextLetters,
  hasLongCustomTextSingleWordLimitIssue,
  hasLongCustomTextWordLimitIssue,
  isCustomTextValid,
  sanitizeCustomTextInput,
} from "./quoteBuilderShared";

describe("custom text input rules", () => {
  it("counts all non-space characters as letters for long custom text", () => {
    expect(countCustomTextLetters("JOE 2026 !")).toBe(8);
  });

  it("limits long custom text to 14 non-space characters and 2 spaces", () => {
    expect(sanitizeCustomTextInput("sweet candy rocks extra", "long")).toBe("SWEET CANDY ROCK");
    expect(countCustomTextLetters(sanitizeCustomTextInput("sweet candy rocks extra", "long"))).toBe(14);
    expect(sanitizeCustomTextInput("ONE TWO THREE FOUR", "long").split(" ").length - 1).toBe(2);
  });

  it("keeps short custom text to 6 total characters including spaces", () => {
    expect(sanitizeCustomTextInput("A B C D", "short")).toBe("A B C ");
  });

  it("requires 3-word long custom text words to be 6 characters or fewer", () => {
    expect(isCustomTextValid("SWEET CANDY ROCK", "long")).toBe(true);
    expect(isCustomTextValid("SWEET CANDY LONGWORD", "long")).toBe(false);
  });

  it("stops extra characters on 6-character words in three-word long custom text", () => {
    expect(sanitizeCustomTextInput("A B CCCCCCC", "long")).toBe("A B CCCCCC");
    expect(hasLongCustomTextWordLimitIssue("A B CCCCCCC", "long")).toBe(true);
  });

  it("stops single-word long custom text after 10 characters", () => {
    expect(sanitizeCustomTextInput("ABCDEFGHIJK", "long")).toBe("ABCDEFGHIJ");
    expect(hasLongCustomTextSingleWordLimitIssue("ABCDEFGHIJK", "long")).toBe(true);
    expect(isCustomTextValid("ABCDEFGHIJK", "long")).toBe(false);
  });

  it("stops any long custom text word after 10 characters", () => {
    expect(sanitizeCustomTextInput("ABCDEFGHIJK OK", "long")).toBe("ABCDEFGHIJ OK");
    expect(hasLongCustomTextSingleWordLimitIssue("OK ABCDEFGHIJK", "long")).toBe(true);
    expect(isCustomTextValid("OK ABCDEFGHIJK", "long")).toBe(false);
  });
});
