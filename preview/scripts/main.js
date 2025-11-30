import { loadState } from "./state.js";
import { runtime } from "./runtime.js";
import { initRouter, switchScreen } from "./router.js";
import { playIntro } from "./intro.js";
import { renderHome } from "./screens/home.js";
import { renderDocsList, setupUpload } from "./screens/library.js";
import { renderSchedule } from "./screens/schedule.js";
import { renderProfile } from "./screens/profile.js";
import { renderRanking } from "./screens/ranking.js";
import {
  configureQuiz,
  handleSubmitAnswer,
  renderQuizQuestion,
  startQuickRandomQuiz,
  startQuizForDoc,
} from "./screens/quiz.js";

function init() {
  loadState();
  initRouter();
  configureQuiz({ onStateChange: renderAll });
  setupUpload({ onAfterUpload: renderAll });
  initEvents();
  renderAll();
  playIntro().then(() => switchScreen("home"));
}

document.addEventListener("DOMContentLoaded", init);

function renderAll() {
  renderHome();
  renderDocsList({
    onStartQuiz: startQuizFlow,
    onAfterChange: renderAll,
  });
  renderSchedule({ onStartQuiz: startQuizFlow });
  renderProfile();
  renderQuizQuestion();
  renderRanking();
}

function startQuizFlow(docId) {
  if (!docId) return;
  startQuizForDoc(docId);
  switchScreen("quiz");
}

function initEvents() {
  document
    .getElementById("btn-go-review")
    ?.addEventListener("click", () => switchScreen("schedule"));

  document
    .getElementById("btn-new-quiz")
    ?.addEventListener("click", () => {
      startQuickRandomQuiz();
      switchScreen("quiz");
    });

  document
    .getElementById("btn-go-quiz")
    ?.addEventListener("click", () => switchScreen("quiz"));

  document
    .getElementById("btn-start-doc-quiz")
    ?.addEventListener("click", () => {
      if (!runtime.currentDocId) return;
      startQuizFlow(runtime.currentDocId);
    });

  document
    .getElementById("btn-show-notes")
    ?.addEventListener("click", () => {
      const el = document.getElementById("doc-notes");
      if (!el) return;
      el.style.display = el.style.display === "none" ? "block" : "none";
    });

  document
    .getElementById("btn-submit-answer")
    ?.addEventListener("click", handleSubmitAnswer);

  document
    .getElementById("btn-quick-quiz")
    ?.addEventListener("click", () => {
      startQuickRandomQuiz();
    });

  document
    .getElementById("toggle-notifications")
    ?.addEventListener("change", (event) => {
      if (event.target.checked) {
        alert("알림이 켜졌다고 가정합니다. (실제 푸시는 서버/앱이 필요)");
      }
    });
}
