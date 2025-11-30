import { getState } from "../state.js";
import { todayStr } from "../utils/date.js";

export function renderHome() {
  const state = getState();
  const today = todayStr();
  const dueReviews = state.reviews.filter((review) => review.dueDate <= today);
  const reviewSummary = document.getElementById("home-review-summary");
  reviewSummary.textContent = `오늘 복습할 퀴즈 ${dueReviews.length}개`;

  const docs = state.docs;
  const avg =
    docs.length === 0
      ? 0
      : Math.round(
          docs.reduce((sum, doc) => sum + (doc.progress || 0), 0) / docs.length
        );
  document.getElementById("home-progress-percent").textContent = avg;
  document.getElementById("home-progress-bar").style.width = `${avg}%`;
  document.getElementById(
    "home-streak"
  ).textContent = `🔥 ${state.user.streak}일 연속 달성`;

  const recommended = docs.length
    ? [...docs].sort((a, b) => (a.progress || 0) - (b.progress || 0))[0]
    : null;
  const recTitle = document.getElementById("home-recommend-title");
  recTitle.textContent = recommended
    ? `${recommended.title} 개념 정리 →`
    : "업로드 후 추천 카드가 여기에 표시됩니다.";

  const diff = state.user.bestRankDiff || 0;
  document.getElementById(
    "home-ranking-summary"
  ).textContent = `김철수보다 +${diff}점 ↑`;
}
