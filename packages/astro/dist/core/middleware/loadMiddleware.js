import { MIDDLEWARE_PATH_SEGMENT_NAME } from "../constants.js";
async function loadMiddleware(moduleLoader, srcDir) {
  let middlewarePath = `${decodeURI(srcDir.pathname)}${MIDDLEWARE_PATH_SEGMENT_NAME}`;
  try {
    const module = await moduleLoader.import(middlewarePath);
    return module;
  } catch {
    return void 0;
  }
}
export {
  loadMiddleware
};
