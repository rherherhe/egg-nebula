// A row of resource covers that loops forever and bends at its edges, as if the row were
// passing through curved glass: it stretches downward on the left and upward on the right.
//
// The bend is drawn on a canvas by slicing each cover into thin vertical strips and giving
// every strip its own height. The page's plain list of links is the source of the covers,
// and stays in the page for screen readers and for visitors without JavaScript.
(() => {
  const root = document.querySelector("[data-flex-carousel]");
  if (!root) return;
  const links = [...root.querySelectorAll(".flex-carousel-list a")];
  if (links.length < 2) return;

  const GAP = 12; // px between covers
  const EDGE = 0.26; // share of the width, on each side, where the row bends
  const STRETCH = 0.42; // how much taller a cover gets at the very edge
  const SLICE = 2; // px width of each strip in the bent zones

  const items = links.map((link) => {
    const img = link.querySelector("img");
    return {
      href: link.href,
      title: link.querySelector("span").textContent.trim(),
      src: img.getAttribute("src"),
      ratio: img.width / img.height,
      image: null, // the loaded picture
      bitmap: null, // the picture pre-scaled to the size it is drawn at
      x: 0,
      w: 0,
    };
  });

  // ----- Page elements -----
  const canvas = document.createElement("canvas");
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "Covers of our resources. Use the buttons that follow to move through them.");
  const ctx = canvas.getContext("2d");

  const caption = document.createElement("div");
  caption.className = "flex-carousel-caption";
  caption.innerHTML = `
    <button type="button" data-step="-1" aria-label="Previous resource">←</button>
    <p aria-live="polite"><a class="flex-carousel-title"></a><span class="flex-carousel-count"></span></p>
    <button type="button" data-step="1" aria-label="Next resource">→</button>`;
  const titleEl = caption.querySelector(".flex-carousel-title");
  const countEl = caption.querySelector(".flex-carousel-count");

  root.append(canvas, caption);
  root.classList.add("is-ready");
  // The list is now only read aloud; the caption link and buttons are what the keyboard reaches.
  for (const link of links) link.tabIndex = -1;

  // ----- Layout -----
  let W = 0, H = 0, cardH = 0, top = 0, total = 0, dpr = 1;
  let offset = 0; // which point of the endless strip sits at the middle of the view
  let target = 0;
  let current = -1;

  const prepare = (item) => {
    if (!item.image) return;
    const scale = dpr * 1.2;
    const bitmap = document.createElement("canvas");
    bitmap.width = Math.round(item.w * scale);
    bitmap.height = Math.round(cardH * scale);
    bitmap.getContext("2d").drawImage(item.image, 0, 0, bitmap.width, bitmap.height);
    item.bitmap = bitmap;
  };

  const layout = () => {
    const keep = Math.max(current, 0);
    W = root.clientWidth;
    cardH = Math.round(Math.min(330, Math.max(190, W * 0.3)));
    top = Math.round(cardH * STRETCH);
    H = top * 2 + cardH;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.height = `${H}px`;
    caption.style.top = `${top + cardH + 14}px`;

    let x = 0;
    for (const item of items) {
      item.x = x;
      item.w = Math.round(cardH * item.ratio);
      x += item.w + GAP;
      prepare(item);
    }
    total = x;
    offset = target = items[keep].x + items[keep].w / 2;
    render();
  };

  // Where a strip at screen position x starts, and how tall it is.
  const bend = (x) => {
    const zone = W * EDGE;
    if (x < zone) {
      const t = (zone - x) / zone;
      return [top, cardH * (1 + STRETCH * t * t)];
    }
    if (x > W - zone) {
      const t = (x - (W - zone)) / zone;
      const h = cardH * (1 + STRETCH * t * t);
      return [top + cardH - h, h];
    }
    return [top, cardH];
  };

  const drawCard = (item, x0) => {
    const zone = W * EDGE;
    const a = Math.max(x0, 0);
    const b = Math.min(x0 + item.w, W);
    const bitmap = item.bitmap;
    const per = bitmap ? bitmap.width / item.w : 0; // bitmap pixels per screen pixel

    const strips = (from, to) => {
      for (let x = from; x < to; x += SLICE) {
        const sw = Math.min(SLICE, to - x);
        const [y, h] = bend(x + sw / 2);
        if (bitmap) ctx.drawImage(bitmap, (x - x0) * per, 0, sw * per, bitmap.height, x, y, sw + 0.5, h);
        else ctx.fillRect(x, y, sw + 0.5, h);
      }
    };

    strips(a, Math.min(b, zone));
    const m0 = Math.max(a, zone);
    const m1 = Math.min(b, W - zone);
    if (m1 > m0) {
      if (bitmap) ctx.drawImage(bitmap, (m0 - x0) * per, 0, (m1 - m0) * per, bitmap.height, m0, top, m1 - m0, cardH);
      else ctx.fillRect(m0, top, m1 - m0, cardH);
    }
    strips(Math.max(a, W - zone), b);
  };

  // Every copy of every cover that could be on screen: [item index, left edge on screen].
  const visible = () => {
    const out = [];
    const lap = Math.floor(offset / total);
    for (let k = lap - 1; k <= lap + 1; k++) {
      items.forEach((item, i) => {
        const x0 = W / 2 + item.x + k * total - offset;
        if (x0 < W && x0 + item.w > 0) out.push([i, x0]);
      });
    }
    return out;
  };

  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#3b2a52"; // placeholder while a cover loads

    let nearest = 0;
    let best = Infinity;
    for (const [i, x0] of visible()) {
      drawCard(items[i], x0);
      const away = Math.abs(x0 + items[i].w / 2 - W / 2);
      if (away < best) {
        best = away;
        nearest = i;
      }
    }

    if (nearest !== current) {
      current = nearest;
      titleEl.textContent = items[current].title;
      titleEl.href = items[current].href;
      countEl.textContent = `${String(current + 1).padStart(2, "0")} / ${String(items.length).padStart(2, "0")}`;
    }
  }

  // ----- Moving -----
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let frame = 0;

  const glide = () => {
    offset += (target - offset) * 0.16;
    if (Math.abs(target - offset) < 0.5) {
      // Arrived: fold the position back into the first lap so the numbers stay small.
      offset = target = ((target % total) + total) % total;
      frame = 0;
    } else {
      frame = requestAnimationFrame(glide);
    }
    render();
  };

  const moveTo = (point) => {
    target = point;
    if (reduceMotion.matches) {
      offset = target;
      render();
    } else if (!frame) {
      frame = requestAnimationFrame(glide);
    }
  };

  // The cover copy closest to a given point on the strip: [its centre, which cover it is].
  const nearestCentre = (point) => {
    let best = [0, 0];
    let gap = Infinity;
    const lap = Math.floor(point / total);
    for (let k = lap - 1; k <= lap + 1; k++) {
      items.forEach((item, i) => {
        const centre = item.x + item.w / 2 + k * total;
        if (Math.abs(centre - point) < gap) {
          gap = Math.abs(centre - point);
          best = [centre, i];
        }
      });
    }
    return best;
  };

  // Steps from wherever the row is heading, so quick repeated presses each count once.
  const step = (by) => {
    const [here, i] = nearestCentre(target);
    const next = items[(i + by + items.length) % items.length];
    moveTo(here + by * (items[i].w / 2 + GAP + next.w / 2));
  };

  caption.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (button) step(Number(button.dataset.step));
  });

  // Drag to move. A press without a drag is a click: on a side cover it brings that cover
  // to the middle, and on the middle cover it opens the resource.
  let drag = null;
  canvas.addEventListener("pointerdown", (event) => {
    if (event.button) return;
    cancelAnimationFrame(frame);
    frame = 0;
    drag = { startX: event.clientX, startOffset: offset, moved: false };
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add("is-dragging");
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!drag) return;
    const dx = event.clientX - drag.startX;
    if (Math.abs(dx) > 5) drag.moved = true;
    if (drag.moved) {
      offset = target = drag.startOffset - dx;
      render();
    }
  });

  const release = (event) => {
    if (!drag) return;
    const wasDrag = drag.moved;
    drag = null;
    canvas.classList.remove("is-dragging");
    if (wasDrag) return moveTo(nearestCentre(offset)[0]);
    if (event.type !== "pointerup") return;

    const x = event.clientX - canvas.getBoundingClientRect().left;
    const hit = visible().find(([i, x0]) => x >= x0 && x <= x0 + items[i].w);
    if (!hit) return;
    const [i, x0] = hit;
    if (i === current && Math.abs(x0 + items[i].w / 2 - W / 2) < 2) location.assign(items[i].href);
    else moveTo(offset + (x0 + items[i].w / 2 - W / 2));
  };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);

  // Lets other scripts (motion.js) nudge the row, for example in step with page scrolling.
  root.flexCarousel = {
    shift(px) {
      if (drag) return;
      cancelAnimationFrame(frame);
      frame = 0;
      offset = target = offset + px;
      render();
    },
    settle() {
      if (!drag) moveTo(nearestCentre(offset)[0]);
    },
  };

  // ----- Start -----
  layout();

  let lastW = W;
  new ResizeObserver(() => {
    if (root.clientWidth === lastW) return;
    lastW = root.clientWidth;
    layout();
  }).observe(root);

  // Fetch the covers once the carousel is getting close to the screen.
  const loader = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      loader.disconnect();
      for (const item of items) {
        const image = new Image();
        image.onload = () => {
          item.image = image;
          prepare(item);
          render();
        };
        image.src = item.src;
      }
    },
    { rootMargin: "600px" }
  );
  loader.observe(root);
})();
