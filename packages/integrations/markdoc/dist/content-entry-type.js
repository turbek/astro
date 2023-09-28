import Markdoc from "@markdoc/markdoc";
import { emitESMImage } from "astro/assets/utils";
import matter from "gray-matter";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { htmlTokenTransform } from "./html/transform/html-token-transform.js";
import { setupConfig } from "./runtime.js";
import { getMarkdocTokenizer } from "./tokenizer.js";
import { MarkdocError, isComponentConfig, isValidUrl, prependForwardSlash } from "./utils.js";
async function getContentEntryType({
  markdocConfigResult,
  astroConfig,
  options
}) {
  return {
    extensions: [".mdoc"],
    getEntryInfo,
    handlePropagation: true,
    async getRenderModule({ contents, fileUrl, viteId }) {
      const entry = getEntryInfo({ contents, fileUrl });
      const tokenizer = getMarkdocTokenizer(options);
      let tokens = tokenizer.tokenize(entry.body);
      if (options?.allowHTML) {
        tokens = htmlTokenTransform(tokenizer, tokens);
      }
      const ast = Markdoc.parse(tokens);
      const usedTags = getUsedTags(ast);
      const userMarkdocConfig = markdocConfigResult?.config ?? {};
      const markdocConfigUrl = markdocConfigResult?.fileUrl;
      let componentConfigByTagMap = {};
      for (const tag of usedTags) {
        const render = userMarkdocConfig.tags?.[tag]?.render;
        if (isComponentConfig(render)) {
          componentConfigByTagMap[tag] = render;
        }
      }
      let componentConfigByNodeMap = {};
      for (const [nodeType, schema] of Object.entries(userMarkdocConfig.nodes ?? {})) {
        const render = schema?.render;
        if (isComponentConfig(render)) {
          componentConfigByNodeMap[nodeType] = render;
        }
      }
      const pluginContext = this;
      const markdocConfig = await setupConfig(userMarkdocConfig, options);
      const filePath = fileURLToPath(fileUrl);
      const validationErrors = Markdoc.validate(
        ast,
        /* Raised generics issue with Markdoc core https://github.com/markdoc/markdoc/discussions/400 */
        markdocConfig
      ).filter((e) => {
        return (
          // Ignore `variable-undefined` errors.
          // Variables can be configured at runtime,
          // so we cannot validate them at build time.
          e.error.id !== "variable-undefined" && (e.error.level === "error" || e.error.level === "critical")
        );
      });
      if (validationErrors.length) {
        const frontmatterBlockOffset = entry.rawData.split("\n").length + 2;
        const rootRelativePath = path.relative(fileURLToPath(astroConfig.root), filePath);
        throw new MarkdocError({
          message: [
            `**${String(rootRelativePath)}** contains invalid content:`,
            ...validationErrors.map((e) => `- ${e.error.message}`)
          ].join("\n"),
          location: {
            // Error overlay does not support multi-line or ranges.
            // Just point to the first line.
            line: frontmatterBlockOffset + validationErrors[0].lines[0],
            file: viteId
          }
        });
      }
      await emitOptimizedImages(ast.children, {
        astroConfig,
        pluginContext,
        filePath
      });
      const res = `import { Renderer } from '@astrojs/markdoc/components';
import { createGetHeadings, createContentComponent } from '@astrojs/markdoc/runtime';
${markdocConfigUrl ? `import markdocConfig from ${JSON.stringify(markdocConfigUrl.pathname)};` : "const markdocConfig = {};"}

import { assetsConfig } from '@astrojs/markdoc/runtime-assets-config';
markdocConfig.nodes = { ...assetsConfig.nodes, ...markdocConfig.nodes };

${getStringifiedImports(componentConfigByTagMap, "Tag", astroConfig.root)}
${getStringifiedImports(componentConfigByNodeMap, "Node", astroConfig.root)}

const tagComponentMap = ${getStringifiedMap(componentConfigByTagMap, "Tag")};
const nodeComponentMap = ${getStringifiedMap(componentConfigByNodeMap, "Node")};

const options = ${JSON.stringify(options)};

const stringifiedAst = ${JSON.stringify(
        /* Double stringify to encode *as* stringified JSON */
        JSON.stringify(ast)
      )};

export const getHeadings = createGetHeadings(stringifiedAst, markdocConfig, options);
export const Content = createContentComponent(
	Renderer,
	stringifiedAst,
	markdocConfig,
  options,
	tagComponentMap,
	nodeComponentMap,
)`;
      return { code: res };
    },
    contentModuleTypes: await fs.promises.readFile(
      new URL("../template/content-module-types.d.ts", import.meta.url),
      "utf-8"
    )
  };
}
function getUsedTags(markdocAst) {
  const tags = /* @__PURE__ */ new Set();
  const validationErrors = Markdoc.validate(markdocAst);
  for (const { error } of validationErrors) {
    if (error.id === "tag-undefined") {
      const [, tagName] = error.message.match(/Undefined tag: '(.*)'/) ?? [];
      tags.add(tagName);
    }
  }
  return tags;
}
function getEntryInfo({ fileUrl, contents }) {
  const parsed = parseFrontmatter(contents, fileURLToPath(fileUrl));
  return {
    data: parsed.data,
    body: parsed.content,
    slug: parsed.data.slug,
    rawData: parsed.matter
  };
}
async function emitOptimizedImages(nodeChildren, ctx) {
  for (const node of nodeChildren) {
    if (node.type === "image" && typeof node.attributes.src === "string" && shouldOptimizeImage(node.attributes.src)) {
      const resolved = await ctx.pluginContext.resolve(node.attributes.src, ctx.filePath);
      if (resolved?.id && fs.existsSync(new URL(prependForwardSlash(resolved.id), "file://"))) {
        const src = await emitESMImage(
          resolved.id,
          ctx.pluginContext.meta.watchMode,
          ctx.pluginContext.emitFile
        );
        node.attributes.__optimizedSrc = src;
      } else {
        throw new MarkdocError({
          message: `Could not resolve image ${JSON.stringify(
            node.attributes.src
          )} from ${JSON.stringify(ctx.filePath)}. Does the file exist?`
        });
      }
    }
    await emitOptimizedImages(node.children, ctx);
  }
}
function shouldOptimizeImage(src) {
  return !isValidUrl(src) && !src.startsWith("/");
}
function getStringifiedImports(componentConfigMap, componentNamePrefix, root) {
  let stringifiedComponentImports = "";
  for (const [key, config] of Object.entries(componentConfigMap)) {
    const importName = config.namedExport ? `{ ${config.namedExport} as ${componentNamePrefix + toImportName(key)} }` : componentNamePrefix + toImportName(key);
    const resolvedPath = config.type === "local" ? new URL(config.path, root).pathname : config.path;
    stringifiedComponentImports += `import ${importName} from ${JSON.stringify(resolvedPath)};
`;
  }
  return stringifiedComponentImports;
}
function toImportName(unsafeName) {
  return unsafeName.replace("-", "_");
}
function getStringifiedMap(componentConfigMap, componentNamePrefix) {
  let stringifiedComponentMap = "{";
  for (const key in componentConfigMap) {
    stringifiedComponentMap += `${JSON.stringify(key)}: ${componentNamePrefix + toImportName(key)},
`;
  }
  stringifiedComponentMap += "}";
  return stringifiedComponentMap;
}
function parseFrontmatter(fileContents, filePath) {
  try {
    matter.clearCache();
    return matter(fileContents);
  } catch (e) {
    if (e.name === "YAMLException") {
      const err = e;
      err.id = filePath;
      err.loc = { file: e.id, line: e.mark.line + 1, column: e.mark.column };
      err.message = e.reason;
      throw err;
    } else {
      throw e;
    }
  }
}
export {
  getContentEntryType
};
