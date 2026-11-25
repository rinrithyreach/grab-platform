/**
 * Test helper: compiles the given lib/*.ts(x) files to JavaScript in a temp folder
 * (fixing up their "./x" imports) and imports the first one.
 * Store tests can supply a fake window; React and React DOM are resolved from this project.
 * This helper does not render components or simulate browser layout.
 *
 *   const pricing = await loadLib("pricing", "catalog", "brand", "hours");
 */
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import ts from "typescript";

async function compileLibs(names) {
  const dir = await mkdtemp(join(tmpdir(), "lib-test-"));
  const dependencies = names.includes("pricing") || names.includes("cart") ? ["promotion-rules"] : [];
  if (names.some(name => ["cart", "express", "payments", "reviews", "wallet"].includes(name))) dependencies.push("record-id");
  for (const name of new Set([...names, ...dependencies])) {
    const source = await readFile(new URL(`../lib/${name}.ts`, import.meta.url), "utf8").catch((err) => {
      if (err.code !== "ENOENT") throw err;
      return readFile(new URL(`../lib/${name}.tsx`, import.meta.url), "utf8");
    });
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, verbatimModuleSyntax: false },
    });
    const require = createRequire(import.meta.url);
    await writeFile(join(dir, `${name}.mjs`), outputText
      .replace(/from "\.\/([\w-]+)"/g, 'from "./$1.mjs"')
      .replace(/from "(react(?:\/jsx-runtime)?|react-dom)"/g, (_, name) => `from "${pathToFileURL(require.resolve(name)).href}"`));
  }
  return dir;
}

export async function loadLib(...names) {
  const dir = await compileLibs(names);
  return import(pathToFileURL(join(dir, `${names[0]}.mjs`)).href);
}

export async function loadLibGroup(...names) {
  const dir = await compileLibs(names);
  return Object.fromEntries(await Promise.all(names.map(async (name) => [name, await import(pathToFileURL(join(dir, `${name}.mjs`)).href)])));
}
