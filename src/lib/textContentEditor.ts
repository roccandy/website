export type TextContentIssue = {
  line: number;
  message: string;
};

export type TextContentRenderResult = {
  html: string;
  issues: TextContentIssue[];
};

function normalizeNewlines(value: string) {
  return value.replace(/\r\n?/g, "\n");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => {
      const parsed = Number.parseInt(code, 10);
      return Number.isFinite(parsed) ? String.fromCharCode(parsed) : _;
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => {
      const parsed = Number.parseInt(code, 16);
      return Number.isFinite(parsed) ? String.fromCharCode(parsed) : _;
    });
}

function sanitizeLinkHref(rawHref: string) {
  const href = rawHref.trim();
  if (!href) return null;

  if (/^(https?:\/\/|mailto:|tel:)/i.test(href)) {
    return href;
  }

  if (href.startsWith("/") || href.startsWith("#") || href.startsWith("?")) {
    return href;
  }

  if (/^[a-z0-9/_-]+(?:[?#][^\s]*)?$/i.test(href)) {
    return `/${href.replace(/^\/+/, "")}`;
  }

  return null;
}

function formatInlineWithoutLinks(value: string) {
  let output = "";
  let cursor = 0;
  const matches = [...value.matchAll(/\*\*([^*\n][\s\S]*?)\*\*/g)];

  for (const match of matches) {
    const [fullMatch, boldContent] = match;
    const start = match.index ?? 0;
    output += escapeHtml(value.slice(cursor, start));
    output += `<strong>${escapeHtml(boldContent)}</strong>`;
    cursor = start + fullMatch.length;
  }

  output += escapeHtml(value.slice(cursor));
  return output;
}

function formatInline(value: string, issues: TextContentIssue[], line: number, allowLinks = true): string {
  if (!allowLinks) {
    return formatInlineWithoutLinks(value);
  }

  let output = "";
  let cursor = 0;
  const matches = [...value.matchAll(/\[([^\]\n]+)\]\(([^)\n]+)\)/g)];

  for (const match of matches) {
    const [fullMatch, label, href] = match;
    const start = match.index ?? 0;
    output += formatInlineWithoutLinks(value.slice(cursor, start));

    const sanitizedHref = sanitizeLinkHref(href);
    if (!sanitizedHref) {
      issues.push({
        line,
        message: `Link destination "${href.trim()}" is not valid. Use /page-path, https://, mailto:, or tel:.`,
      });
      output += formatInlineWithoutLinks(label);
    } else {
      output += `<a href="${escapeAttribute(sanitizedHref)}">${formatInlineWithoutLinks(label)}</a>`;
    }

    cursor = start + fullMatch.length;
  }

  output += formatInlineWithoutLinks(value.slice(cursor));
  return output;
}

function parseParagraph(
  lines: string[],
  startIndex: number,
  issues: TextContentIssue[],
): { html: string; nextIndex: number } {
  const paragraphLines: string[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed) break;
    if (/^#{1,3}\s+/.test(trimmed)) break;
    if (/^[-*]\s+/.test(trimmed)) break;
    if (/^\d+\.\s+/.test(trimmed)) break;
    paragraphLines.push(line);
    index += 1;
  }

  const html = paragraphLines
    .map((line, offset) => formatInline(line.trim(), issues, startIndex + offset + 1))
    .join("<br />");

  return {
    html: `<p>${html}</p>`,
    nextIndex: index,
  };
}

function parseList(
  lines: string[],
  startIndex: number,
  issues: TextContentIssue[],
): { html: string; nextIndex: number } {
  const firstLine = lines[startIndex]?.trim() ?? "";
  const ordered = /^\d+\.\s+/.test(firstLine);
  const items: string[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed) break;

    const marker = ordered ? trimmed.match(/^\d+\.\s+(.*)$/) : trimmed.match(/^[-*]\s+(.*)$/);
    if (!marker) break;

    const itemLines = [marker[1]];
    let continuationIndex = index + 1;

    while (continuationIndex < lines.length) {
      const continuation = lines[continuationIndex];
      const continuationTrimmed = continuation.trim();
      if (!continuationTrimmed) break;
      if (/^#{1,3}\s+/.test(continuationTrimmed)) break;
      if (/^[-*]\s+/.test(continuationTrimmed)) break;
      if (/^\d+\.\s+/.test(continuationTrimmed)) break;
      itemLines.push(continuationTrimmed);
      continuationIndex += 1;
    }

    const itemHtml = itemLines
      .map((itemLine, offset) => formatInline(itemLine, issues, index + offset + 1))
      .join("<br />");
    items.push(`<li>${itemHtml}</li>`);
    index = continuationIndex;
  }

  return {
    html: `<${ordered ? "ol" : "ul"}>${items.join("")}</${ordered ? "ol" : "ul"}>`,
    nextIndex: index,
  };
}

