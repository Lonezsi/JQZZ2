import React from "react";
import { useTheme } from "../../utils/theme";
import { Glyph } from "../common/Glyph";

/** How the app looks on this device. */
export const SettingsPanel: React.FC = () => {
  const { choice, theme, set } = useTheme();
  const dark = theme === "dark";
  return (
    <section className="jqzz-settings" aria-label="Settings">
      <div className="jqzz-setting">
        <span className="jqzz-setting-icon" aria-hidden="true">
          <Glyph name="MOON" size={16} />
        </span>
        <span className="jqzz-setting-text">
          <span className="jqzz-setting-name" id="setting-dark">
            dark mode
          </span>
          <span className="jqzz-annot">
            {choice === "system" ? "following your device" : "set on this device"}
          </span>
        </span>
        <button
          className={`jqzz-switch${dark ? " on" : ""}`}
          role="switch"
          aria-checked={dark}
          aria-labelledby="setting-dark"
          onClick={() => set(dark ? "light" : "dark")}
        >
          <span className="jqzz-switch-knob" />
        </button>
      </div>
      {choice !== "system" && (
        <button className="jqzz-play-btn small ghost jqzz-setting-reset" onClick={() => set("system")}>
          follow my device again
        </button>
      )}
    </section>
  );
};
