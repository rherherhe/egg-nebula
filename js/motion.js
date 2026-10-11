// Site-wide motion, built on GSAP and its ScrollTrigger plugin (both loaded from a CDN).
//
// Everything here is an extra layer: the page is complete and readable without it. If GSAP
// fails to load, or the visitor asks for reduced motion, none of this runs and nothing is
// left hidden.
(() => {
  const { gsap, ScrollTrigger } = window;
  if (!gsap || !ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);

  const root = document.documentElement;
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  // Wraps each word of an element so the words can move one by one. Screen readers still
  // get the original sentence through aria-label. Returns the inner spans and an undo.
  const splitWords = (el) => {
    const original = el.innerHTML;
    const text = el.textContent.trim();
    el.setAttribute("aria-label", text);
    el.innerHTML = text
      .split(/\s+/)
      .map((word) => `<span class="word" aria-hidden="true"><span>${word}</span></span>`)
      .join(" ");
    return {
      words: [...el.querySelectorAll(".word > span")],
      undo: () => {
        el.innerHTML = original;
        el.removeAttribute("aria-label");
      },
    };
  };

  const media = gsap.matchMedia();

  media.add("(prefers-reduced-motion: no-preference)", () => {
    const undo = [];
    root.classList.add("has-motion");
    undo.push(() => root.classList.remove("has-motion"));

    // ----- In-page links glide to their section (see the note on scroll-behavior in the CSS) -----
    const glideTo = (event) => {
      const link = event.target.closest('a[href^="#"]');
      const target = link && link.hash.length > 1 && document.querySelector(link.hash);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth" });
      history.pushState(null, "", link.hash);
    };
    document.addEventListener("click", glideTo);
    undo.push(() => document.removeEventListener("click", glideTo));

    // ----- A thin bar along the top that fills as you read down the page -----
    const bar = document.createElement("div");
    bar.className = "scroll-progress";
    document.body.append(bar);
    undo.push(() => bar.remove());
    gsap.to(bar, { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: 0.3 } });

    // ----- Arriving on the page -----
    const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
    intro.from(".site-header .wrap", { y: -24, autoAlpha: 0, duration: 0.8 });

    const heading = document.querySelector(".hero h1, .page-head h1");
    if (heading) {
      const split = splitWords(heading);
      undo.push(split.undo);
      intro.from(split.words, { yPercent: 115, duration: 0.9, stagger: 0.07 }, 0.1);
    }
    if (document.querySelector(".hero")) {
      intro
        .from(".hero-copy .lead", { y: 24, autoAlpha: 0, duration: 0.8 }, 0.55)
        .from(".hero-actions", { y: 24, autoAlpha: 0, duration: 0.8 }, 0.7)
        .from(".hero-switcher", { autoAlpha: 0, duration: 0.6 }, 0.9)
        // The mascots pop up out of the grass.
        .from(".hero-scene", { yPercent: 35, autoAlpha: 0, duration: 1.1, ease: "back.out(1.5)" }, 0.45);

      // The headline drifts up and fades as the hero scrolls away.
      gsap.to(".hero-copy", {
        yPercent: -14,
        autoAlpha: 0.15,
        ease: "none",
        scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
      });
    }

    // ----- Things rise into place as they scroll into view -----
    const rising = $$(
      [
        ".about .eyebrow, .about h2, .about-copy > *",
        "#lab .section-head > *, #lab .card",
        "#resources .section-head > *, .flex-carousel, .section-foot",
        ".perspective .wrap > *:not(.perspective-lead)",
        ".newsletter .section-head > *, .signup",
        ".page-head .wrap > *:not(h1)",
        ".resource-section > .wrap > .eyebrow, .resource-section > .wrap > h2, .resource-section > .wrap > .lead",
        ".piece, .gallery li",
      ].join(", ")
    );
    gsap.set(rising, { autoAlpha: 0, y: 30 });
    ScrollTrigger.batch(rising, {
      start: "top 92%",
      once: true,
      onEnter: (batch) =>
        gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.9, ease: "power3.out", stagger: 0.08, overwrite: true }),
    });

    // ----- About: the mascots slide in from the edges as the section arrives -----
    const peeks = { ".peek--left": "-190px", ".peek--right": "190px" };
    for (const [selector, from] of Object.entries(peeks)) {
      if (!document.querySelector(selector)) continue;
      gsap.fromTo(
        selector,
        { "--peek": from },
        { "--peek": "0px", ease: "none", scrollTrigger: { trigger: ".about", start: "top 85%", end: "top 30%", scrub: 0.6 } }
      );
    }

    // ----- Our Perspective: the opening line lights up word by word as you scroll -----
    const statement = document.querySelector(".perspective-lead");
    if (statement) {
      const split = splitWords(statement);
      undo.push(split.undo);
      gsap.fromTo(
        split.words,
        { opacity: 0.22 },
        { opacity: 1, ease: "none", stagger: 0.1, scrollTrigger: { trigger: statement, start: "top 82%", end: "top 38%", scrub: true } }
      );
    }

    // ----- Newsletter: the mascots climb up from behind the grass -----
    if (document.querySelector(".ground")) {
      gsap.from(".ground .nilly, .ground .stargazers", {
        yPercent: 70,
        duration: 1.1,
        ease: "back.out(1.6)",
        stagger: 0.18,
        scrollTrigger: { trigger: ".ground", start: "top 96%", once: true },
      });
    }

    // ----- Pointer microinteractions (only where there is a mouse to hover with) -----
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      const listen = (el, type, handler) => {
        el.addEventListener(type, handler);
        undo.push(() => el.removeEventListener(type, handler));
      };

      // Buttons lean toward the cursor, then spring back.
      for (const button of $$(".btn:not(.is-disabled)")) {
        const toX = gsap.quickTo(button, "x", { duration: 0.35, ease: "power3.out" });
        const toY = gsap.quickTo(button, "y", { duration: 0.35, ease: "power3.out" });
        listen(button, "pointermove", (event) => {
          const box = button.getBoundingClientRect();
          toX((event.clientX - (box.left + box.width / 2)) * 0.25);
          toY((event.clientY - (box.top + box.height / 2)) * 0.35);
        });
        listen(button, "pointerleave", () => gsap.to(button, { x: 0, y: 0, duration: 0.7, ease: "elastic.out(1, 0.45)" }));
      }

      // Cards tilt toward the cursor, and their picture eases closer.
      for (const card of $$(".card")) {
        const art = card.querySelector(".card-art > *");
        gsap.set(card, { transformPerspective: 900 });
        listen(card, "pointermove", (event) => {
          const box = card.getBoundingClientRect();
          const px = (event.clientX - box.left) / box.width - 0.5;
          const py = (event.clientY - box.top) / box.height - 0.5;
          gsap.to(card, { rotationY: px * 9, rotationX: -py * 9, y: -6, duration: 0.5, ease: "power2.out", overwrite: "auto" });
          if (art) gsap.to(art, { scale: 1.06, x: px * -10, y: py * -10, duration: 0.6, ease: "power2.out", overwrite: "auto" });
        });
        listen(card, "pointerleave", () => {
          gsap.to(card, { rotationY: 0, rotationX: 0, y: 0, duration: 0.8, ease: "elastic.out(1, 0.6)", overwrite: "auto" });
          if (art) gsap.to(art, { scale: 1, x: 0, y: 0, duration: 0.6, ease: "power2.out", overwrite: "auto" });
        });
      }

      // Infographic thumbnails lift a little under the cursor.
      for (const thumb of $$(".zoom")) {
        listen(thumb, "pointerenter", () => gsap.to(thumb, { y: -6, scale: 1.02, duration: 0.4, ease: "power2.out" }));
        listen(thumb, "pointerleave", () => gsap.to(thumb, { y: 0, scale: 1, duration: 0.6, ease: "elastic.out(1, 0.6)" }));
      }
    }

    // Page height changes once pictures and canvases settle; let ScrollTrigger re-measure.
    const refresh = () => ScrollTrigger.refresh();
    window.addEventListener("load", refresh);
    undo.push(() => window.removeEventListener("load", refresh));

    return () => undo.forEach((fn) => fn());
  });
})();
