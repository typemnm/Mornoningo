const SUBTITLE_MAP = {
  home: "오늘 해야 할 것만 명확하게",
  ranking: "친구들과 경쟁하며 성장",
  quiz: "학습 자료 & 퀴즈 허브",
  schedule: "기억 정착 & 장기 리텐션",
  profile: "동기부여 & 성장 기록",
};

const ROUTES = new Set(Object.keys(SUBTITLE_MAP));
let currentRoute = "home";
let isRoutingFromHash = false;

export function initRouter() {
  window.addEventListener("hashchange", () => {
    isRoutingFromHash = true;
    switchScreen(parseRoute(location.hash), { skipHash: true });
    isRoutingFromHash = false;
  });

  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => switchScreen(btn.dataset.target));
  });

  switchScreen(parseRoute(location.hash), { skipHash: true });
}

export function switchScreen(name, { skipHash } = {}) {
  const route = sanitizeRoute(name);
  if (!skipHash && !isRoutingFromHash) {
    const targetHash = `#${route}`;
    if (window.location.hash !== targetHash) {
      window.location.hash = route;
    }
  }

  if (currentRoute === route) {
    updateActiveState(route);
    return;
  }

  currentRoute = route;
  updateActiveState(route);
}

function updateActiveState(route) {
  document.querySelectorAll(".screen").forEach((screen) => {
    screen.classList.remove("active");
  });
  document.getElementById(`screen-${route}`)?.classList.add("active");

  document.querySelectorAll(".nav-item").forEach((nav) => {
    nav.classList.toggle("active", nav.dataset.target === route);
  });

  const subtitle = document.getElementById("header-subtitle");
  if (subtitle) subtitle.textContent = SUBTITLE_MAP[route] || "모르노닝고";
}

function parseRoute(hash) {
  const value = (hash || "").replace(/^#/, "");
  return sanitizeRoute(value || "home");
}

function sanitizeRoute(value) {
  return ROUTES.has(value) ? value : "home";
}
