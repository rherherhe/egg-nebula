// Shared by both versions of the site (v1 at the root, v2 under /v2/).
//
// When you move from one version to the other, the page change plays as a before/after
// wipe: a divider sweeps across the window with V1 on its left and V2 on its right. It
// uses the browser's View Transitions for page-to-page navigation; where that isn't
// supported the link just loads the other page as normal.
//
// This file is loaded in <head> without `defer`, because it has to be listening before the
// new page is first shown.
(() => {
  const isV2 = (url) => new URL(url, location.href).pathname.split("/").includes("v2");

  window.addEventListener("pagereveal", (event) => {
    const transition = event.viewTransition;
    if (!transition) return;
    // Skipping a transition rejects its promises; that is expected, not an error.
    for (const promise of [transition.ready, transition.finished, transition.updateCallbackDone]) {
      if (promise) promise.catch(() => {});
    }

    // Only the jump between versions gets the wipe. Ordinary links change page instantly.
    const cameFrom = window.navigation && navigation.activation && navigation.activation.from;
    if (!cameFrom || isV2(cameFrom.url) === isV2(location.href)) {
      transition.skipTransition();
      return;
    }

    const root = document.documentElement;
    const direction = isV2(location.href) ? "to-v2" : "to-v1";

    // The divider only exists for the length of the wipe.
    const handle = document.createElement("div");
    handle.className = "swap-handle";
    handle.setAttribute("aria-hidden", "true");
    handle.innerHTML = "<span>V1 · before</span><i></i><span>V2 · after</span>";
    (document.body || root).append(handle);
    root.classList.add("version-swap", direction);

    const tidy = () => {
      handle.remove();
      root.classList.remove("version-swap", direction);
    };
    transition.finished.then(tidy, tidy);
  });
})();
