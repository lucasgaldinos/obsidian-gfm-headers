import esbuild from "esbuild";
import process from "process";

const prod = process.argv[2] === "production";

const context = await esbuild.context({
  entryPoints: ["main.ts"],
  bundle: true,
  platform: "browser",
  format: "cjs",
  target: "es2020",
  external: [
    "obsidian",
    "@codemirror/view",
    "@codemirror/state",
    "@codemirror/language",
    "@lezer/common",
    "@lezer/lr",
    "@lezer/highlight",
  ],
  outfile: "main.js",
  logLevel: "info",
  minify: prod,
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  define: {
    'DEBUG_ENABLED': prod ? 'false' : 'true',
  }
});

if (prod) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
}