export function renderTextContentToHtml(value: string): TextContentRenderResult {
  const normalized = normalizeNewlines(value).trim();
  if (!normalized) {
    return { html: "", issues: [] };
  }

  const issues: TextContentIssue[] = [];
  const blocks: string[] = [];
  const lines = normalized.split("\n");
  let index = 0;

  while (index < lines.length) {
    const rawLine = lines[index];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (/^#\s+/.test(trimmed)) {
      issues.push({
        line: index + 1,
        message: "H1 headings are not allowed here. Use H2 or H3 instead.",
      });
      blocks.push(`<p>${formatInline(trimmed, issues, index + 1)}</p>`);
      index += 1;
      continue;
    }

    if (/^###\s+/.test(trimmed)) {
      blocks.push(`<h3>${formatInline(trimmed.replace(/^###\s+/, ""), issues, index + 1)}</h3>`);
      index += 1;
      continue;
    }

    if (/^##\s+/.test(trimmed)) {
      blocks.push(`<h2>${formatInline(trimmed.replace(/^##\s+/, ""), issues, index + 1)}</h2>`);
      index += 1;
      continue;
    }

    if (/^[-*]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
      const list = parseList(lines, index, issues);
      blocks.push(list.html);
      index = list.nextIndex;
      continue;
    }

    const paragraph = parseParagraph(lines, index, issues);
    blocks.push(paragraph.html);
    index = paragraph.nextIndex;
  }

  return {
    html: blocks.join("\n"),
    issues,
  };
}

function stripUnsupportedTags(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
}

function inlineHtmlToText(value: string) {
  let output = value;

  output = output.replace(/<br\s*\/?>/gi, "\n");
  output = output.replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, inner) => `**${inlineHtmlToText(inner)}**`);
  output = output.replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, inner) => `*${inlineHtmlToText(inner)}*`);
  output = output.replace(
    /<a\b[^>]*href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi,
    (_, __, href, inner) => `[${inlineHtmlToText(inner)}](${decodeHtmlEntities(href).trim()})`,
  );
  output = output.replace(/<\/?(span|small|mark|code|u)\b[^>]*>/gi, "");
  output = output.replace(/<[^>]+>/g, "");

  return decodeHtmlEntities(output)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function listHtmlToText(innerHtml: string, ordered: boolean) {
  const items = [...innerHtml.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((match, index) => {
    const itemText = inlineHtmlToText(match[1])
      .split("\n")
      .map((line, lineIndex) => (lineIndex === 0 ? line : `  ${line}`))
      .join("\n");
    return `${ordered ? `${index + 1}.` : "-"} ${itemText}`;
  });

  if (items.length === 0) {
    return inlineHtmlToText(innerHtml);
  }

  return items.join("\n");
}

function blockHtmlToText(tag: string, innerHtml: string) {
  const normalizedTag = tag.toLowerCase();
  if (normalizedTag === "h2") {
    return `## ${inlineHtmlToText(innerHtml)}`;
  }
  if (normalizedTag === "h3") {
    return `### ${inlineHtmlToText(innerHtml)}`;
  }
  if (normalizedTag === "ul") {
    return listHtmlToText(innerHtml, false);
  }
  if (normalizedTag === "ol") {
    return listHtmlToText(innerHtml, true);
  }
  return inlineHtmlToText(innerHtml);
}

export function convertHtmlToTextContent(html: string) {
  const normalized = normalizeNewlines(stripUnsupportedTags(html)).trim();
  if (!normalized) return "";

  const blocks: string[] = [];
  let cursor = 0;

  for (const match of normalized.matchAll(/<(h2|h3|p|ul|ol)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const [fullMatch, tag, innerHtml] = match;
    const start = match.index ?? 0;
    const leadingText = inlineHtmlToText(normalized.slice(cursor, start));
    if (leadingText) {
      blocks.push(leadingText);
    }

    const blockText = blockHtmlToText(tag, innerHtml);
    if (blockText) {
      blocks.push(blockText);
    }

    cursor = start + fullMatch.length;
  }

  const trailingText = inlineHtmlToText(normalized.slice(cursor));
  if (trailingText) {
    blocks.push(trailingText);
  }

  return blocks
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
