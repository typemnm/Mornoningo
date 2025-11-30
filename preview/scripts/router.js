const ROUTES = new Set(["home", "ranking", "quiz", "schedule", "profile"]);
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

}

function parseRoute(hash) {
  const value = (hash || "").replace(/^#/, "");
  return sanitizeRoute(value || "home");
}

function sanitizeRoute(value) {
  return ROUTES.has(value) ? value : "home";
}
