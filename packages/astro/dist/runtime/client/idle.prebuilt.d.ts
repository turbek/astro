/**
 * This file is prebuilt from packages\astro\src\runtime\client\idle.ts
 * Do not edit this directly, but instead edit that file and rerun the prebuild
 * to generate this file.
 */
declare const _default: "(()=>{var i=t=>{let e=async()=>{await(await t())()};\"requestIdleCallback\"in window?window.requestIdleCallback(e):setTimeout(e,200)};(self.Astro||(self.Astro={})).idle=i;window.dispatchEvent(new Event(\"astro:idle\"));})();";
export default _default;
