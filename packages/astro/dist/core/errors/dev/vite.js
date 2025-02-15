import * as fs from "node:fs";
import { fileURLToPath } from "node:url";
import { getHighlighter } from "shiki";
import { FailedToLoadModuleSSR, InvalidGlob, MdxIntegrationMissingError } from "../errors-data.js";
import { AstroError } from "../errors.js";
import { createSafeError } from "../utils.js";
import { getDocsForError, renderErrorMarkdown } from "./utils.js";
function enhanceViteSSRError({
  error,
  filePath,
  loader,
  renderers
}) {
  let safeError = createSafeError(error);
  if (loader) {
    try {
      loader.fixStacktrace(safeError);
    } catch {
    }
  }
  if (filePath) {
    const path = fileURLToPath(filePath);
    const content = fs.readFileSync(path).toString();
    const lns = content.split("\n");
    let importName;
    if (importName = safeError.message.match(/Failed to load url (.*?) \(resolved id:/)?.[1]) {
      safeError.title = FailedToLoadModuleSSR.title;
      safeError.name = "FailedToLoadModuleSSR";
      safeError.message = FailedToLoadModuleSSR.message(importName);
      safeError.hint = FailedToLoadModuleSSR.hint;
      const line = lns.findIndex((ln) => ln.includes(importName));
      if (line !== -1) {
        const column = lns[line]?.indexOf(importName);
        safeError.loc = {
          file: path,
          line: line + 1,
          column
        };
      }
    }
    const fileId = safeError.id ?? safeError.loc?.file;
    if (!renderers?.find((r) => r.name === "@astrojs/mdx") && safeError.message.match(/Syntax error/) && fileId?.match(/\.mdx$/)) {
      safeError = new AstroError({
        ...MdxIntegrationMissingError,
        message: MdxIntegrationMissingError.message(JSON.stringify(fileId)),
        location: safeError.loc,
        stack: safeError.stack
      });
    }
    if (/Invalid glob/.test(safeError.message)) {
      const globPattern = safeError.message.match(/glob: "(.+)" \(/)?.[1];
      if (globPattern) {
        safeError.message = InvalidGlob.message(globPattern);
        safeError.name = "InvalidGlob";
        safeError.hint = InvalidGlob.hint;
        safeError.title = InvalidGlob.title;
        const line = lns.findIndex((ln) => ln.includes(globPattern));
        if (line !== -1) {
          const column = lns[line]?.indexOf(globPattern);
          safeError.loc = {
            file: path,
            line: line + 1,
            column
          };
        }
      }
    }
  }
  return safeError;
}
const ALTERNATIVE_JS_EXTS = ["cjs", "mjs"];
const ALTERNATIVE_MD_EXTS = ["mdoc"];
async function getViteErrorPayload(err) {
  let plugin = err.plugin;
  if (!plugin && err.hint) {
    plugin = "astro";
  }
  const message = renderErrorMarkdown(err.message.trim(), "html");
  const hint = err.hint ? renderErrorMarkdown(err.hint.trim(), "html") : void 0;
  const docslink = getDocsForError(err);
  const highlighter = await getHighlighter({ theme: "css-variables" });
  let highlighterLang = err.loc?.file?.split(".").pop();
  if (ALTERNATIVE_JS_EXTS.includes(highlighterLang ?? "")) {
    highlighterLang = "js";
  }
  if (ALTERNATIVE_MD_EXTS.includes(highlighterLang ?? "")) {
    highlighterLang = "md";
  }
  const highlightedCode = err.fullCode ? highlighter.codeToHtml(err.fullCode, {
    lang: highlighterLang,
    lineOptions: err.loc?.line ? [{ line: err.loc.line, classes: ["error-line"] }] : void 0
  }) : void 0;
  return {
    type: "error",
    err: {
      ...err,
      name: err.name,
      type: err.type,
      message,
      hint,
      frame: err.frame,
      highlightedCode,
      docslink,
      loc: {
        file: err.loc?.file,
        line: err.loc?.line,
        column: err.loc?.column
      },
      plugin,
      stack: err.stack,
      cause: err.cause
    }
  };
}
export {
  enhanceViteSSRError,
  getViteErrorPayload
};
