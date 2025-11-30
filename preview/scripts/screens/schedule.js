import { getState } from "../state.js";
import { todayStr } from "../utils/date.js";

const STAGE_DAY_MAP = {
  1: 1,
  2: 3,
  3: 7,
  4: 14,
};

export function renderSchedule({ onStartQuiz }) {
  const state = getState();
  const listEl = document.getElementById("review-list");
  const emptyHint = document.getElementById("review-empty-hint");

  const today = todayStr();
  const due = state.reviews
    .filter((review) => review.dueDate <= today)
    .sort((a, b) => b.priority - a.priority);

  listEl.innerHTML = "";
  if (!due.length) {
    emptyHint.style.display = "block";
    renderRecommendations(state);
    return;
  }

  emptyHint.style.display = "none";

  due.forEach((review) => {
    const doc = state.docs.find((d) => d.id === review.docId);
    if (!doc) return;

    const li = document.createElement("li");
    li.className = "review-item";

    const head = document.createElement("div");
    head.className = "review-item-header";
    const title = document.createElement("span");
    title.textContent = doc.title;
    const tag = document.createElement("span");
    tag.textContent = `D+${review.stage} · 우선순위 ${review.priority}`;
    tag.style.fontSize = "11px";
    tag.style.color = "var(--color-primary)";
    head.appendChild(title);
    head.appendChild(tag);

    const sub = document.createElement("div");
    sub.className = "review-item-sub";
    sub.textContent = `예정일: ${review.dueDate}`;

    const btn = document.createElement("button");
    btn.className = "btn-primary";
    btn.textContent = "퀴즈 시작";
    btn.addEventListener("click", () => onStartQuiz(doc.id));

    li.appendChild(head);
    li.appendChild(sub);
    li.appendChild(btn);
    listEl.appendChild(li);
  });

  renderRecommendations(state);
}

function renderRecommendations(state) {
  const list = document.getElementById("forgetting-reco-list");
  if (!list) return;

  const today = todayStr();
  const stages = [1, 2, 3, 4];
  list.innerHTML = "";

  stages.forEach((stage) => {
    const day = STAGE_DAY_MAP[stage];
    const candidate = findRecommendation(state, stage, today);
    const li = document.createElement("li");
    li.className = "recommend-item";

    const stageLabel = document.createElement("div");
    stageLabel.className = "recommend-stage";
    stageLabel.textContent = day ? `${day}일차` : `Stage ${stage}`;

    const meta = document.createElement("div");
    meta.className = "recommend-meta";

    const title = document.createElement("p");
    title.className = "recommend-title";
    title.textContent = candidate?.doc?.title || "추천할 학습 자료가 필요해요";

    const date = document.createElement("p");
    date.className = "recommend-date";
    if (candidate?.review) {
      const dueLabel = candidate.review.dueDate <= today ? "오늘" : candidate.review.dueDate;
      date.textContent = `${dueLabel} · D+${stage} 복습`; 
    } else {
      date.textContent = `${day || ""}일차 복습을 위해 자료를 추가해 보세요.`;
    }

    meta.appendChild(title);
    meta.appendChild(date);

    li.appendChild(stageLabel);
    li.appendChild(meta);
    list.appendChild(li);
  });
}

function findRecommendation(state, stage, today) {
  const matches = state.reviews
    .filter((review) => review.stage === stage)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  if (!matches.length) return null;

  const due = matches.find((review) => review.dueDate >= today) || matches[0];
  const doc = state.docs.find((d) => d.id === due.docId);
  return { review: due, doc };
}
