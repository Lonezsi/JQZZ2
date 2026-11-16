import React from "react";
import { dismissNotice, useNotice } from "../../utils/notice";
import { Keys } from "./Keys";
import { Glyph } from "./Glyph";

/**
 * The one notice (utils/notice.ts), at the foot of the screen: what happened,
 * and at most one thing to do about it. It slides up out of the bottom edge
 * and keeps one height, so a new notice replaces the text without a jump.
 */
export const NoticeBar: React.FC = () => {
  const notice = useNotice();
  if (!notice) return null;
  return (
    <div
      key={notice.n}
      className={`jqzz-notice${notice.error ? " error" : ""}`}
      role={notice.error ? "alert" : "status"}
    >
      <span className="jqzz-notice-text">{notice.text}</span>
      {notice.action && (
        <button
          type="button"
          className="jqzz-notice-act"
          onClick={() => {
            dismissNotice();
            notice.action!.run();
          }}
        >
          {notice.action.label}
          {notice.undo && <Keys combo="Z" />}
        </button>
      )}
      <button type="button" className="jqzz-notice-close" aria-label="close" onClick={dismissNotice}>
        <Glyph name="CLOSE" size={12} />
      </button>
    </div>
  );
};
