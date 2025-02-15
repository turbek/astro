import glob from "fast-glob";
import fsMod from "node:fs";
import { extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import pLimit from "p-limit";
import { AstroError, AstroErrorData } from "../core/errors/index.js";
import { appendForwardSlash } from "../core/path.js";
import { rootRelativePath } from "../core/util.js";
import { VIRTUAL_MODULE_ID } from "./consts.js";
import {
  getContentEntryIdAndSlug,
  getContentPaths,
  getDataEntryExts,
  getDataEntryId,
  getEntryCollectionName,
  getEntryConfigByExtMap,
  getEntrySlug,
  getEntryType,
  getExtGlob
} from "./utils.js";
function astroContentVirtualModPlugin({
  settings
}) {
  const contentPaths = getContentPaths(settings.config);
  const relContentDir = rootRelativePath(settings.config.root, contentPaths.contentDir);
  const contentEntryConfigByExt = getEntryConfigByExtMap(settings.contentEntryTypes);
  const contentEntryExts = [...contentEntryConfigByExt.keys()];
  const dataEntryExts = getDataEntryExts(settings);
  const virtualModContents = fsMod.readFileSync(contentPaths.virtualModTemplate, "utf-8").replace(
    "@@COLLECTION_NAME_BY_REFERENCE_KEY@@",
    new URL("reference-map.json", contentPaths.cacheDir).pathname
  ).replace("@@CONTENT_DIR@@", relContentDir).replace(
    "'@@CONTENT_ENTRY_GLOB_PATH@@'",
    JSON.stringify(globWithUnderscoresIgnored(relContentDir, contentEntryExts))
  ).replace(
    "'@@DATA_ENTRY_GLOB_PATH@@'",
    JSON.stringify(globWithUnderscoresIgnored(relContentDir, dataEntryExts))
  ).replace(
    "'@@RENDER_ENTRY_GLOB_PATH@@'",
    JSON.stringify(
      globWithUnderscoresIgnored(
        relContentDir,
        /** Note: data collections excluded */
        contentEntryExts
      )
    )
  );
  const astroContentVirtualModuleId = "\0" + VIRTUAL_MODULE_ID;
  return {
    name: "astro-content-virtual-mod-plugin",
    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) {
        return astroContentVirtualModuleId;
      }
    },
    async load(id) {
      if (id === astroContentVirtualModuleId) {
        const stringifiedLookupMap = await getStringifiedLookupMap({
          fs: fsMod,
          contentPaths,
          contentEntryConfigByExt,
          dataEntryExts,
          root: settings.config.root
        });
        return {
          code: virtualModContents.replace(
            "/* @@LOOKUP_MAP_ASSIGNMENT@@ */",
            `lookupMap = ${stringifiedLookupMap};`
          )
        };
      }
    }
  };
}
async function getStringifiedLookupMap({
  contentPaths,
  contentEntryConfigByExt,
  dataEntryExts,
  root,
  fs
}) {
  const { contentDir } = contentPaths;
  const relContentDir = rootRelativePath(root, contentDir, false);
  const contentEntryExts = [...contentEntryConfigByExt.keys()];
  let lookupMap = {};
  const contentGlob = await glob(
    `${relContentDir}**/*${getExtGlob([...dataEntryExts, ...contentEntryExts])}`,
    {
      absolute: true,
      cwd: fileURLToPath(root),
      fs: {
        readdir: fs.readdir.bind(fs),
        readdirSync: fs.readdirSync.bind(fs)
      }
    }
  );
  const limit = pLimit(10);
  const promises = [];
  for (const filePath of contentGlob) {
    promises.push(
      limit(async () => {
        const entryType = getEntryType(filePath, contentPaths, contentEntryExts, dataEntryExts);
        if (entryType !== "content" && entryType !== "data")
          return;
        const collection = getEntryCollectionName({ contentDir, entry: pathToFileURL(filePath) });
        if (!collection)
          throw UnexpectedLookupMapError;
        if (lookupMap[collection]?.type && lookupMap[collection].type !== entryType) {
          throw new AstroError({
            ...AstroErrorData.MixedContentDataCollectionError,
            message: AstroErrorData.MixedContentDataCollectionError.message(collection)
          });
        }
        if (entryType === "content") {
          const contentEntryType = contentEntryConfigByExt.get(extname(filePath));
          if (!contentEntryType)
            throw UnexpectedLookupMapError;
          const { id, slug: generatedSlug } = await getContentEntryIdAndSlug({
            entry: pathToFileURL(filePath),
            contentDir,
            collection
          });
          const slug = await getEntrySlug({
            id,
            collection,
            generatedSlug,
            fs,
            fileUrl: pathToFileURL(filePath),
            contentEntryType
          });
          if (lookupMap[collection]?.entries?.[slug]) {
            throw new AstroError({
              ...AstroErrorData.DuplicateContentEntrySlugError,
              message: AstroErrorData.DuplicateContentEntrySlugError.message(collection, slug),
              hint: slug !== generatedSlug ? `Check the \`slug\` frontmatter property in **${id}**.` : void 0
            });
          }
          lookupMap[collection] = {
            type: "content",
            entries: {
              ...lookupMap[collection]?.entries,
              [slug]: rootRelativePath(root, filePath)
            }
          };
        } else {
          const id = getDataEntryId({ entry: pathToFileURL(filePath), contentDir, collection });
          lookupMap[collection] = {
            type: "data",
            entries: {
              ...lookupMap[collection]?.entries,
              [id]: rootRelativePath(root, filePath)
            }
          };
        }
      })
    );
  }
  await Promise.all(promises);
  return JSON.stringify(lookupMap);
}
const UnexpectedLookupMapError = new AstroError({
  ...AstroErrorData.UnknownContentCollectionError,
  message: `Unexpected error while parsing content entry IDs and slugs.`
});
function globWithUnderscoresIgnored(relContentDir, exts) {
  const extGlob = getExtGlob(exts);
  const contentDir = appendForwardSlash(relContentDir);
  return [
    `${contentDir}**/*${extGlob}`,
    `!${contentDir}**/_*/**/*${extGlob}`,
    `!${contentDir}**/_*${extGlob}`
  ];
}
export {
  astroContentVirtualModPlugin,
  getStringifiedLookupMap
};
