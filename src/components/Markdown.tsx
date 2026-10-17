// Minimal renderer for assistant replies: paragraphs, "- " bullets, **bold**, and [Source: ...] chips.
import { Fragment, type ReactNode } from "react";

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\[Source:\s*([^\]]+)\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(<Fragment key={`${key}-t${i++}`}>{text.slice(last, m.index)}</Fragment>);
    if (m[1]) out.push(<b key={`${key}-b${i++}`}>{m[1]}</b>);
    else out.push(<span className="src" key={`${key}-s${i++}`}>{m[2].trim()}</span>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(<Fragment key={`${key}-t${i++}`}>{text.slice(last)}</Fragment>);
  return out;
}

export function Markdown({ text }: { text: string }) {
  const blocks = text.replace(/\r/g, "").split(/\n{2,}/);
  return (
    <>
      {blocks.map((block, bi) => {
        const lines = block.split("\n").filter((l) => l.trim());
        const bullets = lines.filter((l) => /^\s*[-*•]\s+/.test(l));
        if (bullets.length && bullets.length === lines.length) {
          return (
            <ul key={bi}>
              {lines.map((l, li) => (
                <li key={li}>{inline(l.replace(/^\s*[-*•]\s+/, ""), `${bi}-${li}`)}</li>
              ))}
            </ul>
          );
        }
        if (bullets.length) {
          // a lead-in sentence followed by bullets
          const head = lines.filter((l) => !/^\s*[-*•]\s+/.test(l));
          return (
            <Fragment key={bi}>
              <p>{inline(head.join(" "), `${bi}-h`)}</p>
              <ul>
                {bullets.map((l, li) => (
                  <li key={li}>{inline(l.replace(/^\s*[-*•]\s+/, ""), `${bi}-${li}`)}</li>
                ))}
              </ul>
            </Fragment>
          );
        }
        return <p key={bi}>{inline(lines.join(" ").replace(/^#+\s*/, ""), `${bi}`)}</p>;
      })}
    </>
  );
}
