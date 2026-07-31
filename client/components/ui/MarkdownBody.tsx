'use client';

import type { ReactNode } from 'react';

type Props = {
  text: string;
  className?: string;
};

/** Lightweight markdown → React (bold/italic/code/links/lists/headings). No raw HTML. */
export function MarkdownBody({ text, className }: Props) {
  const blocks = splitBlocks(text ?? '');
  return (
    <div className={className ? `md-body ${className}` : 'md-body'}>
      {blocks.map((block, i) => renderBlock(block, i))}
    </div>
  );
}

type Block =
  | { type: 'code'; lang: string; body: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'quote'; text: string }
  | { type: 'p'; text: string };

function splitBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const out: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // fenced code
    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      const lang = fence[1] || '';
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1; // closing fence
      out.push({ type: 'code', lang, body: body.join('\n') });
      continue;
    }

    // blank
    if (!line.trim()) {
      i += 1;
      continue;
    }

    // heading
    const h = line.match(/^(#{1,3})\s+(.+)$/);
    if (h) {
      out.push({
        type: 'heading',
        level: h[1].length as 1 | 2 | 3,
        text: h[2].trim(),
      });
      i += 1;
      continue;
    }

    // quote
    if (/^>\s?/.test(line)) {
      const parts: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        parts.push(lines[i].replace(/^>\s?/, ''));
        i += 1;
      }
      out.push({ type: 'quote', text: parts.join('\n') });
      continue;
    }

    // unordered list
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ''));
        i += 1;
      }
      out.push({ type: 'ul', items });
      continue;
    }

    // ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i += 1;
      }
      out.push({ type: 'ol', items });
      continue;
    }

    // paragraph (consume until blank / special)
    const parts: string[] = [line];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^```/.test(lines[i]) &&
      !/^#{1,3}\s+/.test(lines[i]) &&
      !/^>\s?/.test(lines[i]) &&
      !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      parts.push(lines[i]);
      i += 1;
    }
    out.push({ type: 'p', text: parts.join('\n') });
  }

  return out;
}

function renderBlock(block: Block, key: number): ReactNode {
  switch (block.type) {
    case 'code':
      return (
        <pre key={key} className="md-pre" data-lang={block.lang || undefined}>
          <code>{block.body}</code>
        </pre>
      );
    case 'heading': {
      const Tag = (`h${block.level}` as 'h1' | 'h2' | 'h3');
      return (
        <Tag key={key} className={`md-h md-h${block.level}`}>
          {inline(block.text)}
        </Tag>
      );
    }
    case 'quote':
      return (
        <blockquote key={key} className="md-quote">
          {inline(block.text)}
        </blockquote>
      );
    case 'ul':
      return (
        <ul key={key} className="md-ul">
          {block.items.map((item, j) => (
            <li key={j}>{inline(item)}</li>
          ))}
        </ul>
      );
    case 'ol':
      return (
        <ol key={key} className="md-ol">
          {block.items.map((item, j) => (
            <li key={j}>{inline(item)}</li>
          ))}
        </ol>
      );
    case 'p':
      return (
        <p key={key} className="md-p">
          {inline(block.text)}
        </p>
      );
    default:
      return null;
  }
}

/** Inline: `code`, **bold**, *italic*, [links](url) — order matters. */
function inline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // code | bold | italic | link
  const re =
    /(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*]+\*)|(_[^_]+_)|(\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith('`')) {
      nodes.push(
        <code key={k++} className="md-code">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith('**') || token.startsWith('__')) {
      nodes.push(
        <strong key={k++}>{inline(token.slice(2, -2))}</strong>,
      );
    } else if (token.startsWith('*') || token.startsWith('_')) {
      nodes.push(<em key={k++}>{inline(token.slice(1, -1))}</em>);
    } else if (token.startsWith('[')) {
      const lm = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (lm && safeHref(lm[2])) {
        nodes.push(
          <a key={k++} href={lm[2]} target="_blank" rel="noreferrer" className="md-a">
            {lm[1]}
          </a>,
        );
      } else {
        nodes.push(token);
      }
    } else {
      nodes.push(token);
    }
    last = m.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function safeHref(href: string): boolean {
  return /^(https?:|mailto:)/i.test(href.trim());
}
