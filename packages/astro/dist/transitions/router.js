const persistState = (state) => history.state && history.replaceState(state, "");
const supportsViewTransitions = !!document.startViewTransition;
const transitionEnabledOnThisPage = () => !!document.querySelector('[name="astro-view-transitions-enabled"]');
const samePage = (otherLocation) => location.pathname === otherLocation.pathname && location.search === otherLocation.search;
const triggerEvent = (name) => document.dispatchEvent(new Event(name));
const onPageLoad = () => triggerEvent("astro:page-load");
const announce = () => {
  let div = document.createElement("div");
  div.setAttribute("aria-live", "assertive");
  div.setAttribute("aria-atomic", "true");
  div.setAttribute(
    "style",
    "position:absolute;left:0;top:0;clip:rect(0 0 0 0);clip-path:inset(50%);overflow:hidden;white-space:nowrap;width:1px;height:1px"
  );
  document.body.append(div);
  setTimeout(
    () => {
      let title = document.title || document.querySelector("h1")?.textContent || location.pathname;
      div.textContent = title;
    },
    // Much thought went into this magic number; the gist is that screen readers
    // need to see that the element changed and might not do so if it happens
    // too quickly.
    60
  );
};
const PERSIST_ATTR = "data-astro-transition-persist";
const parser = new DOMParser();
let noopEl;
if (import.meta.env.DEV) {
  noopEl = document.createElement("div");
}
let currentHistoryIndex = 0;
if (history.state) {
  currentHistoryIndex = history.state.index;
  scrollTo({ left: history.state.scrollX, top: history.state.scrollY });
} else if (transitionEnabledOnThisPage()) {
  history.replaceState({ index: currentHistoryIndex, scrollX, scrollY, intraPage: false }, "");
}
const throttle = (cb, delay) => {
  let wait = false;
  let onceMore = false;
  return (...args) => {
    if (wait) {
      onceMore = true;
      return;
    }
    cb(...args);
    wait = true;
    setTimeout(() => {
      if (onceMore) {
        onceMore = false;
        cb(...args);
      }
      wait = false;
    }, delay);
  };
};
async function fetchHTML(href) {
  try {
    const res = await fetch(href);
    const mediaType = res.headers.get("content-type")?.replace(/;.*$/, "");
    if (mediaType !== "text/html" && mediaType !== "application/xhtml+xml") {
      return null;
    }
    const html = await res.text();
    return {
      html,
      redirected: res.redirected ? res.url : void 0,
      mediaType
    };
  } catch (err) {
    return null;
  }
}
function getFallback() {
  const el = document.querySelector('[name="astro-view-transitions-fallback"]');
  if (el) {
    return el.getAttribute("content");
  }
  return "animate";
}
function markScriptsExec() {
  for (const script of document.scripts) {
    script.dataset.astroExec = "";
  }
}
function runScripts() {
  let wait = Promise.resolve();
  for (const script of Array.from(document.scripts)) {
    if (script.dataset.astroExec === "")
      continue;
    const newScript = document.createElement("script");
    newScript.innerHTML = script.innerHTML;
    for (const attr of script.attributes) {
      if (attr.name === "src") {
        const p = new Promise((r) => {
          newScript.onload = r;
        });
        wait = wait.then(() => p);
      }
      newScript.setAttribute(attr.name, attr.value);
    }
    newScript.dataset.astroExec = "";
    script.replaceWith(newScript);
  }
  return wait;
}
function isInfinite(animation) {
  const effect = animation.effect;
  if (!effect || !(effect instanceof KeyframeEffect) || !effect.target)
    return false;
  const style = window.getComputedStyle(effect.target, effect.pseudoElement);
  return style.animationIterationCount === "infinite";
}
const updateHistoryAndScrollPosition = (toLocation, replace, intraPage) => {
  const fresh = !samePage(toLocation);
  if (toLocation.href !== location.href) {
    if (replace) {
      history.replaceState({ ...history.state }, "", toLocation.href);
    } else {
      history.replaceState({ ...history.state, intraPage }, "");
      history.pushState({ index: ++currentHistoryIndex, scrollX, scrollY }, "", toLocation.href);
    }
    if (fresh) {
      scrollTo({ left: 0, top: 0, behavior: "instant" });
    }
  }
  if (toLocation.hash) {
    location.href = toLocation.href;
  } else {
    scrollTo({ left: 0, top: 0, behavior: "instant" });
  }
};
async function updateDOM(newDocument, toLocation, options, popState, fallback) {
  const persistedHeadElement = (el) => {
    const id = el.getAttribute(PERSIST_ATTR);
    const newEl = id && newDocument.head.querySelector(`[${PERSIST_ATTR}="${id}"]`);
    if (newEl) {
      return newEl;
    }
    if (el.matches("link[rel=stylesheet]")) {
      const href = el.getAttribute("href");
      return newDocument.head.querySelector(`link[rel=stylesheet][href="${href}"]`);
    }
    if (import.meta.env.DEV) {
      if (el.tagName === "STYLE" && el.dataset.viteDevId) {
        const devId = el.dataset.viteDevId;
        return newDocument.querySelector(`style[data-astro-dev-id="${devId}"]`) || // Otherwise, keep it anyways. This is client:only styles.
        noopEl;
      }
    }
    return null;
  };
  const swap = () => {
    triggerEvent("astro:before-swap");
    const html = document.documentElement;
    const astro = [...html.attributes].filter(
      ({ name }) => (html.removeAttribute(name), name.startsWith("data-astro-"))
    );
    [...newDocument.documentElement.attributes, ...astro].forEach(
      ({ name, value }) => html.setAttribute(name, value)
    );
    for (const s1 of document.scripts) {
      for (const s2 of newDocument.scripts) {
        if (
          // Inline
          !s1.src && s1.textContent === s2.textContent || // External
          s1.src && s1.type === s2.type && s1.src === s2.src
        ) {
          s2.dataset.astroExec = "";
          break;
        }
      }
    }
    for (const el of Array.from(document.head.children)) {
      const newEl = persistedHeadElement(el);
      if (newEl) {
        newEl.remove();
      } else {
        el.remove();
      }
    }
    document.head.append(...newDocument.head.children);
    const oldBody = document.body;
    document.body.replaceWith(newDocument.body);
    for (const el of oldBody.querySelectorAll(`[${PERSIST_ATTR}]`)) {
      const id = el.getAttribute(PERSIST_ATTR);
      const newEl = document.querySelector(`[${PERSIST_ATTR}="${id}"]`);
      if (newEl) {
        newEl.replaceWith(el);
      }
    }
    if (popState) {
      scrollTo(popState.scrollX, popState.scrollY);
    } else {
      updateHistoryAndScrollPosition(toLocation, options.history === "replace", false);
    }
    triggerEvent("astro:after-swap");
  };
  const links = [];
  for (const el of newDocument.querySelectorAll("head link[rel=stylesheet]")) {
    if (!document.querySelector(
      `[${PERSIST_ATTR}="${el.getAttribute(PERSIST_ATTR)}"], link[rel=stylesheet]`
    )) {
      const c = document.createElement("link");
      c.setAttribute("rel", "preload");
      c.setAttribute("as", "style");
      c.setAttribute("href", el.getAttribute("href"));
      links.push(
        new Promise((resolve) => {
          ["load", "error"].forEach((evName) => c.addEventListener(evName, resolve));
          document.head.append(c);
        })
      );
    }
  }
  links.length && await Promise.all(links);
  if (fallback === "animate") {
    const currentAnimations = document.getAnimations();
    document.documentElement.dataset.astroTransitionFallback = "old";
    const newAnimations = document.getAnimations().filter((a) => !currentAnimations.includes(a) && !isInfinite(a));
    const finished = Promise.all(newAnimations.map((a) => a.finished));
    const fallbackSwap = () => {
      swap();
      document.documentElement.dataset.astroTransitionFallback = "new";
    };
    await finished;
    fallbackSwap();
  } else {
    swap();
  }
}
async function transition(direction, toLocation, options, popState) {
  let finished;
  const href = toLocation.href;
  const response = await fetchHTML(href);
  if (response === null) {
    location.href = href;
    return;
  }
  if (response.redirected) {
    toLocation = new URL(response.redirected);
  }
  const newDocument = parser.parseFromString(response.html, response.mediaType);
  newDocument.querySelectorAll("noscript").forEach((el) => el.remove());
  if (!newDocument.querySelector('[name="astro-view-transitions-enabled"]')) {
    location.href = href;
    return;
  }
  if (!popState) {
    history.replaceState({ ...history.state, scrollX, scrollY }, "");
  }
  document.documentElement.dataset.astroTransition = direction;
  if (supportsViewTransitions) {
    finished = document.startViewTransition(
      () => updateDOM(newDocument, toLocation, options, popState)
    ).finished;
  } else {
    finished = updateDOM(newDocument, toLocation, options, popState, getFallback());
  }
  try {
    await finished;
  } finally {
    await runScripts();
    markScriptsExec();
    onPageLoad();
    announce();
  }
}
function navigate(href, options) {
  if (!transitionEnabledOnThisPage()) {
    location.href = href;
    return;
  }
  const toLocation = new URL(href, location.href);
  if (location.origin === toLocation.origin && samePage(toLocation)) {
    updateHistoryAndScrollPosition(toLocation, options?.history === "replace", true);
  } else {
    transition("forward", toLocation, options ?? {});
  }
}
if (supportsViewTransitions || getFallback() !== "none") {
  addEventListener("popstate", (ev) => {
    if (!transitionEnabledOnThisPage() && ev.state) {
      if (history.scrollRestoration) {
        history.scrollRestoration = "manual";
      }
      location.reload();
      return;
    }
    if (ev.state === null) {
      if (history.scrollRestoration) {
        history.scrollRestoration = "auto";
      }
      return;
    }
    if (history.scrollRestoration) {
      history.scrollRestoration = "manual";
    }
    const state = history.state;
    if (state.intraPage) {
      scrollTo(state.scrollX, state.scrollY);
    } else {
      const nextIndex = state.index;
      const direction = nextIndex > currentHistoryIndex ? "forward" : "back";
      currentHistoryIndex = nextIndex;
      transition(direction, new URL(location.href), {}, state);
    }
  });
  addEventListener("load", onPageLoad);
  const updateState = () => {
    persistState({ ...history.state, scrollX, scrollY });
  };
  if ("onscrollend" in window)
    addEventListener("scrollend", updateState);
  else
    addEventListener("scroll", throttle(updateState, 300));
  markScriptsExec();
}
export {
  navigate,
  supportsViewTransitions,
  transitionEnabledOnThisPage
};
