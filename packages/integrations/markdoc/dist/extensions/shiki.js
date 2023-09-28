import Markdoc from "@markdoc/markdoc";
import { unescapeHTML } from "astro/runtime/server/index.js";
import { getHighlighter } from "shiki";
const ASTRO_COLOR_REPLACEMENTS = {
  "#000001": "var(--astro-code-color-text)",
  "#000002": "var(--astro-code-color-background)",
  "#000004": "var(--astro-code-token-constant)",
  "#000005": "var(--astro-code-token-string)",
  "#000006": "var(--astro-code-token-comment)",
  "#000007": "var(--astro-code-token-keyword)",
  "#000008": "var(--astro-code-token-parameter)",
  "#000009": "var(--astro-code-token-function)",
  "#000010": "var(--astro-code-token-string-expression)",
  "#000011": "var(--astro-code-token-punctuation)",
  "#000012": "var(--astro-code-token-link)"
};
const PRE_SELECTOR = /<pre class="(.*?)shiki(.*?)"/;
const LINE_SELECTOR = /<span class="line"><span style="(.*?)">([\+|\-])/g;
const INLINE_STYLE_SELECTOR = /style="(.*?)"/;
const highlighterCache = /* @__PURE__ */ new Map();
async function shiki({
  langs = [],
  theme = "github-dark",
  wrap = false
} = {}) {
  const cacheID = typeof theme === "string" ? theme : theme.name;
  if (!highlighterCache.has(cacheID)) {
    highlighterCache.set(
      cacheID,
      await getHighlighter({ theme }).then((hl) => {
        hl.setColorReplacements(ASTRO_COLOR_REPLACEMENTS);
        return hl;
      })
    );
  }
  const highlighter = highlighterCache.get(cacheID);
  for (const lang of langs) {
    await highlighter.loadLanguage(lang);
  }
  return {
    nodes: {
      fence: {
        attributes: Markdoc.nodes.fence.attributes,
        transform({ attributes }) {
          let lang;
          if (typeof attributes.language === "string") {
            const langExists = highlighter.getLoadedLanguages().includes(attributes.language);
            if (langExists) {
              lang = attributes.language;
            } else {
              console.warn(
                `[Shiki highlighter] The language "${attributes.language}" doesn't exist, falling back to plaintext.`
              );
              lang = "plaintext";
            }
          } else {
            lang = "plaintext";
          }
          let html = highlighter.codeToHtml(attributes.content, { lang });
          html = html.replace(PRE_SELECTOR, `<pre class="$1astro-code$2"`);
          if (attributes.language === "diff") {
            html = html.replace(
              LINE_SELECTOR,
              '<span class="line"><span style="$1"><span style="user-select: none;">$2</span>'
            );
          }
          if (wrap === false) {
            html = html.replace(INLINE_STYLE_SELECTOR, 'style="$1; overflow-x: auto;"');
          } else if (wrap === true) {
            html = html.replace(
              INLINE_STYLE_SELECTOR,
              'style="$1; overflow-x: auto; white-space: pre-wrap; word-wrap: break-word;"'
            );
          }
          return unescapeHTML(html);
        }
      }
    }
  };
}
export {
  shiki as default
};
