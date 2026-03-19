export type HToken = {
  t:
    | "comment"
    | "kw"
    | "fn"
    | "str"
    | "num"
    | "key"
    | "punc"
    | "div"
    | "plain"
    | "ws";
  v: string;
};

export function tokenizeLine(line: string): HToken[] {
  const trimmed = line.trimStart();
  if (trimmed.startsWith("#")) return [{ t: "comment", v: line }];
  if (line.trim() === "---") return [{ t: "div", v: line }];

  const tokens: HToken[] = [];
  let rem = line;

  const eat = (re: RegExp, t: HToken["t"]): boolean => {
    const m = rem.match(re);
    if (!m || m.index !== 0) return false;
    tokens.push({ t, v: m[0] });
    rem = rem.slice(m[0].length);
    return true;
  };

  while (rem.length > 0) {
    if (eat(/^(NewQuestion|Show\w+)\b/, "kw")) continue;
    if (eat(/^Q\d+\b/, "fn")) continue;
    if (eat(/^"[^"]*"/, "str")) continue;
    if (eat(/^-?\d+/, "num")) continue;
    if (
      eat(/^(time|type|prompt|elaboration|answers|text|value)(?=\s*:)/, "key")
    )
      continue;
    if (eat(/^[(),:[\]{}]/, "punc")) continue;
    if (eat(/^\s+/, "ws")) continue;
    if (eat(/^[^\s"(),:[\]{}]+/, "plain")) continue;
    tokens.push({ t: "plain", v: rem[0] });
    rem = rem.slice(1);
  }
  return tokens;
}

export const TOKEN_COLOR: Record<HToken["t"], string> = {
  comment: "#444c6a",
  kw: "#c792ea",
  fn: "#82aaff",
  str: "#c3e88d",
  num: "#f78c6c",
  key: "#89ddff",
  punc: "#8890ab",
  div: "#333748",
  plain: "#dde1f0",
  ws: "transparent",
};
