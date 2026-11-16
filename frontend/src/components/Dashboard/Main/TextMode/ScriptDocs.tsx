import React, { useRef, useState } from "react";
import { SCRIPT_DOCS, type DocBlock } from "../../../../utils/scriptDocs";
import { HighlightedScript } from "../../../../utils/syntaxHighlighterScript";

/** prose with `code` in it: the backticked parts set as code */
const Prose: React.FC<{ text: string }> = ({ text }) => (
  <>
    {text.split(/(`[^`]+`)/).map((part, i) =>
      part.startsWith("`") && part.endsWith("`") && part.length > 1 ? (
        <code key={i} className="jqzz-docs-inline">
          {part.slice(1, -1)}
        </code>
      ) : (
        part
      ),
    )}
  </>
);

const Block: React.FC<{ b: DocBlock }> = ({ b }) => {
  if ("p" in b)
    return (
      <p className="jqzz-docs-p">
        <Prose text={b.p} />
      </p>
    );
  if ("note" in b)
    return (
      <aside className="jqzz-docs-note">
        <span className="jqzz-annot">note</span>
        <span>
          <Prose text={b.note} />
        </span>
      </aside>
    );
  if ("code" in b)
    return (
      <pre className="jqzz-docs-code">
        <HighlightedScript text={b.code} hints={false} />
      </pre>
    );
  if ("grammar" in b)
    return <pre className="jqzz-docs-grammar">{b.grammar}</pre>;
  if ("list" in b)
    return (
      <ul className="jqzz-docs-list">
        {b.list.map((item, i) => (
          <li key={i}>
            <Prose text={item} />
          </li>
        ))}
      </ul>
    );
  return (
    <div className="jqzz-docs-table">
      <table>
        <thead>
          <tr>
            {b.table.head.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {b.table.rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td key={c}>
                  {c === 0 ? (
                    <code className="jqzz-docs-inline">{cell}</code>
                  ) : (
                    <Prose text={cell} />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/**
 * The language reference, beside the editor: the sections of scriptDocs.ts,
 * numbered, with a contents list that jumps to each. Examples are coloured
 * the way the editor colours them. The body scrolls by itself, so the editor
 * never moves.
 */
export const ScriptDocs: React.FC<{ width: number | null }> = ({ width }) => {
  const body = useRef<HTMLDivElement>(null);
  // on a narrow screen the contents fold into one row, so the reference has room to be read
  const [tocOpen, setTocOpen] = useState(false);
  const jump = (id: string) => {
    const scroller = body.current;
    const at = scroller?.querySelector<HTMLElement>(`#jqzz-docs-${id}`);
    if (scroller && at) scroller.scrollTo({ top: at.offsetTop - 8, behavior: "smooth" });
    setTocOpen(false);
  };
  return (
    <aside
      className="jqzz-docs"
      aria-label="language reference"
      style={width ? ({ "--docs-w": `${width}px` } as React.CSSProperties) : undefined}
    >
      <div className="jqzz-docs-head">
        <div>
          <div className="jqzz-docs-title">JQzz Script</div>
          <span className="jqzz-annot">language reference · version 3</span>
        </div>
        <button
          type="button"
          className="jqzz-docs-contents"
          aria-expanded={tocOpen}
          aria-controls="jqzz-docs-toc"
          onClick={() => setTocOpen((o) => !o)}
        >
          contents
        </button>
      </div>
      <nav id="jqzz-docs-toc" className={`jqzz-docs-toc${tocOpen ? " open" : ""}`} aria-label="contents">
        {SCRIPT_DOCS.map((s, i) => (
          <button key={s.id} type="button" onClick={() => jump(s.id)}>
            <span className="jqzz-docs-num">{i + 1}</span> {s.title}
          </button>
        ))}
      </nav>
      <div className="jqzz-docs-body" ref={body}>
        {SCRIPT_DOCS.map((s, i) => (
          <section
            key={s.id}
            id={`jqzz-docs-${s.id}`}
            className="jqzz-docs-sec"
          >
            <h3 className="jqzz-docs-name">
              <span className="jqzz-docs-num">{i + 1}</span> {s.title}
            </h3>
            {s.blocks.map((b, j) => (
              <Block key={j} b={b} />
            ))}
          </section>
        ))}
      </div>
    </aside>
  );
};
