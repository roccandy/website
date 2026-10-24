import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { AdminNotice } from "./AdminNotice";

it("server-renders notices safely with a top-right fallback before the header host mounts", () => {
  const html = renderToStaticMarkup(<AdminNotice><p role="status">Order saved</p></AdminNotice>);
  expect(html).toContain("right-4 top-4");
  expect(html).toContain('role="status"');
  expect(html).toContain("Order saved");
  expect(html).not.toContain("bottom-");
});
