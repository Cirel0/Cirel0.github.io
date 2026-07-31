const LOOP_COPIES = 3;
const MIDDLE_LOOP = 1;
const VISIBLE_SLOTS = 5;
const CENTER_SLOT = 2;

const state = {
  pages: [],
  reel: [],
  profile: null,
  games: [],
  testimonials: [],
  stats: null,
  activeId: null,
  testimonialIndex: 0,
  /** Absolute index into the tripled track (0 .. 3N-1) */
  visualIndex: 0,
  animating: false,
  animTimer: null,
};

const els = {
  carousel: document.getElementById("carousel"),
  track: null,
  legend: document.getElementById("legend"),
  detail: document.getElementById("detail"),
  leftKicker: document.getElementById("left-kicker"),
  leftTitle: document.getElementById("left-title"),
  leftBody: document.getElementById("left-body"),
  leftTags: document.getElementById("left-tags"),
  clock: document.getElementById("clock"),
  year: document.getElementById("year"),
  linkRoblox: document.getElementById("link-roblox"),
  linkDiscord: document.getElementById("link-discord"),
  wrap: document.querySelector(".carousel-wrap"),
};

function formatNumber(value) {
  const n = Number(value) || 0;
  return new Intl.NumberFormat("en", {
    notation: n >= 10000 ? "compact" : "standard",
    maximumFractionDigits: n >= 10000 ? 1 : 0,
  }).format(n);
}

