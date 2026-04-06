import { describe, expect, it } from "vitest";
import { convertHtmlToTextContent, renderTextContentToHtml } from "@/lib/textContentEditor";

describe("textContentEditor", () => {
  it("renders headings, bold text, internal links, new lines, and lists into safe HTML", () => {
    const result = renderTextContentToHtml(`
## Personalised Wedding Candy

Create **beautiful** favours for your day.
Works across multiple lines.

- Bonbonniere
- Welcome gifts

Order from [our design page](/design/wedding-candy)
    `);

    expect(result.issues).toEqual([]);
    expect(result.html).toContain("<h2>Personalised Wedding Candy</h2>");
    expect(result.html).toContain("<strong>beautiful</strong>");
    expect(result.html).toContain("Create <strong>beautiful</strong> favours for your day.<br />Works across multiple lines.");
    expect(result.html).toContain("<ul><li>Bonbonniere</li><li>Welcome gifts</li></ul>");
    expect(result.html).toContain('<a href="/design/wedding-candy">our design page</a>');
  });

  it("rejects body H1 markup and unsafe links", () => {
    const result = renderTextContentToHtml(`
# Not allowed

Visit [this link](javascript:alert(1))
    `);

    expect(result.issues).toEqual([
      {
        line: 1,
        message: "H1 headings are not allowed here. Use H2 or H3 instead.",
      },
      {
        line: 3,
        message: 'Link destination "javascript:alert(1" is not valid. Use /page-path, https://, mailto:, or tel:.',
      },
    ]);
    expect(result.html).toContain("<p># Not allowed</p>");
    expect(result.html).toContain("<p>Visit this link)</p>");
  });

  it("converts the existing supported HTML subset back into editor text", () => {
    const text = convertHtmlToTextContent(`
<p><strong>Welcome</strong> to Roc Candy.</p>
<h2>Popular Uses</h2>
<ul>
  <li>Wedding favours</li>
  <li><a href="/contact">Corporate gifts</a></li>
</ul>
<p>Need help?<br />Contact us.</p>
    `);

    expect(text).toBe([
      "**Welcome** to Roc Candy.",
      "## Popular Uses",
      "- Wedding favours\n- [Corporate gifts](/contact)",
      "Need help?\nContact us.",
    ].join("\n\n"));
  });
});
