import { tokenizeLine, TOKEN_COLOR } from "./syntaxHighlighter";

export const HighlightedScript = ({ text }: { text: string }) => {
  return (
    <>
      {text.split("\n").map((line, li) => (
        <span key={li} style={{ display: "block", minHeight: "1.8em" }}>
          {line === "---" ? (
            <span
              style={{
                color: TOKEN_COLOR.div,
                borderBottom: "1px solid #333748",
                display: "block",
              }}
            >
              {line || " "}
            </span>
          ) : (
            tokenizeLine(line).map((tk, ti) => (
              <span key={ti} style={{ color: TOKEN_COLOR[tk.t] }}>
                {tk.v}
              </span>
            ))
          )}
          {line.length === 0 && "\u00a0"}
        </span>
      ))}
    </>
  );
};
