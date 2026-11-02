// Runs src/utils/script.check.ts: bundled by esbuild (it comes with Vite), then run by Node.
import { build } from "esbuild";

const result = await build({
  entryPoints: ["src/utils/script.check.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
  logLevel: "error",
});
const code = result.outputFiles[0].text;
await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
