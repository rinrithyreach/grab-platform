/**
 * Test helper: compiles the given lib/*.ts files to JavaScript in a temp folder
 * (fixing up their "./x" imports) and imports the first one.
 * Store tests can supply a fake window; React is resolved from this project.
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

export async function loadLib(...names) {
  const dir = await mkdtemp(join(tmpdir(), "lib-test-"));
  for (const name of names) {
    const source = await readFile(new URL(`../lib/${name}.ts`, import.meta.url), "utf8");
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, verbatimModuleSyntax: false },
    });
    const reactUrl = pathToFileURL(createRequire(import.meta.url).resolve("react")).href;
    await writeFile(join(dir, `${name}.mjs`), outputText.replace(/from "\.\/([\w-]+)"/g, 'from "./$1.mjs"').replaceAll('from "react"', `from "${reactUrl}"`));
  }
  return import(pathToFileURL(join(dir, `${names[0]}.mjs`)).href);
}
