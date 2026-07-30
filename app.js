const state = {
  pages: [],
  profile: null,
  games: [],
  testimonials: [],
  stats: null,
  activeId: null,
  testimonialIndex: 0,
  syncing: false,
};

const els = {
  carousel: document.getElementById("carousel"),
  legend: document.getElementById("legend"),
  detail: document.getElementById("detail"),
  leftKicker: document.getElementById("left-kicker"),
  leftTitle: document.getElementById("left-title"),
  leftBody: document.getElementById("left-body"),
  leftTags: document.getElementById("left-tags"),
  clock: document.getElementById("clock"),
  year: document.getElementById("year"),
  contactLink: document.getElementById("contact-link"),
  contactDock: document.getElementById("contact"),
  contactText: document.getElementById("contact-text"),
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

function statCard(label, value, icon) {
  return `
    <div class="stat">
      <div class="stat-head">
        <span class="stat-label">${label}</span>
        <span class="stat-icon" aria-hidden="true">${ICONS[icon]}</span>
      </div>
      <span class="stat-value">${formatNumber(value)}</span>
    </div>
  `;
}

async function loadJSON(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json();
}

function buildPages(profile, games, testimonials) {
  const pages = [
    {
      id: "profile",
      type: "profile",
      label: profile.name || "Profile",
      image: profile.avatar,
    },
    ...games.map((game) => ({
      id: game.id,
      type: "game",
      label: game.name,
      image: game.image,
      game,
    })),
    {
      id: "testimonials",
      type: "testimonials",
      label: "Testimonials",
      image: "assets/testimonials.svg",
      testimonials,
    },
  ];
  return pages;
}

function renderCarousel() {
  els.carousel.innerHTML = state.pages
    .map(
      (page, index) => `
      <article class="slide" data-id="${page.id}" data-index="${index}">
        <div class="slide-card">
          <img src="${page.image}" alt="${page.label}" draggable="false" />
        </div>
      </article>`
    )
    .join("");
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
      <div class="stat-grid">
        ${statCard("Total CCU", t.playing, "ccu")}
        ${statCard("Total visits", t.visits, "visits")}
      </div>
      <p class="panel-body">Across all listed experiences. Stats refresh automatically.</p>
    `;
    return;
  }

  if (page.type === "game") {
    const game = page.game;
    const s = gameStats(game.id);
    const playUrl = game.playUrl || (game.placeId ? `https://www.roblox.com/games/${game.placeId}` : null);
    els.detail.innerHTML = `
      <div class="stat-grid">
        ${statCard("Current CCU", s.playing, "ccu")}
        ${statCard("Visits", s.visits, "visits")}
      </div>
      ${
        playUrl
          ? `<a class="play-btn" href="${playUrl}" target="_blank" rel="noopener noreferrer">Play Here</a>`
          : `<span class="play-btn is-disabled" aria-disabled="true">Play link coming soon</span>`
      }
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

function setActive(id, { scroll = false } = {}) {
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

  if (scroll) {
    const slide = els.carousel.querySelector(`[data-id="${page.id}"]`);
    if (slide) {
      state.syncing = true;
      slide.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => {
        state.syncing = false;
      }, 450);
    }
  }
}

function nearestSlideId() {
  const slides = [...els.carousel.querySelectorAll(".slide")];
  const rootRect = els.carousel.getBoundingClientRect();
  const mid = rootRect.top + rootRect.height / 2;
  let best = null;
  let bestDist = Infinity;

  for (const slide of slides) {
    const rect = slide.getBoundingClientRect();
    const slideMid = rect.top + rect.height / 2;
    const dist = Math.abs(slideMid - mid);
    if (dist < bestDist) {
      bestDist = dist;
      best = slide.dataset.id;
    }
  }
  return best;
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

function setupContact(profile) {
  const links = profile.links || {};
  const parts = [];

  if (links.email) {
    parts.push(`<a href="mailto:${links.email}">${links.email}</a>`);
  }
  if (links.discord) {
    parts.push(`Discord: ${links.discord}`);
  }
  if (links.devforum) {
    parts.push(
      `<a href="${links.devforum}" target="_blank" rel="noopener noreferrer">DevForum</a>`
    );
  }
  if (links.roblox) {
    parts.push(
      `<a href="${links.roblox}" target="_blank" rel="noopener noreferrer">Roblox profile</a>`
    );
  }

  if (!parts.length) {
    els.contactText.textContent =
      "Add contact links in data/profile.json when you’re ready.";
  } else {
    els.contactText.innerHTML = parts.join("<br />");
  }

  els.contactLink.addEventListener("click", (event) => {
    event.preventDefault();
    els.contactDock.hidden = !els.contactDock.hidden;
  });
}

function bindEvents() {
  document.body.addEventListener("click", (event) => {
    const go = event.target.closest("[data-go]");
    if (go) {
      event.preventDefault();
      setActive(go.dataset.go, { scroll: true });
      return;
    }

    const quoteBtn = event.target.closest("[data-quote]");
    if (quoteBtn) {
      state.testimonialIndex = Number(quoteBtn.dataset.quote) || 0;
      renderDetail(getPage("testimonials"));
    }
  });

  let scrollTick = false;
  els.carousel.addEventListener("scroll", () => {
    if (state.syncing || scrollTick) return;
    scrollTick = true;
    requestAnimationFrame(() => {
      scrollTick = false;
      const id = nearestSlideId();
      if (id && id !== state.activeId) setActive(id);
    });
  });

  window.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const index = state.pages.findIndex((page) => page.id === state.activeId);
    if (index < 0) return;
    event.preventDefault();
    const next =
      event.key === "ArrowDown"
        ? Math.min(state.pages.length - 1, index + 1)
        : Math.max(0, index - 1);
    setActive(state.pages[next].id, { scroll: true });
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
  state.pages = buildPages(profile, games, testimonials);

  renderCarousel();
  renderLegend();
  setupContact(profile);
  bindEvents();
  setActive(state.pages[0]?.id || "profile");
  document.body.classList.add("is-ready");
}

init().catch((error) => {
  console.error(error);
  els.leftTitle.textContent = "Couldn’t load portfolio data";
  els.leftBody.textContent = String(error.message || error);
});
