// TODO: paste your newsletter provider's form endpoint here (Buttondown, Mailchimp, etc.).
// While this is empty, the form tells visitors honestly that sign-ups aren't open yet.
const NEWSLETTER_ENDPOINT = "";

// Hero background variations. Each has its own link (?hero=nebula and so on) so they can be
// compared side by side; hero-shader.js and hero-painting.js read the choice from <html data-hero>.
const HERO_VARIANTS = { painted: "Painted", nebula: "Nebula", aurora: "Aurora", swirl: "Swirl" };
const hero = document.querySelector(".hero");
if (hero) {
  const asked = new URLSearchParams(location.search).get("hero");
  const current = Object.hasOwn(HERO_VARIANTS, asked) ? asked : "painted";
  document.documentElement.dataset.hero = current;

  const switcher = document.createElement("nav");
  switcher.className = "hero-switcher";
  switcher.setAttribute("aria-label", "Hero background");
  switcher.innerHTML =
    "<span>Background</span>" +
    Object.entries(HERO_VARIANTS)
      .map(([key, label]) => `<a href="?hero=${key}"${key === current ? ` aria-current="true"` : ""}>${label}</a>`)
      .join("");
  hero.prepend(switcher);
}

// The header is clear at the very top of the page and turns solid once you scroll.
const header = document.querySelector(".site-header");
if (header) {
  const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

// Mobile nav
const navToggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".site-nav");
if (navToggle && nav) {
  navToggle.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(open));
  });
  nav.addEventListener("click", (e) => {
    if (e.target.closest("a")) {
      nav.classList.remove("is-open");
      navToggle.setAttribute("aria-expanded", "false");
    }
  });
}

// Scatter small background stars into any .stars container
document.querySelectorAll(".stars").forEach((box) => {
  const count = Number(box.dataset.count) || 60;
  for (let i = 0; i < count; i++) {
    const star = document.createElement("i");
    const size = Math.random() < 0.85 ? 2 : 3.5;
    star.style.width = star.style.height = `${size}px`;
    star.style.left = `${Math.random() * 100}%`;
    star.style.top = `${Math.random() * 100}%`;
    star.style.opacity = (0.4 + Math.random() * 0.6).toFixed(2);
    if (Math.random() < 0.25) {
      star.classList.add("twinkle");
      star.style.animationDelay = `${(Math.random() * 5).toFixed(1)}s`;
    }
    box.appendChild(star);
  }
});

// Newsletter
const form = document.querySelector(".newsletter-form");
if (form) {
  const note = form.querySelector(".form-note");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!NEWSLETTER_ENDPOINT) {
      note.textContent = "Sign-ups aren't open yet. Please check back soon.";
      return;
    }
    note.textContent = "Sending…";
    try {
      const res = await fetch(NEWSLETTER_ENDPOINT, { method: "POST", body: new FormData(form) });
      if (!res.ok) throw new Error(res.statusText);
      form.reset();
      note.textContent = "You're on the list. Salamat!";
    } catch {
      note.textContent = "That didn't go through. Please try again in a bit.";
    }
  });
}

// Preview clips (the Planet Sizes card) play only while their card is hovered or focused.
// The rest of the time the still poster shows. Visitors who ask for reduced motion always
// get the poster.
for (const clip of document.querySelectorAll(".card video")) {
  const card = clip.closest(".card");
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
  const start = () => {
    if (!calm.matches) clip.play().catch(() => {});
  };
  const stop = () => {
    clip.pause();
    clip.load(); // back to the poster, ready to start from the beginning next time
  };
  card.addEventListener("pointerenter", start);
  card.addEventListener("pointerleave", stop);
  card.addEventListener("focusin", start);
  card.addEventListener("focusout", stop);
}

// The telescope by the footer can be pointed up and down: drag it, or focus it and use the
// arrow keys. It is exposed to assistive technology as a slider.
const telescope = document.querySelector(".telescope");
if (telescope) {
  const tube = telescope.querySelector(".telescope-tube");
  const PIVOT = { x: 82, y: 84 }; // where the tube sits on the tripod, in the drawing's own units
  const LOWEST = 0;
  const HIGHEST = 80;
  let angle = 30; // degrees above the horizon

  const point = (degrees) => {
    angle = Math.max(LOWEST, Math.min(HIGHEST, Math.round(degrees)));
    tube.setAttribute("transform", `rotate(${-angle} ${PIVOT.x} ${PIVOT.y})`);
    telescope.setAttribute("aria-valuenow", angle);
    telescope.setAttribute("aria-valuetext", `${angle} degrees above the horizon`);
  };

  // Aim along the line from the pivot to the pointer. Grabbing the eyepiece end (left of the
  // pivot) works too: the big end then points the opposite way.
  const aim = (event) => {
    const box = telescope.getBoundingClientRect();
    let dx = ((event.clientX - box.left) / box.width) * 160 - PIVOT.x;
    let dy = ((event.clientY - box.top) / box.height) * 180 - PIVOT.y;
    if (dx < 0) {
      dx = -dx;
      dy = -dy;
    }
    point((Math.atan2(-dy, dx) * 180) / Math.PI);
  };

  telescope.addEventListener("pointerdown", (event) => {
    aim(event);
    telescope.setPointerCapture(event.pointerId);
  });
  telescope.addEventListener("pointermove", (event) => {
    if (telescope.hasPointerCapture(event.pointerId)) aim(event);
  });

  telescope.addEventListener("keydown", (event) => {
    const steps = { ArrowUp: 5, ArrowRight: 5, ArrowDown: -5, ArrowLeft: -5, PageUp: 15, PageDown: -15 };
    if (event.key in steps) point(angle + steps[event.key]);
    else if (event.key === "Home") point(LOWEST);
    else if (event.key === "End") point(HIGHEST);
    else return;
    event.preventDefault();
  });
}

// Lightbox for infographics. Buttons with the same data-group can be stepped through.
const lightbox = document.querySelector(".lightbox");
if (lightbox) {
  const img = lightbox.querySelector("img");
  const count = lightbox.querySelector(".lightbox-count");
  const prev = lightbox.querySelector("[data-step='-1']");
  const next = lightbox.querySelector("[data-step='1']");
  let group = [];
  let index = 0;

  const show = () => {
    const thumb = group[index].querySelector("img");
    img.src = group[index].dataset.full;
    img.alt = thumb.alt;
    const many = group.length > 1;
    prev.hidden = next.hidden = count.hidden = !many;
    count.textContent = `${index + 1} of ${group.length}`;
  };

  const step = (by) => {
    index = (index + by + group.length) % group.length;
    show();
  };

  document.querySelectorAll(".zoom").forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = btn.dataset.group;
      group = name ? [...document.querySelectorAll(`.zoom[data-group="${name}"]`)] : [btn];
      index = group.indexOf(btn);
      show();
      lightbox.showModal();
    });
  });

  prev.addEventListener("click", () => step(-1));
  next.addEventListener("click", () => step(1));
  lightbox.querySelector(".lightbox-close").addEventListener("click", () => lightbox.close());
  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) lightbox.close();
  });
  lightbox.addEventListener("keydown", (e) => {
    if (group.length < 2) return;
    if (e.key === "ArrowLeft") step(-1);
    if (e.key === "ArrowRight") step(1);
  });
}
