import React, { useState } from "react";
import { SnippetTray } from "./SnippetTray";

interface AddButtonProps {
  dropOver: boolean;
  onDropZoneDragOver: (e: React.DragEvent<HTMLElement>) => void;
  onDropZoneDragLeave: () => void;
  onDropZoneDrop: (e: React.DragEvent<HTMLElement>) => void;
  onPick: (snippetId: string) => void;
}

/** End of the timeline: opens the snippet tray in place, or takes a drop. */
export const AddButton: React.FC<AddButtonProps> = ({
  dropOver,
  onDropZoneDragOver,
  onDropZoneDragLeave,
  onDropZoneDrop,
  onPick,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={`jqzz-add${open ? " open" : ""}${dropOver ? " over" : ""}`}
      onDragOver={onDropZoneDragOver}
      onDragLeave={onDropZoneDragLeave}
      onDrop={onDropZoneDrop}
    >
      <button
        className="jqzz-add-btn"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {/* drawn with two bars so it turns into an x around its true centre */}
        <span className="jqzz-add-plus jqzz-plus" aria-hidden="true" />
        {dropOver ? "let go to add it" : open ? "pick one, it goes at the end" : "add"}
      </button>
      <div className="jqzz-add-tray" inert={!open}>
        <div className="jqzz-add-tray-inner">
          <SnippetTray onPick={onPick} />
        </div>
      </div>
    </div>
  );
};
