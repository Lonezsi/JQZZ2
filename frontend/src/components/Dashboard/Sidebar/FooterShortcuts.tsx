import React from "react";

export const FooterShortcuts: React.FC = () => {
  const shortcuts: [string, string][] = [
    ["New quiz", "^N"],
    ["Import", "^I"],
    ["Start", "^↵"],
    ["Palette", "^K"],
  ];

  return (
    <div className="jqzz-sid-footer">
      {shortcuts.map(([label, key]) => (
        <div key={label} className="jqzz-shortcut-row">
          <span>{label}</span>
          <span className="jqzz-kbd">{key}</span>
        </div>
      ))}
    </div>
  );
};
