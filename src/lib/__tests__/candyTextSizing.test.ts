import { describe, expect, it } from "vitest";
import { shortCandyTextScale } from "../candyTextSizing";

describe("short candy text sizing", () => {
  it.each([["A",1.9],["AB",1.55],["WWW",1.55],["ABCD",1.3],["WWWWW",1.3],["ABCDEF",1],["ABCDEFG",1],["",1],[" A B ",1.55]])("scales %s by %s", (text,scale) => expect(shortCandyTextScale(String(text))).toBe(scale));
});
