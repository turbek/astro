import { markdownConfigDefaults } from "@astrojs/markdown-remark";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { BUNDLED_THEMES } from "shiki";
import { z } from "zod";
import { appendForwardSlash, prependForwardSlash, removeTrailingForwardSlash } from "../path.js";
const ASTRO_CONFIG_DEFAULTS = {
  root: ".",
  srcDir: "./src",
  publicDir: "./public",
  outDir: "./dist",
  cacheDir: "./node_modules/.astro",
  base: "/",
  trailingSlash: "ignore",
  build: {
    format: "directory",
    client: "./dist/client/",
    server: "./dist/server/",
    assets: "_astro",
    serverEntry: "entry.mjs",
    redirects: true,
    inlineStylesheets: "auto",
    split: false,
    excludeMiddleware: false
  },
  image: {
    service: { entrypoint: "astro/assets/services/sharp", config: {} }
  },
  compressHTML: true,
  server: {
    host: false,
    port: 4321,
    open: false
  },
  integrations: [],
  markdown: {
    drafts: false,
    ...markdownConfigDefaults
  },
  vite: {},
  legacy: {},
  redirects: {},
  experimental: {
    optimizeHoistedScript: false
  }
};
const AstroConfigSchema = z.object({
  root: z.string().optional().default(ASTRO_CONFIG_DEFAULTS.root).transform((val) => new URL(val)),
  srcDir: z.string().optional().default(ASTRO_CONFIG_DEFAULTS.srcDir).transform((val) => new URL(val)),
  publicDir: z.string().optional().default(ASTRO_CONFIG_DEFAULTS.publicDir).transform((val) => new URL(val)),
  outDir: z.string().optional().default(ASTRO_CONFIG_DEFAULTS.outDir).transform((val) => new URL(val)),
  cacheDir: z.string().optional().default(ASTRO_CONFIG_DEFAULTS.cacheDir).transform((val) => new URL(val)),
  site: z.string().url().optional(),
  compressHTML: z.boolean().optional().default(ASTRO_CONFIG_DEFAULTS.compressHTML),
  base: z.string().optional().default(ASTRO_CONFIG_DEFAULTS.base),
  trailingSlash: z.union([z.literal("always"), z.literal("never"), z.literal("ignore")]).optional().default(ASTRO_CONFIG_DEFAULTS.trailingSlash),
  output: z.union([z.literal("static"), z.literal("server"), z.literal("hybrid")]).optional().default("static"),
  scopedStyleStrategy: z.union([z.literal("where"), z.literal("class"), z.literal("attribute")]).optional().default("attribute"),
  adapter: z.object({ name: z.string(), hooks: z.object({}).passthrough().default({}) }).optional(),
  integrations: z.preprocess(
    // preprocess
    (val) => Array.isArray(val) ? val.flat(Infinity).filter(Boolean) : val,
    // validate
    z.array(z.object({ name: z.string(), hooks: z.object({}).passthrough().default({}) })).default(ASTRO_CONFIG_DEFAULTS.integrations)
  ),
  build: z.object({
    format: z.union([z.literal("file"), z.literal("directory")]).optional().default(ASTRO_CONFIG_DEFAULTS.build.format),
    client: z.string().optional().default(ASTRO_CONFIG_DEFAULTS.build.client).transform((val) => new URL(val)),
    server: z.string().optional().default(ASTRO_CONFIG_DEFAULTS.build.server).transform((val) => new URL(val)),
    assets: z.string().optional().default(ASTRO_CONFIG_DEFAULTS.build.assets),
    assetsPrefix: z.string().optional(),
    serverEntry: z.string().optional().default(ASTRO_CONFIG_DEFAULTS.build.serverEntry),
    redirects: z.boolean().optional().default(ASTRO_CONFIG_DEFAULTS.build.redirects),
    inlineStylesheets: z.enum(["always", "auto", "never"]).optional().default(ASTRO_CONFIG_DEFAULTS.build.inlineStylesheets),
    /**
     * @deprecated
     * Use the adapter feature instead
     */
    split: z.boolean().optional().default(ASTRO_CONFIG_DEFAULTS.build.split),
    /**
     * @deprecated
     * Use the adapter feature instead
     */
    excludeMiddleware: z.boolean().optional().default(ASTRO_CONFIG_DEFAULTS.build.excludeMiddleware)
  }).default({}),
  server: z.preprocess(
    // preprocess
    // NOTE: Uses the "error" command here because this is overwritten by the
    // individualized schema parser with the correct command.
    (val) => typeof val === "function" ? val({ command: "error" }) : val,
    // validate
    z.object({
      open: z.boolean().optional().default(ASTRO_CONFIG_DEFAULTS.server.open),
      host: z.union([z.string(), z.boolean()]).optional().default(ASTRO_CONFIG_DEFAULTS.server.host),
      port: z.number().optional().default(ASTRO_CONFIG_DEFAULTS.server.port),
      headers: z.custom().optional()
    }).default({})
  ),
  redirects: z.record(
    z.string(),
    z.union([
      z.string(),
      z.object({
        status: z.union([
          z.literal(300),
          z.literal(301),
          z.literal(302),
          z.literal(303),
          z.literal(304),
          z.literal(307),
          z.literal(308)
        ]),
        destination: z.string()
      })
    ])
  ).default(ASTRO_CONFIG_DEFAULTS.redirects),
  image: z.object({
    endpoint: z.string().optional(),
    service: z.object({
      entrypoint: z.union([
        z.literal("astro/assets/services/sharp"),
        z.literal("astro/assets/services/squoosh"),
        z.string()
      ]).default(ASTRO_CONFIG_DEFAULTS.image.service.entrypoint),
      config: z.record(z.any()).default({})
    }).default(ASTRO_CONFIG_DEFAULTS.image.service),
    domains: z.array(z.string()).default([]),
    remotePatterns: z.array(
      z.object({
        protocol: z.string().optional(),
        hostname: z.string().refine(
          (val) => !val.includes("*") || val.startsWith("*.") || val.startsWith("**."),
          {
            message: "wildcards can only be placed at the beginning of the hostname"
          }
        ).optional(),
        port: z.string().optional(),
        pathname: z.string().refine((val) => !val.includes("*") || val.endsWith("/*") || val.endsWith("/**"), {
          message: "wildcards can only be placed at the end of a pathname"
        }).optional()
      })
    ).default([])
  }).default(ASTRO_CONFIG_DEFAULTS.image),
  markdown: z.object({
    drafts: z.boolean().default(false),
    syntaxHighlight: z.union([z.literal("shiki"), z.literal("prism"), z.literal(false)]).default(ASTRO_CONFIG_DEFAULTS.markdown.syntaxHighlight),
    shikiConfig: z.object({
      langs: z.custom().array().default([]),
      theme: z.enum(BUNDLED_THEMES).or(z.custom()).default(ASTRO_CONFIG_DEFAULTS.markdown.shikiConfig.theme),
      wrap: z.boolean().or(z.null()).default(ASTRO_CONFIG_DEFAULTS.markdown.shikiConfig.wrap)
    }).default({}),
    remarkPlugins: z.union([
      z.string(),
      z.tuple([z.string(), z.any()]),
      z.custom((data) => typeof data === "function"),
      z.tuple([z.custom((data) => typeof data === "function"), z.any()])
    ]).array().default(ASTRO_CONFIG_DEFAULTS.markdown.remarkPlugins),
    rehypePlugins: z.union([
      z.string(),
      z.tuple([z.string(), z.any()]),
      z.custom((data) => typeof data === "function"),
      z.tuple([z.custom((data) => typeof data === "function"), z.any()])
    ]).array().default(ASTRO_CONFIG_DEFAULTS.markdown.rehypePlugins),
    remarkRehype: z.custom((data) => data instanceof Object && !Array.isArray(data)).optional().default(ASTRO_CONFIG_DEFAULTS.markdown.remarkRehype),
    gfm: z.boolean().default(ASTRO_CONFIG_DEFAULTS.markdown.gfm),
    smartypants: z.boolean().default(ASTRO_CONFIG_DEFAULTS.markdown.smartypants)
  }).default({}),
  vite: z.custom((data) => data instanceof Object && !Array.isArray(data)).default(ASTRO_CONFIG_DEFAULTS.vite),
  experimental: z.object({
    optimizeHoistedScript: z.boolean().optional().default(ASTRO_CONFIG_DEFAULTS.experimental.optimizeHoistedScript)
  }).strict(
    `Invalid or outdated experimental feature.
Check for incorrect spelling or outdated Astro version.
See https://docs.astro.build/en/reference/configuration-reference/#experimental-flags for a list of all current experiments.`
  ).default({}),
  legacy: z.object({}).default({})
});
function createRelativeSchema(cmd, fileProtocolRoot) {
  const AstroConfigRelativeSchema = AstroConfigSchema.extend({
    root: z.string().default(ASTRO_CONFIG_DEFAULTS.root).transform((val) => resolveDirAsUrl(val, fileProtocolRoot)),
    srcDir: z.string().default(ASTRO_CONFIG_DEFAULTS.srcDir).transform((val) => resolveDirAsUrl(val, fileProtocolRoot)),
    compressHTML: z.boolean().optional().default(ASTRO_CONFIG_DEFAULTS.compressHTML),
    publicDir: z.string().default(ASTRO_CONFIG_DEFAULTS.publicDir).transform((val) => resolveDirAsUrl(val, fileProtocolRoot)),
    outDir: z.string().default(ASTRO_CONFIG_DEFAULTS.outDir).transform((val) => resolveDirAsUrl(val, fileProtocolRoot)),
    cacheDir: z.string().default(ASTRO_CONFIG_DEFAULTS.cacheDir).transform((val) => resolveDirAsUrl(val, fileProtocolRoot)),
    build: z.object({
      format: z.union([z.literal("file"), z.literal("directory")]).optional().default(ASTRO_CONFIG_DEFAULTS.build.format),
      client: z.string().optional().default(ASTRO_CONFIG_DEFAULTS.build.client).transform((val) => resolveDirAsUrl(val, fileProtocolRoot)),
      server: z.string().optional().default(ASTRO_CONFIG_DEFAULTS.build.server).transform((val) => resolveDirAsUrl(val, fileProtocolRoot)),
      assets: z.string().optional().default(ASTRO_CONFIG_DEFAULTS.build.assets),
      assetsPrefix: z.string().optional(),
      serverEntry: z.string().optional().default(ASTRO_CONFIG_DEFAULTS.build.serverEntry),
      redirects: z.boolean().optional().default(ASTRO_CONFIG_DEFAULTS.build.redirects),
      inlineStylesheets: z.enum(["always", "auto", "never"]).optional().default(ASTRO_CONFIG_DEFAULTS.build.inlineStylesheets),
      split: z.boolean().optional().default(ASTRO_CONFIG_DEFAULTS.build.split),
      excludeMiddleware: z.boolean().optional().default(ASTRO_CONFIG_DEFAULTS.build.excludeMiddleware)
    }).optional().default({}),
    server: z.preprocess(
      // preprocess
      (val) => {
        if (typeof val === "function") {
          return val({ command: cmd === "dev" ? "dev" : "preview" });
        } else {
          return val;
        }
      },
      // validate
      z.object({
        host: z.union([z.string(), z.boolean()]).optional().default(ASTRO_CONFIG_DEFAULTS.server.host),
        port: z.number().optional().default(ASTRO_CONFIG_DEFAULTS.server.port),
        open: z.boolean().optional().default(ASTRO_CONFIG_DEFAULTS.server.open),
        headers: z.custom().optional(),
        streaming: z.boolean().optional().default(true)
      }).optional().default({})
    )
  }).transform((config) => {
    if (!config.build.server.toString().startsWith(config.outDir.toString()) && config.build.server.toString().endsWith("dist/server/")) {
      config.build.server = new URL("./dist/server/", config.outDir);
    }
    if (!config.build.client.toString().startsWith(config.outDir.toString()) && config.build.client.toString().endsWith("dist/client/")) {
      config.build.client = new URL("./dist/client/", config.outDir);
    }
    if (config.trailingSlash === "never") {
      config.base = prependForwardSlash(removeTrailingForwardSlash(config.base));
    } else if (config.trailingSlash === "always") {
      config.base = prependForwardSlash(appendForwardSlash(config.base));
    } else {
      config.base = prependForwardSlash(config.base);
    }
    return config;
  }).refine((obj) => !obj.outDir.toString().startsWith(obj.publicDir.toString()), {
    message: "The value of `outDir` must not point to a path within the folder set as `publicDir`, this will cause an infinite loop"
  });
  return AstroConfigRelativeSchema;
}
function resolveDirAsUrl(dir, root) {
  let resolvedDir = path.resolve(root, dir);
  if (!resolvedDir.endsWith(path.sep)) {
    resolvedDir += path.sep;
  }
  return pathToFileURL(resolvedDir);
}
export {
  AstroConfigSchema,
  createRelativeSchema
};