const ICONS = {
  ccu: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  visits: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`,
};

function statCard(label, value, icon, { live = false } = {}) {
  const liveBadge = live
    ? `<span class="live-badge" aria-label="Live"><span class="live-dot" aria-hidden="true"></span> LIVE</span>`
    : "";
  return `
    <div class="stats-card">
      <div class="stat">
        <div class="stat-head">
          ${liveBadge}
          <span class="stat-label">${label}</span>
          <span class="stat-icon" aria-hidden="true">${ICONS[icon]}</span>
        </div>
        <span class="stat-value">${formatNumber(value)}</span>
      </div>
    </div>
  `;
}

async function loadJSON(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json();
}

function gamePage(game) {
  return {
    id: game.id,
    type: "game",
    label: game.name,
    image: game.image,
    game,
  };
}

function buildPages(profile, games, testimonials) {
  const profilePage = {
    id: "profile",
    type: "profile",
    label: profile.name || "Profile",
    image: profile.avatar,
  };
  const gamePages = games.map(gamePage);
  const testimonialsPage = {
    id: "testimonials",
    type: "testimonials",
    label: "Testimonials",
    image: "assets/testimonials.svg",
    testimonials,
  };

  const pages = [profilePage, ...gamePages, testimonialsPage];

  // Reel: first half of games → Profile → second half → Testimonials
  const mid = Math.ceil(gamePages.length / 2);
  const reel = [
    ...gamePages.slice(0, mid),
    profilePage,
    ...gamePages.slice(mid),
    testimonialsPage,
  ];

  return { pages, reel };
}

function reelCount() {
  return state.reel.length;
}

function logicalIndex(visualIndex = state.visualIndex) {
  const n = reelCount();
  if (!n) return 0;
  return ((visualIndex % n) + n) % n;
}

function slotHeight() {
  const slide = els.carousel?.querySelector(".slide");
  if (slide?.offsetHeight) return slide.offsetHeight;
  const fallback = els.carousel?.clientHeight / VISIBLE_SLOTS;
  return fallback > 0 ? fallback : 168;
}

function trackOffsetFor(visualIndex) {
  // Center slot of the 5-slot viewport aligns with visualIndex
  return (CENTER_SLOT - visualIndex) * slotHeight();
}

function applyTrackTransform({ animate }) {
  if (!els.track) return;
  els.track.classList.toggle("is-jumping", !animate);
  els.track.style.transform = `translate3d(0, ${trackOffsetFor(state.visualIndex)}px, 0)`;
  if (!animate) {
    // Force reflow so the next animated move isn't batched with the jump
    void els.track.offsetHeight;
    els.track.classList.remove("is-jumping");
  }
}

function wrapVisualIndexIfNeeded() {
  const n = reelCount();
  if (!n) return;

  let next = state.visualIndex;
  if (next < n) next += n;
  else if (next >= n * 2) next -= n;

  if (next === state.visualIndex) return;

  state.visualIndex = next;
  applyTrackTransform({ animate: false });
}

function wheelDelta(event) {
  if (event.deltaY) return event.deltaY;
  if (event.deltaX) return event.deltaX;
  if (typeof event.wheelDelta === "number" && event.wheelDelta) {
    return -event.wheelDelta;
  }
  if (typeof event.detail === "number" && event.detail) return event.detail;
  return 0;
}

function renderCarousel() {
  const slides = [];
  for (let loop = 0; loop < LOOP_COPIES; loop += 1) {
    for (const [index, page] of state.reel.entries()) {
      slides.push(`
      <article class="slide" data-id="${page.id}" data-go="${page.id}" data-index="${index}" data-loop="${loop}">
        <div class="slide-card">
          <img src="${page.image}" alt="${page.label}" draggable="false" />
        </div>
      </article>`);
    }
  }

  els.carousel.innerHTML = `<div class="reel-track" id="reel-track">${slides.join("")}</div>`;
  els.track = document.getElementById("reel-track");
  els.track.addEventListener("transitionend", onTrackTransitionEnd);
}

function clearAnimating() {
  state.animating = false;
  if (state.animTimer) {
    window.clearTimeout(state.animTimer);
    state.animTimer = null;
  }
}

function onTrackTransitionEnd(event) {
  if (event.target !== els.track || event.propertyName !== "transform") return;
  clearAnimating();
  wrapVisualIndexIfNeeded();
}

function renderLegend() {
  els.legend.innerHTML = state.pages
    .map(
      (page) => `
      <button type="button" class="legend-btn" data-go="${page.id}">
        ${page.label}
      </button>`
    )
    .join("");
}

function getPage(id) {
  return state.pages.find((page) => page.id === id) || state.pages[0];
}

function reelIndexFor(id) {
  return state.reel.findIndex((page) => page.id === id);
}

function gameStats(gameId) {
  return state.stats?.games?.[gameId] || { playing: 0, visits: 0 };
}

function totals() {
  return state.stats?.totals || { playing: 0, visits: 0 };
}

function renderLeft(page) {
  if (page.type === "profile") {
    els.leftKicker.textContent = "About";
    els.leftTitle.textContent = state.profile.title || "Profile";
    els.leftBody.textContent = state.profile.bio || "";
    els.leftTags.innerHTML = (state.profile.skills || [])
      .map((skill) => `<li>${skill}</li>`)
      .join("");
    return;
  }

  if (page.type === "game") {
    const game = page.game;
    els.leftKicker.textContent = game.role || "Game";
    els.leftTitle.textContent = game.name;
    els.leftBody.textContent = game.blurb || "";
    els.leftTags.innerHTML = (game.tags || [])
      .map((tag) => `<li>${tag}</li>`)
      .join("");
    return;
  }

  els.leftKicker.textContent = "Social proof";
  els.leftTitle.textContent = "Testimonials";
  els.leftBody.textContent =
    "Notes from people I’ve built with. Add your own in data/testimonials.json.";
  els.leftTags.innerHTML = "";
}

function renderDetail(page) {
  if (page.type === "profile") {
    const t = totals();
    els.detail.innerHTML = `
      <div class="stats-stack">
        ${statCard("Total CCU", t.playing, "ccu")}
        ${statCard("Total visits", t.visits, "visits")}
        <p class="panel-body">Across all listed experiences. Stats refresh automatically.</p>
      </div>
    `;
    return;
  }

  if (page.type === "game") {
    const game = page.game;
    const s = gameStats(game.id);
    const playUrl = game.playUrl || (game.placeId ? `https://www.roblox.com/games/${game.placeId}` : null);
    els.detail.innerHTML = `
      <div class="stats-stack">
        ${statCard("Current CCU", s.playing, "ccu", { live: true })}
        ${statCard("Visits", s.visits, "visits")}
        ${
          playUrl
            ? `<a class="play-btn" href="${playUrl}" target="_blank" rel="noopener noreferrer">Play Here <span class="play-btn-icon" aria-hidden="true">↗</span></a>`
            : `<span class="play-btn is-disabled" aria-disabled="true">Play link coming soon</span>`
        }
      </div>
    `;
    return;
  }

  const list = state.testimonials;
  if (!list.length) {
    els.detail.innerHTML = `<p class="panel-body">No testimonials yet.</p>`;
    return;
  }

  const item = list[state.testimonialIndex % list.length];
  els.detail.innerHTML = `
    <blockquote class="quote-block">
      <p>“${item.quote}”</p>
      <div class="quote-meta">
        <strong>${item.name}</strong><br />
        ${item.role}${item.game ? ` · ${item.game}` : ""}
      </div>
    </blockquote>
    <div class="quote-nav" role="tablist" aria-label="Testimonial pages">
      ${list
        .map(
          (_, i) =>
            `<button type="button" data-quote="${i}" class="${
              i === state.testimonialIndex ? "is-active" : ""
            }">0${i + 1}</button>`
        )
        .join("")}
    </div>
  `;
}

function setActive(id) {
  const page = getPage(id);
  if (!page) return;

  state.activeId = page.id;

  document.querySelectorAll(".slide").forEach((slide) => {
    slide.classList.toggle("is-active", slide.dataset.id === page.id);
  });

  document.querySelectorAll(".legend-btn").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.go === page.id);
  });

  renderLeft(page);
  renderDetail(page);
}

function syncActiveFromVisual() {
  const page = state.reel[logicalIndex()];
  if (page) setActive(page.id);
}

function goToVisualIndex(nextIndex, { animate = true } = {}) {
  const n = reelCount();
  if (!n) return;

  const moved = nextIndex !== state.visualIndex;
  state.visualIndex = nextIndex;

  if (!animate || !moved) {
    clearAnimating();
    applyTrackTransform({ animate: false });
    syncActiveFromVisual();
    wrapVisualIndexIfNeeded();
    return;
  }

  state.animating = true;
  if (state.animTimer) window.clearTimeout(state.animTimer);
  state.animTimer = window.setTimeout(() => {
    clearAnimating();
    wrapVisualIndexIfNeeded();
  }, 600);

  applyTrackTransform({ animate: true });
  syncActiveFromVisual();
}

function step(delta) {
  if (!reelCount()) return;
  goToVisualIndex(state.visualIndex + delta, { animate: true });
}

function goToId(id, { animate = true } = {}) {
  const target = reelIndexFor(id);
  if (target < 0) return;

  const n = reelCount();
  const candidates = [target, target + n, target + 2 * n];
  const nearest = candidates.reduce((best, candidate) =>
    Math.abs(candidate - state.visualIndex) < Math.abs(best - state.visualIndex)
      ? candidate
      : best
  );

  goToVisualIndex(nearest, { animate });
}

function updateClock() {
  const now = new Date();
  const formatted = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(now);
  els.clock.textContent = formatted;
}

function setupSocialLinks(profile) {
  const links = profile.links || {};

  if (links.roblox && els.linkRoblox) {
    els.linkRoblox.href = links.roblox;
    els.linkRoblox.hidden = false;
  }

  if (links.discord && els.linkDiscord) {
    els.linkDiscord.href = links.discord;
    els.linkDiscord.hidden = false;
  }
}

function bindEvents() {
  let suppressClick = false;

  document.body.addEventListener("click", (event) => {
    if (suppressClick) {
      event.preventDefault();
      event.stopPropagation();
      suppressClick = false;
      return;
    }

    const go = event.target.closest("[data-go]");
    if (go) {
      event.preventDefault();
      goToId(go.dataset.go, { animate: true });
      return;
    }

    const quoteBtn = event.target.closest("[data-quote]");
    if (quoteBtn) {
      state.testimonialIndex = Number(quoteBtn.dataset.quote) || 0;
      renderDetail(getPage("testimonials"));
    }
  });

  // Capture-phase document listener so wheel works over panels/links and
  // isn't lost when body overflow is hidden (no native page scroll).
  let wheelLock = false;
  let wheelAcc = 0;
  const onWheel = (event) => {
    const target = event.target;
    if (
      target &&
      typeof target.closest === "function" &&
      target.closest("input, textarea, select, [contenteditable='true']")
    ) {
      return;
    }

    const delta = wheelDelta(event);
    if (!delta) return;

    event.preventDefault();

    // Accumulate small pixel deltas (trackpads / smooth-scroll mice)
    wheelAcc += delta;
    const threshold = event.deltaMode === 0 ? 40 : 1;
    if (Math.abs(wheelAcc) < threshold) return;
    if (wheelLock) {
      wheelAcc = 0;
      return;
    }

    const direction = wheelAcc > 0 ? 1 : -1;
    wheelAcc = 0;
    wheelLock = true;
    step(direction);
    window.setTimeout(() => {
      wheelLock = false;
    }, 280);
  };

  document.addEventListener("wheel", onWheel, { passive: false, capture: true });
  // Older mouse drivers still emit mousewheel
  document.addEventListener("mousewheel", onWheel, {
    passive: false,
    capture: true,
  });

  // Vertical swipe on the carousel (phones / touch). Scoped to #carousel so
  // the stacked mobile page can still scroll outside the reel.
  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let swiped = false;
  let swipeLock = false;
  const SWIPE_THRESHOLD = 40;

  const endPointer = (event) => {
    if (pointerId === null || event.pointerId !== pointerId) return;
    if (swiped) {
      suppressClick = true;
      // Clear if no click arrives (e.g. cancelled gesture)
      window.setTimeout(() => {
        suppressClick = false;
      }, 400);
    }
    if (els.carousel.hasPointerCapture?.(pointerId)) {
      els.carousel.releasePointerCapture(pointerId);
    }
    pointerId = null;
    swiped = false;
  };

  els.carousel.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    swiped = false;
  });

  els.carousel.addEventListener(
    "pointermove",
    (event) => {
      if (pointerId === null || event.pointerId !== pointerId || swiped) return;

      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (Math.abs(dy) < SWIPE_THRESHOLD) return;
      // Prefer vertical; ignore mostly-horizontal pans
      if (Math.abs(dy) < Math.abs(dx)) return;

      event.preventDefault();
      swiped = true;
      try {
        els.carousel.setPointerCapture(pointerId);
      } catch {
        // Ignore if capture fails mid-gesture
      }
      if (swipeLock) return;

      swipeLock = true;
      step(dy > 0 ? -1 : 1);
      window.setTimeout(() => {
        swipeLock = false;
      }, 280);
    },
    { passive: false }
  );

  els.carousel.addEventListener("pointerup", endPointer);
  els.carousel.addEventListener("pointercancel", endPointer);

  window.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    step(event.key === "ArrowDown" ? 1 : -1);
  });

  let resizeTick = false;
  window.addEventListener("resize", () => {
    if (resizeTick) return;
    resizeTick = true;
    requestAnimationFrame(() => {
      resizeTick = false;
      applyTrackTransform({ animate: false });
      wrapVisualIndexIfNeeded();
    });
  });
}

async function init() {
  els.year.textContent = String(new Date().getFullYear());
  updateClock();
  window.setInterval(updateClock, 30_000);

  const [profile, games, testimonials, stats] = await Promise.all([
    loadJSON("data/profile.json"),
    loadJSON("data/games.json"),
    loadJSON("data/testimonials.json"),
    loadJSON("data/stats.json"),
  ]);

  state.profile = profile;
  state.games = games;
  state.testimonials = testimonials;
  state.stats = stats;

  const { pages, reel } = buildPages(profile, games, testimonials);
  state.pages = pages;
  state.reel = reel;

  renderCarousel();
  renderLegend();
  setupSocialLinks(profile);
  bindEvents();

  const profileIndex = reelIndexFor("profile");
  const startIndex =
    profileIndex >= 0
      ? MIDDLE_LOOP * reelCount() + profileIndex
      : MIDDLE_LOOP * reelCount();

  goToVisualIndex(startIndex, { animate: false });

  document.body.classList.add("is-ready");
}

init().catch((error) => {
  console.error(error);
  els.leftTitle.textContent = "Couldn’t load portfolio data";
  els.leftBody.textContent = String(error.message || error);
});
