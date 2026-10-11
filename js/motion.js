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
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  // Wraps each word (and optionally each letter) of an element so the pieces can move one
  // by one. Each word is a small mask its contents slide out of. Screen readers still get
  // the original sentence through aria-label. Returns the moving pieces and an undo.
  const split = (el, { letters = false } = {}) => {
    const original = el.innerHTML;
    const text = el.textContent.trim().replace(/\s+/g, " ");
    el.setAttribute("aria-label", text);
    el.innerHTML = text
      .split(" ")
      .map((word) => {
        const inner = letters ? [...word].map((c) => `<span class="char">${c}</span>`).join("") : `<span>${word}</span>`;
        return `<span class="word" aria-hidden="true">${inner}</span>`;
      })
      .join(" ");
    return {
      pieces: [...el.querySelectorAll(".word > span")],
      undo: () => {
        el.innerHTML = original;
        el.removeAttribute("aria-label");
      },
    };
  };

  const media = gsap.matchMedia();

  media.add(
    {
      motion: "(prefers-reduced-motion: no-preference)",
      // Wide and tall enough for About to be held in place and told in two parts.
      roomy: "(min-width: 901px) and (min-height: 700px)",
    },
    (context) => {
    if (!context.conditions.motion) return;
    const undo = [];
    const listen = (el, type, handler, options) => {
      el.addEventListener(type, handler, options);
      undo.push(() => el.removeEventListener(type, handler, options));
    };
    const splitAndKeep = (el, options) => {
      const result = split(el, options);
      undo.push(result.undo);
      return result.pieces;
    };

    root.classList.add("has-motion");
    undo.push(() => root.classList.remove("has-motion"));

    // ----- In-page links glide to their section (see the note on scroll-behavior in the CSS) -----
    listen(document, "click", (event) => {
      const link = event.target.closest('a[href^="#"]');
      const target = link && link.hash.length > 1 && $(link.hash);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth" });
      history.pushState(null, "", link.hash);
    });

    // ----- A thin bar along the top that fills as you read down the page -----
    const bar = document.createElement("div");
    bar.className = "scroll-progress";
    document.body.append(bar);
    undo.push(() => bar.remove());
    gsap.to(bar, { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: 0.3 } });

    // ----- Arriving on the page -----
    const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
    intro.from(".site-header .wrap", { y: -24, autoAlpha: 0, duration: 0.8 });

    // The headline's letters swing up out of their masks, one after another.
    const headline = $(".hero h1, .page-head h1");
    if (headline) {
      const letters = splitAndKeep(headline, { letters: true });
      intro.from(letters, { yPercent: 125, rotation: 14, duration: 0.9, ease: "back.out(1.6)", stagger: 0.022 }, 0.1);
    }

    if ($(".hero")) {
      intro
        .from(".hero-copy .lead", { clipPath: "inset(0% 0% 100% 0%)", y: 30, duration: 1 }, 0.75)
        .from(".hero-actions", { scale: 0.5, autoAlpha: 0, duration: 0.9, ease: "elastic.out(1, 0.6)" }, 1.0)
        .from(".hero-switcher > *", { y: -16, autoAlpha: 0, duration: 0.5, stagger: 0.05 }, 1.0);
      // (The 3D mascots pop up out of the grass on their own; see mascots-3d.js.)

      // The headline drifts up and fades as the hero scrolls away.
      gsap.to(".hero-copy", {
        yPercent: -18,
        autoAlpha: 0.1,
        ease: "none",
        scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
      });
    }

    // ----- About holds still and tells its story in two parts; then the Lab slides over it -----
    // On a roomy screen About fills the window and is pinned there. Its first part (the
    // heading and opening paragraph) stays for a while, then leaves with a rolling wipe.
    // The second part ("Wherever your curiosity begins…") takes the same spot. After that
    // the Lab, with its rounded top, scrolls up over About while it sinks back and dims.
    // Elsewhere (narrow or short windows) the two parts just stack, and About is covered.
    const about = $(".about");
    let aboutIsStaged = false;
    if (about && $("#lab")) {
      const staged = context.conditions.roomy;
      aboutIsStaged = staged;
      const fits = () => staged || about.offsetHeight <= window.innerHeight + 2;
      const hold = () => (staged ? Math.round(window.innerHeight * 1.8) : 0);
      const coverLength = () => Math.min(about.offsetHeight, window.innerHeight);

      about.classList.toggle("is-staged", staged);
      undo.push(() => about.classList.remove("is-staged"));

      // The Lab is pushed down by the length of the hold, so it arrives when the story is done.
      // mascots-3d.js reads the same number to pace the mascots' flight.
      const setHold = () => root.style.setProperty("--about-hold", `${hold()}px`);
      setHold();
      ScrollTrigger.addEventListener("refreshInit", setHold);
      undo.push(() => {
        ScrollTrigger.removeEventListener("refreshInit", setHold);
        root.style.removeProperty("--about-hold");
      });

      const pin = ScrollTrigger.create({
        trigger: about,
        start: () => (fits() ? "top top" : "bottom bottom"),
        end: () => `+=${hold() + coverLength()}`,
        pin: true,
        pinSpacing: false,
        invalidateOnRefresh: true,
      });

      if (staged) {
        const story = gsap.timeline({
          scrollTrigger: { trigger: about, start: "top top", end: () => `+=${Math.max(hold(), 1)}`, scrub: 0.6, invalidateOnRefresh: true },
        });
        // Explicit start and end values throughout: with invalidateOnRefresh, a plain from()
        // would re-read its end state while the element is still hidden, and animate
        // hidden-to-hidden.
        const wiped = "inset(0% 0% 100% 0%)";
        const shown = "inset(0% 0% 0% 0%)";
        story
          // Part one leaves: each piece is wiped away from the bottom up while it drifts off.
          .fromTo(".about-stage--one .eyebrow", { clipPath: shown, y: 0 }, { clipPath: wiped, y: -60, duration: 0.7, ease: "power3.in" }, 0.8)
          .fromTo(".about-stage--one h2", { clipPath: shown, y: 0, skewY: 0 }, { clipPath: wiped, y: -90, skewY: -4, duration: 0.8, ease: "power3.in" }, 0.9)
          .fromTo(".about-stage--one .about-copy", { clipPath: shown, y: 0 }, { clipPath: wiped, y: -90, duration: 0.8, ease: "power3.in" }, 1.05)
          // Part two arrives in its place: the line rises word by word, then the paragraph unrolls.
          .fromTo(
            splitAndKeep($(".about-line")),
            { yPercent: 125, rotation: 6 },
            { yPercent: 0, rotation: 0, duration: 1, ease: "power3.out", stagger: 0.09 },
            1.75
          )
          .fromTo(
            ".about-stage--two > p:last-child",
            { clipPath: wiped, y: 40 },
            { clipPath: shown, y: 0, duration: 1.1, ease: "power2.out" },
            2.75
          )
          .to({}, { duration: 1.0 }); // a beat to read before the Lab arrives
      }

      gsap.to(".about > .wrap", {
        scale: 0.9,
        autoAlpha: 0.25,
        transformOrigin: "50% 40%",
        ease: "none",
        scrollTrigger: { trigger: about, start: () => pin.start + hold(), end: () => pin.end, scrub: true, invalidateOnRefresh: true },
      });
    }

    // ----- About: the mascots slide in from the edges as the section arrives -----
    for (const [selector, from] of [[".peek--left", "-200px"], [".peek--right", "200px"]]) {
      if (!$(selector)) continue;
      gsap.fromTo(
        selector,
        { "--peek": from },
        { "--peek": "0px", ease: "none", scrollTrigger: { trigger: ".about", start: "top 85%", end: "top 25%", scrub: 0.6 } }
      );
    }

    // ----- Section labels spread in; headings rise word by word out of their masks -----
    for (const label of $$("main .eyebrow")) {
      gsap.from(label, {
        letterSpacing: "0.7em",
        autoAlpha: 0,
        duration: 1.1,
        ease: "power3.out",
        scrollTrigger: { trigger: label, start: "top 92%", once: true },
      });
    }
    for (const heading of $$("main h2:not(.eyebrow), main .signup h3, .piece-text h3")) {
      const words = splitAndKeep(heading);
      gsap.from(words, {
        yPercent: 120,
        rotation: 7,
        duration: 1,
        ease: "power4.out",
        stagger: 0.045,
        scrollTrigger: { trigger: heading, start: "top 90%", once: true },
      });
    }

    // ----- Paragraphs unroll from the top, like a blind being let down -----
    const unrolling = $(
      [
        // (When About tells its story in two parts, only the first unrolls on arrival.)
        aboutIsStaged ? ".about-stage--one .about-copy > p" : ".about-stage .about-copy > p, .about-stage--two > p",
        ".section-head .lead",
        ".perspective-inner > p:not(.perspective-lead):not(.perspective-line):not(.section-foot)",
        ".page-head .wrap > *:not(h1):not(.eyebrow)",
        ".resource-section > .wrap > .lead",
        ".piece-text > *:not(h3)",
        ".signup > p, .newsletter-form",
      ].join(", ")
    );
    gsap.set(unrolling, { clipPath: "inset(0% 0% 100% 0%)", y: 34 });
    ScrollTrigger.batch(unrolling, {
      start: "top 92%",
      once: true,
      onEnter: (batch) =>
        gsap.to(batch, {
          clipPath: "inset(0% 0% 0% 0%)",
          y: 0,
          duration: 1.1,
          ease: "power3.out",
          stagger: 0.1,
          overwrite: true,
          clearProps: "clipPath",
        }),
    });

    // ----- Buttons under each section pop in -----
    for (const foot of $$(".section-foot")) {
      gsap.from(foot, {
        scale: 0.4,
        autoAlpha: 0,
        duration: 1,
        ease: "elastic.out(1, 0.55)",
        scrollTrigger: { trigger: foot, start: "top 94%", once: true },
      });
    }

    // ----- Lab: cards swing in from either side, then their drawings assemble -----
    $$("#lab .card").forEach((card, i) => {
      const side = i % 2 ? 1 : -1;
      const art = card.querySelector("svg");
      const timeline = gsap.timeline({ scrollTrigger: { trigger: card, start: "top 88%", once: true } });
      timeline.from(card, {
        x: side * 140,
        rotationY: side * 40,
        rotationZ: side * 4,
        scale: 0.8,
        autoAlpha: 0,
        transformPerspective: 1100,
        duration: 1.3,
        ease: "power4.out",
      });
      if (!art) return;

      // Lines draw themselves; round things pop into place one after another.
      for (const line of art.querySelectorAll("path")) {
        const length = line.getTotalLength();
        timeline.fromTo(
          line,
          { strokeDasharray: length, strokeDashoffset: length },
          { strokeDashoffset: 0, duration: 1.2, ease: "power2.inOut", clearProps: "strokeDasharray,strokeDashoffset" },
          0.5
        );
      }
      timeline.from(
        art.querySelectorAll("circle, ellipse"),
        { scale: 0, transformOrigin: "50% 50%", duration: 0.7, ease: "back.out(2.4)", stagger: 0.11 },
        0.45
      );
    });

    // ----- Resources: the carousel swells in, and drifts sideways with the scroll -----
    const carousel = $(".flex-carousel");
    if (carousel) {
      gsap.from(carousel, {
        scale: 0.78,
        y: 110,
        autoAlpha: 0,
        duration: 1.4,
        ease: "power4.out",
        scrollTrigger: { trigger: carousel, start: "top 92%", once: true },
      });

      let settling;
      ScrollTrigger.create({
        trigger: carousel,
        start: "top bottom",
        end: "bottom top",
        onUpdate: (self) => {
          const api = carousel.flexCarousel; // set by flex-carousel.js
          if (!api) return;
          api.shift(self.getVelocity() * 0.004);
          clearTimeout(settling);
          settling = setTimeout(api.settle, 180);
        },
      });
      undo.push(() => clearTimeout(settling));
    }

    // ----- Our Perspective: the card rises and settles as it comes into view -----
    const perspectiveCard = $(".perspective-card");
    if (perspectiveCard) {
      gsap.fromTo(
        perspectiveCard,
        { y: 120, scale: 0.9, autoAlpha: 0, transformOrigin: "50% 100%" },
        {
          y: 0,
          scale: 1,
          autoAlpha: 1,
          ease: "none",
          scrollTrigger: { trigger: perspectiveCard, start: "top 98%", end: "top 55%", scrub: 0.5 },
        }
      );
    }

    // ----- Our Perspective: the opening line lights up word by word; the closing line types in -----
    const statement = $(".perspective-lead");
    if (statement) {
      gsap.fromTo(
        splitAndKeep(statement),
        { opacity: 0.18, yPercent: 30 },
        {
          opacity: 1,
          yPercent: 0,
          ease: "none",
          stagger: 0.1,
          scrollTrigger: { trigger: statement, start: "top 85%", end: "top 35%", scrub: 0.4 },
        }
      );
    }
    const closing = $(".perspective-line");
    if (closing) {
      gsap.from(splitAndKeep(closing, { letters: true }), {
        yPercent: 120,
        rotation: 10,
        duration: 0.7,
        ease: "back.out(1.8)",
        stagger: 0.012,
        scrollTrigger: { trigger: closing, start: "top 90%", once: true },
      });
    }

    // ----- Newsletter: the card tips up from the ground; the mascots climb out of the grass -----
    if ($(".signup")) {
      gsap.from(".signup", {
        rotationX: 60,
        y: 140,
        scale: 0.85,
        autoAlpha: 0,
        transformPerspective: 900,
        transformOrigin: "50% 100%",
        ease: "none",
        scrollTrigger: { trigger: ".signup", start: "top 100%", end: "top 62%", scrub: 0.5 },
      });
    }
    if ($(".ground")) {
      gsap.from(".ground .nilly, .ground .stargazers", {
        yPercent: 80,
        scaleY: 0.7,
        transformOrigin: "50% 100%",
        duration: 1.3,
        ease: "elastic.out(1, 0.5)",
        stagger: 0.2,
        scrollTrigger: { trigger: ".ground", start: "top 96%", once: true },
      });
    }

    // ----- Background stars drift slower than the page, for a little depth -----
    for (const field of $$(".section > .stars, .page-head > .stars")) {
      gsap.fromTo(
        field,
        { yPercent: -12 },
        { yPercent: 12, ease: "none", scrollTrigger: { trigger: field.parentElement, start: "top bottom", end: "bottom top", scrub: true } }
      );
    }

    // ----- Resources page: drawings wipe in from the side; the gallery scatters into place -----
    for (const piece of $$(".piece")) {
      gsap.from(piece.querySelector(".zoom"), {
        clipPath: "inset(0% 100% 0% 0%)",
        x: -70,
        rotation: -3,
        duration: 1.3,
        ease: "power4.out",
        clearProps: "clipPath",
        scrollTrigger: { trigger: piece, start: "top 85%", once: true },
      });
    }
    const tiles = $$(".gallery li");
    if (tiles.length) {
      gsap.set(tiles, { autoAlpha: 0, scale: 0.4, y: 80, rotation: () => gsap.utils.random(-18, 18) });
      ScrollTrigger.batch(tiles, {
        start: "top 92%",
        once: true,
        onEnter: (batch) =>
          gsap.to(batch, {
            autoAlpha: 1,
            scale: 1,
            y: 0,
            rotation: 0,
            duration: 1.1,
            ease: "elastic.out(1, 0.7)",
            stagger: { each: 0.07, from: "random" },
            overwrite: true,
          }),
      });
    }

    // ----- Pointer microinteractions (only where there is a mouse to hover with) -----
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      // A soft ring trails the cursor and swells over anything you can press.
      const ring = document.createElement("div");
      ring.className = "cursor-ring";
      document.body.append(ring);
      undo.push(() => ring.remove());
      gsap.set(ring, { xPercent: -50, yPercent: -50, autoAlpha: 0 });
      const ringX = gsap.quickTo(ring, "x", { duration: 0.45, ease: "power3.out" });
      const ringY = gsap.quickTo(ring, "y", { duration: 0.45, ease: "power3.out" });
      listen(window, "pointermove", (event) => {
        ringX(event.clientX);
        ringY(event.clientY);
        const pressable = event.target.closest && event.target.closest("a, button, canvas, input, .zoom");
        gsap.to(ring, { autoAlpha: 1, scale: pressable ? 2.1 : 1, duration: 0.35, overwrite: "auto" });
      });
      listen(document, "pointerleave", () => gsap.to(ring, { autoAlpha: 0, duration: 0.3 }));

      // Buttons lean toward the cursor, then spring back.
      for (const button of $$(".btn:not(.is-disabled)")) {
        const toX = gsap.quickTo(button, "x", { duration: 0.35, ease: "power3.out" });
        const toY = gsap.quickTo(button, "y", { duration: 0.35, ease: "power3.out" });
        listen(button, "pointermove", (event) => {
          const box = button.getBoundingClientRect();
          toX((event.clientX - (box.left + box.width / 2)) * 0.3);
          toY((event.clientY - (box.top + box.height / 2)) * 0.4);
        });
        listen(button, "pointerleave", () => gsap.to(button, { x: 0, y: 0, duration: 0.8, ease: "elastic.out(1, 0.4)" }));
      }

      // Cards tilt toward the cursor, and their picture eases closer.
      for (const card of $$(".card")) {
        const art = card.querySelector(".card-art > *");
        listen(card, "pointermove", (event) => {
          const box = card.getBoundingClientRect();
          const px = (event.clientX - box.left) / box.width - 0.5;
          const py = (event.clientY - box.top) / box.height - 0.5;
          gsap.to(card, { rotationY: px * 10, rotationX: -py * 10, y: -8, transformPerspective: 900, duration: 0.5, ease: "power2.out", overwrite: "auto" });
          if (art) gsap.to(art, { scale: 1.07, x: px * -12, y: py * -12, duration: 0.6, ease: "power2.out", overwrite: "auto" });
        });
        listen(card, "pointerleave", () => {
          gsap.to(card, { rotationY: 0, rotationX: 0, y: 0, duration: 0.9, ease: "elastic.out(1, 0.55)", overwrite: "auto" });
          if (art) gsap.to(art, { scale: 1, x: 0, y: 0, duration: 0.6, ease: "power2.out", overwrite: "auto" });
        });
      }

      // Infographic thumbnails lift and tip a little under the cursor.
      for (const thumb of $$(".zoom")) {
        listen(thumb, "pointerenter", () => gsap.to(thumb, { y: -8, scale: 1.03, rotation: -1.5, duration: 0.4, ease: "power2.out" }));
        listen(thumb, "pointerleave", () => gsap.to(thumb, { y: 0, scale: 1, rotation: 0, duration: 0.7, ease: "elastic.out(1, 0.55)" }));
      }
    }

    // Page height changes once pictures and canvases settle; let ScrollTrigger re-measure.
    const refresh = () => ScrollTrigger.refresh();
    listen(window, "load", refresh);

    return () => undo.forEach((fn) => fn());
    }
  );
})();
