import React from "react";
import type { EditorMode } from "../../../types";

interface ToolbarProps {
  mode: EditorMode;
  setMode: (mode: EditorMode) => void;
  onOpenPalette: () => void;
  onExport: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  mode,
  setMode,
  onOpenPalette,
  onExport,
}) => {
  return (
    <div className="jqzz-toolbar">
      <div className="jqzz-tab-group">
        <button
          className={`jqzz-tab${mode === "visual" ? " active" : ""}`}
          onClick={() => setMode("visual")}
        >
          ■ Visual
        </button>
        <button
          className={`jqzz-tab${mode === "text" ? " active" : ""}`}
          onClick={() => setMode("text")}
        >
          {"</>"} Text Mode
        </button>
      </div>
      <div className="jqzz-spacer" />
      <button className="jqzz-toolbar-btn" onClick={onOpenPalette}>
        ⌘ Palette
      </button>
      <button className="jqzz-toolbar-btn" onClick={onExport}>
        ↓ Export
      </button>
      <button
        className="jqzz-toolbar-btn run"
        onClick={() => alert("Starting quiz...")}
      >
        ▶ Start
      </button>
    </div>
  );
};
