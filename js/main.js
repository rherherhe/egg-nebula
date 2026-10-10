// TODO: paste your newsletter provider's form endpoint here (Buttondown, Mailchimp, etc.).
// While this is empty, the form tells visitors honestly that sign-ups aren't open yet.
const NEWSLETTER_ENDPOINT = "";

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
