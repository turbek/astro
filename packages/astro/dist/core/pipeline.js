import { callEndpoint, createAPIContext } from "./endpoint/index.js";
import { callMiddleware } from "./middleware/callMiddleware.js";
import { renderPage } from "./render/core.js";
import {} from "./render/index.js";
class Pipeline {
  env;
  #onRequest;
  /**
   * The handler accepts the *original* `Request` and result returned by the endpoint.
   * It must return a `Response`.
   */
  #endpointHandler;
  /**
   * When creating a pipeline, an environment is mandatory.
   * The environment won't change for the whole lifetime of the pipeline.
   */
  constructor(env) {
    this.env = env;
  }
  setEnvironment() {
  }
  /**
   * When rendering a route, an "endpoint" will a type that needs to be handled and transformed into a `Response`.
   *
   * Each consumer might have different needs; use this function to set up the handler.
   */
  setEndpointHandler(handler) {
    this.#endpointHandler = handler;
  }
  /**
   * A middleware function that will be called before each request.
   */
  setMiddlewareFunction(onRequest) {
    this.#onRequest = onRequest;
  }
  /**
   * Returns the current environment
   */
  getEnvironment() {
    return this.env;
  }
  /**
   * The main function of the pipeline. Use this function to render any route known to Astro;
   */
  async renderRoute(renderContext, componentInstance) {
    const result = await this.#tryRenderRoute(
      renderContext,
      this.env,
      componentInstance,
      this.#onRequest
    );
    if (renderContext.route.type === "endpoint") {
      if (!this.#endpointHandler) {
        throw new Error(
          "You created a pipeline that does not know how to handle the result coming from an endpoint."
        );
      }
      return this.#endpointHandler(renderContext.request, result);
    } else {
      return result;
    }
  }
  /**
   * It attempts to render a route. A route can be a:
   * - page
   * - redirect
   * - endpoint
   *
   * ## Errors
   *
   * It throws an error if the page can't be rendered.
   */
  async #tryRenderRoute(renderContext, env, mod, onRequest) {
    const apiContext = createAPIContext({
      request: renderContext.request,
      params: renderContext.params,
      props: renderContext.props,
      site: env.site,
      adapterName: env.adapterName
    });
    switch (renderContext.route.type) {
      case "page":
      case "redirect": {
        if (onRequest) {
          return await callMiddleware(
            env.logger,
            onRequest,
            apiContext,
            () => {
              return renderPage({
                mod,
                renderContext,
                env,
                cookies: apiContext.cookies
              });
            }
          );
        } else {
          return await renderPage({
            mod,
            renderContext,
            env,
            cookies: apiContext.cookies
          });
        }
      }
      case "endpoint": {
        const result = await callEndpoint(
          mod,
          env,
          renderContext,
          onRequest
        );
        return result;
      }
      default:
        throw new Error(`Couldn't find route of type [${renderContext.route.type}]`);
    }
  }
}
export {
  Pipeline
};
