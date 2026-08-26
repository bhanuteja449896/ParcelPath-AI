/**
 * Markdown — lightweight, dependency-free renderer for assistant answers.
 * Supports: headings, bold/italic, inline code, links (http/https only),
 * fenced code, lists, simple tables, blockquotes, horizontal rules.
 * Raw HTML is never rendered (safety by construction).
 */
import { Fragment, type ReactNode } from "react";

// ── Inline parsing ───────────────────────────────────────────────────────────

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Token order matters: code → link → bold → italic
  const pattern =
    /(`[^`]+`)|(\[[^\]]+\]\((?:https?:\/\/)[^\s)]+\))|(\*\*[^*]+\*\*)|(\*[^*\n]+\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${i++}`;

    if (token.startsWith("`")) {
      nodes.push(
        <code
          key={key}
          className="rounded-md bg-surface-inset border border-line px-1.5 py-0.5 font-mono text-[0.85em] text-ink"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("[")) {
      const m = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/.exec(token)!;
      nodes.push(
        <a key={key} href={m[2]} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
          {m[1]}
        </a>
      );
    } else if (token.startsWith("**")) {
      nodes.push(
        <strong key={key} className="font-semibold text-ink">
          {token.slice(2, -2)}
        </strong>
      );
    } else {
      nodes.push(
        <em key={key} className="italic">
          {token.slice(1, -1)}
        </em>
      );
    }
    last = pattern.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

// ── Block parsing ────────────────────────────────────────────────────────────

function renderTable(rows: string[], keyPrefix: string): ReactNode {
  const parseRow = (line: string) =>
    line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
  const header = parseRow(rows[0]);
  const body = rows.slice(2).map(parseRow); // rows[1] is the |---|---| separator
  return (
    <div key={keyPrefix} className="my-3 overflow-hidden rounded-xl border border-line">
      <table className="w-full border-collapse text-left text-[13px]">
        <thead>
          <tr className="bg-surface-inset">
            {header.map((cell, ci) => (
              <th key={ci} className="border-b border-line px-3 py-2 font-semibold text-ink">
                {renderInline(cell, `${keyPrefix}-h${ci}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri} className="even:bg-surface-inset/50">
              {row.map((cell, ci) => (
                <td key={ci} className="border-b border-line/60 px-3 py-2 align-top text-ink-2 last:border-b-0">
                  {renderInline(cell, `${keyPrefix}-r${ri}c${ci}`)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Markdown({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushPara = () => {
    if (para.length === 0) return;
    blocks.push(
      <p key={`p-${blocks.length}`} className="whitespace-pre-wrap">
        {renderInline(para.join("\n"), `p${blocks.length}`)}
      </p>
    );
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    const L = list;
    blocks.push(
      L.ordered ? (
        <ol key={`l-${blocks.length}`} className="my-1.5 space-y-1 pl-5 list-decimal marker:text-ink-3">
          {L.items.map((item, ii) => (
            <li key={ii}>{renderInline(item, `l${blocks.length}-${ii}`)}</li>
          ))}
        </ol>
      ) : (
        <ul key={`l-${blocks.length}`} className="my-1.5 space-y-1 pl-5 list-disc marker:text-ink-3">
          {L.items.map((item, ii) => (
            <li key={ii}>{renderInline(item, `l${blocks.length}-${ii}`)}</li>
          ))}
        </ul>
      )
    );
    list = null;
  };

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];

    // Fenced code
    if (line.trimStart().startsWith("```")) {
      flushPara();
      flushList();
      const lang = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      li++;
      while (li < lines.length && !lines[li].trimStart().startsWith("```")) {
        codeLines.push(lines[li]);
        li++;
      }
      blocks.push(
        <pre
          key={`c-${blocks.length}`}
          className="my-3 overflow-x-auto rounded-xl border border-line bg-surface-inset p-3 font-mono text-[12.5px] leading-relaxed text-ink"
        >
          {lang && <div className="mb-1.5 text-[10px] uppercase tracking-wider text-ink-3">{lang}</div>}
          <code>{codeLines.join("\n")}</code>
        </pre>
      );
      continue;
    }

    // Table
    if (/^\s*\|.+\|\s*$/.test(line) && li + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[li + 1])) {
      flushPara();
      flushList();
      const tableRows: string[] = [line];
      li += 2;
      tableRows.push(lines[li - 1]);
      while (li < lines.length && /^\s*\|.+\|\s*$/.test(lines[li])) {
        tableRows.push(lines[li]);
        li++;
      }
      li--;
      blocks.push(renderTable(tableRows, `t-${blocks.length}`));
      continue;
    }

    // Headings
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      flushPara();
      flushList();
      const level = heading[1].length;
      const cls =
        level <= 2
          ? "mt-4 mb-1.5 text-[15px] font-semibold text-ink"
          : "mt-3 mb-1 text-sm font-semibold text-ink";
      blocks.push(
        <p key={`h-${blocks.length}`} className={`${cls} first:mt-0`}>
          {renderInline(heading[2], `h${blocks.length}`)}
        </p>
      );
      continue;
    }

    // Horizontal rule
    if (/^\s*(---+|\*\*\*+)\s*$/.test(line)) {
      flushPara();
      flushList();
      blocks.push(<hr key={`hr-${blocks.length}`} className="my-3 border-line" />);
      continue;
    }

    // Blockquote
    if (/^\s*>\s?/.test(line)) {
      flushPara();
      flushList();
      const quote: string[] = [];
      while (li < lines.length && /^\s*>\s?/.test(lines[li])) {
        quote.push(lines[li].replace(/^\s*>\s?/, ""));
        li++;
      }
      li--;
      blocks.push(
        <blockquote
          key={`q-${blocks.length}`}
          className="my-2.5 border-l-2 border-brand/40 bg-brand-soft/50 px-3.5 py-2 text-[13.5px] text-ink-2"
        >
          {renderInline(quote.join("\n"), `q${blocks.length}`)}
        </blockquote>
      );
      continue;
    }

    // Lists
    const ulMatch = /^\s*[-*•]\s+(.*)$/.exec(line);
    const olMatch = /^\s*(\d+)[.)]\s+(.*)$/.exec(line);
    if (ulMatch || olMatch) {
      flushPara();
      const ordered = Boolean(olMatch);
      const itemText = ordered ? olMatch![2] : ulMatch![1];
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push(itemText);
      continue;
    }

    // Blank line
    if (line.trim() === "") {
      flushPara();
      flushList();
      continue;
    }

    // Paragraph text
    flushList();
    para.push(line);
  }

  flushPara();
  flushList();

  return (
    <div className="text-[14px] leading-relaxed text-ink-2 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      {blocks.map((b, i) => (
        <Fragment key={i}>{b}</Fragment>
      ))}
    </div>
  );
}
