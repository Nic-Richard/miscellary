// Card descriptions allow a deliberately tiny Markdown subset:
// **bold**, *italic*, "- " bullet lines, and line breaks. Everything else is
// treated as literal text. The API enforces the same rules in
// apps/api/cards/markdown.py so a description renders identically everywhere.

export const DESCRIPTION_MAX_LENGTH = 600;

const HEADING = /^\s{0,3}#{1,6}\s/m;
const LINK_OR_IMAGE = /!?\[[^\]]*\]\([^)]*\)/;
const HTML_TAG = /<\/?[a-z][\s\S]*?>/i;
const CODE = /`/;

export type MarkdownIssue = 'too_long' | 'heading' | 'link' | 'html' | 'code';

export function validateDescription(text: string): MarkdownIssue[] {
  const issues: MarkdownIssue[] = [];
  if (text.length > DESCRIPTION_MAX_LENGTH) issues.push('too_long');
  if (HEADING.test(text)) issues.push('heading');
  if (LINK_OR_IMAGE.test(text)) issues.push('link');
  if (HTML_TAG.test(text)) issues.push('html');
  if (CODE.test(text)) issues.push('code');
  return issues;
}

export type DescriptionNode =
  | { type: 'text'; value: string }
  | { type: 'bold'; value: string }
  | { type: 'italic'; value: string }
  | { type: 'break' };

export type DescriptionBlock =
  { type: 'paragraph'; children: DescriptionNode[] } | { type: 'list'; items: DescriptionNode[][] };

function parseInline(line: string): DescriptionNode[] {
  const nodes: DescriptionNode[] = [];
  const pattern = /(\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
  let last = 0;
  for (const match of line.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) nodes.push({ type: 'text', value: line.slice(last, index) });
    if (match[2] !== undefined) nodes.push({ type: 'bold', value: match[2] });
    else if (match[3] !== undefined) nodes.push({ type: 'italic', value: match[3] });
    last = index + match[0].length;
  }
  if (last < line.length) nodes.push({ type: 'text', value: line.slice(last) });
  return nodes;
}

export function parseDescription(text: string): DescriptionBlock[] {
  const blocks: DescriptionBlock[] = [];
  let paragraph: DescriptionNode[] = [];
  let list: DescriptionNode[][] = [];

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: 'paragraph', children: paragraph });
    paragraph = [];
  };
  const flushList = () => {
    if (list.length) blocks.push({ type: 'list', items: list });
    list = [];
  };

  for (const rawLine of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = rawLine.trimEnd();
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      flushParagraph();
      list.push(parseInline(bullet[1] ?? ''));
      continue;
    }
    flushList();
    if (line.trim() === '') {
      flushParagraph();
      continue;
    }
    if (paragraph.length) paragraph.push({ type: 'break' });
    paragraph.push(...parseInline(line));
  }
  flushParagraph();
  flushList();
  return blocks;
}
