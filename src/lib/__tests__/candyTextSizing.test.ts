import { describe, expect, it } from "vitest";
import { shortCandyTextScale } from "../candyTextSizing";

describe("short candy text sizing", () => {
  it.each([["A",1.7],["AB",1.4],["WWW",1.4],["ABCD",1.2],["WWWWW",1.2],["ABCDEF",1],["ABCDEFG",1],["",1],[" A B ",1.4]])("scales %s by %s", (text,scale) => expect(shortCandyTextScale(String(text))).toBe(scale));
});
