const INTRO_MESSAGE = "전공이 재밌어지는 순간, 모르노닝고";

export function playIntro() {
  return new Promise((resolve) => {
    const overlay = document.getElementById("intro-overlay");
    const textEl = document.getElementById("intro-text");
    if (!overlay || !textEl) {
      resolve();
      return;
    }

    let index = 0;
    const startTyping = () => {
      const typingInterval = setInterval(() => {
        textEl.textContent = INTRO_MESSAGE.slice(0, index + 1);
        index += 1;
        if (index >= INTRO_MESSAGE.length) {
          clearInterval(typingInterval);
          setTimeout(() => beginFadeOut(overlay, resolve), 700);
        }
      }, 70);
    };

    setTimeout(startTyping, 600);
  });
}

function beginFadeOut(overlay, resolve) {
  overlay.classList.add("fade-out");
  overlay.addEventListener(
    "animationend",
    () => {
      overlay.remove();
      resolve();
    },
    { once: true }
  );
}
