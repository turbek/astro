import { existsSync } from "node:fs";
import { join } from "node:path";
import * as tsr from "tsconfig-resolver";
const defaultTSConfig = { extends: "astro/tsconfigs/base" };
const presets = /* @__PURE__ */ new Map([
  [
    "vue",
    // Settings needed for template intellisense when using Volar
    {
      compilerOptions: {
        jsx: "preserve"
      }
    }
  ],
  [
    "react",
    // Default TypeScript settings, but we need to redefine them in case the users changed them previously
    {
      compilerOptions: {
        jsx: "react-jsx",
        jsxImportSource: "react"
      }
    }
  ],
  [
    "preact",
    // https://preactjs.com/guide/v10/typescript/#typescript-configuration
    {
      compilerOptions: {
        jsx: "react-jsx",
        jsxImportSource: "preact"
      }
    }
  ],
  [
    "solid-js",
    // https://www.solidjs.com/guides/typescript#configuring-typescript
    {
      compilerOptions: {
        jsx: "preserve",
        jsxImportSource: "solid-js"
      }
    }
  ]
]);
function loadTSConfig(cwd, resolve = true) {
  cwd = cwd ?? process.cwd();
  let config = tsr.tsconfigResolverSync({
    cwd,
    filePath: resolve ? void 0 : cwd,
    ignoreExtends: !resolve
  });
  if (!resolve && config.reason === "invalid-config" && !existsSync(join(cwd, "tsconfig.json"))) {
    config = { reason: "not-found", path: void 0, exists: false };
  }
  if (config.reason === "not-found") {
    const jsconfig = tsr.tsconfigResolverSync({
      cwd,
      filePath: resolve ? void 0 : cwd,
      searchName: "jsconfig.json",
      ignoreExtends: !resolve
    });
    if (!resolve && jsconfig.reason === "invalid-config" && !existsSync(join(cwd, "jsconfig.json"))) {
      return { reason: "not-found", path: void 0, exists: false };
    }
    return jsconfig;
  }
  return config;
}
function updateTSConfigForFramework(target, framework) {
  if (!presets.has(framework)) {
    return target;
  }
  return deepMergeObjects(target, presets.get(framework));
}
function deepMergeObjects(a, b) {
  const merged = { ...a };
  for (const key in b) {
    const value = b[key];
    if (a[key] == null) {
      merged[key] = value;
      continue;
    }
    if (typeof a[key] === "object" && typeof value === "object") {
      merged[key] = deepMergeObjects(a[key], value);
      continue;
    }
    merged[key] = value;
  }
  return merged;
}
export {
  defaultTSConfig,
  loadTSConfig,
  presets,
  updateTSConfigForFramework
};
