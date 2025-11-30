const INTRO_MESSAGE = "전공이 재밌어지는 순간, 모르노닝고";
const INTRO_VISIBLE_MS = 2200;

export function playIntro() {
  return new Promise((resolve) => {
    const overlay = document.getElementById("intro-overlay");
    const textEl = document.getElementById("intro-text");
    if (!overlay || !textEl) {
      resolve();
      return;
    }

    textEl.textContent = INTRO_MESSAGE;

    const cleanup = () => {
      overlay.removeEventListener("click", handleSkip);
      clearTimeout(timer);
    };

    const closeOverlay = () => {
      if (!overlay.parentNode) {
        resolve();
        return;
      }
      overlay.classList.add("fade-out");
      overlay.addEventListener(
        "animationend",
        () => finishIntro(overlay, resolve),
        { once: true }
      );
      setTimeout(() => finishIntro(overlay, resolve), 900);
    };

    const handleSkip = () => {
      cleanup();
      closeOverlay();
    };

    overlay.addEventListener("click", handleSkip);
    const timer = setTimeout(() => {
      cleanup();
      closeOverlay();
    }, INTRO_VISIBLE_MS);
  });
}

function finishIntro(overlay, resolve) {
  if (overlay.parentNode) {
    overlay.remove();
  }
  resolve();
}
