// Runs src/utils/script.check.ts: bundled by esbuild (it comes with Vite), then run by Node.
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";

/** Vite's "?raw": the file's text as the module's default export (the game modes are read this way) */
const raw = {
  name: "raw",
  setup(b) {
    b.onResolve({ filter: /\?raw$/ }, (args) => ({
      path: resolve(args.resolveDir, args.path.slice(0, -"?raw".length)),
      namespace: "raw",
    }));
    b.onLoad({ filter: /.*/, namespace: "raw" }, async (args) => ({
      contents: `export default ${JSON.stringify(await readFile(args.path, "utf8"))};`,
      loader: "js",
    }));
  },
};

const result = await build({
  entryPoints: ["src/utils/script.check.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
  logLevel: "error",
  plugins: [raw],
});
const code = result.outputFiles[0].text;
await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
