import React, { useRef } from "react";
import { SCRIPT_DOCS } from "../../../../utils/scriptDocs";

/**
 * The script's manual, beside the editor: the sections of scriptDocs.ts, set
 * out like an old man page. The list at the top jumps to a section; the body
 * scrolls by itself, so the editor never moves.
 */
export const ScriptDocs: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const body = useRef<HTMLDivElement>(null);
  const jump = (i: number) => {
    const scroller = body.current;
    const at = scroller?.querySelector<HTMLElement>(`#jqzz-docs-${i}`);
    if (scroller && at) scroller.scrollTo({ top: at.offsetTop - 8, behavior: "smooth" });
  };
  return (
    <aside className="jqzz-docs" aria-label="script manual">
      <div className="jqzz-docs-head">
        <span className="jqzz-annot">jqzz script · manual</span>
        <button type="button" className="jqzz-docs-hide" onClick={onClose} title="hide the manual">
          hide
        </button>
      </div>
      <nav className="jqzz-docs-toc" aria-label="sections">
        {SCRIPT_DOCS.map((s, i) => (
          <button key={s.name} type="button" onClick={() => jump(i)}>
            {s.name.toLowerCase()}
          </button>
        ))}
      </nav>
      <div className="jqzz-docs-body" ref={body}>
        {SCRIPT_DOCS.map((s, i) => (
          <section key={s.name} id={`jqzz-docs-${i}`} className="jqzz-docs-sec">
            <h3 className="jqzz-docs-name">{s.name}</h3>
            <pre className="jqzz-docs-text">{s.text}</pre>
          </section>
        ))}
      </div>
    </aside>
  );
};
