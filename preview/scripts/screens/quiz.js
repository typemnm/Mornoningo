import { API_BASE } from "../constants.js";
import { getState, saveState } from "../state.js";
import { runtime } from "../runtime.js";
import { addDays, todayStr } from "../utils/date.js";

const DEFAULT_DECOYS = [
  "자료 구조 비교",
  "시간 복잡도 정의",
  "알고리즘 최적화",
  "네트워크 계층",
  "데이터베이스 정규화",
  "머신러닝 기본",
];

let quizCallbacks = {
  onStateChange: () => {},
};

export function configureQuiz({ onStateChange }) {
  quizCallbacks.onStateChange = onStateChange;
}

export async function startQuizForDoc(docId) {
  const state = getState();
  const doc = state.docs.find((d) => d.id === docId);
  if (!doc) return;

  const statusEl = document.getElementById("quiz-status");
  statusEl.textContent = `"${doc.title}" 퀴즈 생성 준비 중...`;

  try {
    const questions = await generateQuestionsForDocAI(doc);
    runtime.currentQuiz = {
      docId,
      questions,
      currentIndex: 0,
      score: 0,
      finished: false,
    };
    runtime.selectedOptionIndex = null;
    statusEl.textContent = `"${doc.title}" 퀴즈 시작합니다!`;
    renderQuizQuestion();
  } catch (err) {
    alert("AI 퀴즈 생성 실패: " + err.message);
    statusEl.textContent = "퀴즈 생성 실패.";
  }
}

export function startQuickRandomQuiz() {
  const state = getState();
  if (!state.docs.length) {
    alert("먼저 학습 자료를 업로드해 주세요.");
    return;
  }

  const doc = state.docs[Math.floor(Math.random() * state.docs.length)];
  const questions = generateLocalQuestions(doc).slice(0, 5);

  runtime.currentQuiz = {
    docId: doc.id,
    questions,
    currentIndex: 0,
    score: 0,
    finished: false,
  };
  runtime.selectedOptionIndex = null;
  document.getElementById(
    "quiz-status"
  ).textContent = `"${doc.title}" 기반 랜덤 5문제 퀴즈입니다.`;
  renderQuizQuestion();
}

export function renderQuizQuestion() {
  const body = document.getElementById("quiz-body");
  const counter = document.getElementById("quiz-counter");
  const scoreEl = document.getElementById("quiz-score");
  const qEl = document.getElementById("quiz-question");
  const optsEl = document.getElementById("quiz-options");
  const feedbackEl = document.getElementById("quiz-feedback");
  const submitBtn = document.getElementById("btn-submit-answer");

  if (!runtime.currentQuiz || runtime.currentQuiz.finished) {
    runtime.selectedOptionIndex = null;
    body.classList.add("hidden");
    feedbackEl.textContent = "";
    submitBtn.disabled = true;
    return;
  }

  const { questions, currentIndex, score } = runtime.currentQuiz;
  const question = questions[currentIndex];
  body.classList.remove("hidden");
  counter.textContent = `문제 ${currentIndex + 1}/${questions.length}`;
  scoreEl.textContent = `점수 ${score}`;
  qEl.textContent = question.q;

  optsEl.innerHTML = "";
  runtime.selectedOptionIndex = null;
  submitBtn.disabled = true;
  feedbackEl.textContent = "";

  question.opts.forEach((opt, idx) => {
    const btn = document.createElement("button");
    btn.className = "quiz-option";
    btn.textContent = opt;
    btn.addEventListener("click", () => {
      runtime.selectedOptionIndex = idx;
      document.querySelectorAll(".quiz-option").forEach((optionEl) => {
        optionEl.classList.remove("selected");
      });
      btn.classList.add("selected");
      submitBtn.disabled = false;
    });
    optsEl.appendChild(btn);
  });
}

export function handleSubmitAnswer() {
  if (!runtime.currentQuiz || runtime.currentQuiz.finished) return;
  if (runtime.selectedOptionIndex === null) return;

  const { questions, currentIndex } = runtime.currentQuiz;
  const question = questions[currentIndex];
  const feedbackEl = document.getElementById("quiz-feedback");

  const isCorrect = runtime.selectedOptionIndex === question.correct;
  if (isCorrect) {
    runtime.currentQuiz.score += 10;
    feedbackEl.textContent = "정답입니다! +10점";
    feedbackEl.style.color = "#16a34a";
  } else {
    feedbackEl.textContent = `오답입니다. 정답: ${
      question.opts[question.correct]
    }`;
    feedbackEl.style.color = "#dc2626";
  }

  updateAggregates(isCorrect);
  setTimeout(moveToNextQuestion, 800);
}

function moveToNextQuestion() {
  if (!runtime.currentQuiz) return;

  if (runtime.currentQuiz.currentIndex < runtime.currentQuiz.questions.length - 1) {
    runtime.currentQuiz.currentIndex += 1;
    renderQuizQuestion();
  } else {
    finishQuiz();
  }
}

function updateAggregates(isCorrect) {
  const state = getState();
  state.user.totalAnswers += 1;
  if (isCorrect) state.user.correctAnswers += 1;

  const doc = state.docs.find((d) => d.id === runtime.currentQuiz.docId);
  if (doc) {
    if (!doc.quizStats) {
      doc.quizStats = { attempts: 0, correct: 0, total: 0 };
    }
    doc.quizStats.attempts += 1;
    doc.quizStats.total += 1;
    if (isCorrect) doc.quizStats.correct += 1;
    doc.progress = Math.min(100, (doc.progress || 0) + (isCorrect ? 5 : 2));
  }

  saveState();
  quizCallbacks.onStateChange();
}

function finishQuiz() {
  if (!runtime.currentQuiz) return;
  runtime.currentQuiz.finished = true;
  const state = getState();
  document.getElementById(
    "quiz-status"
  ).textContent = `퀴즈 완료! 총 점수: ${runtime.currentQuiz.score}점`;

  state.user.totalMinutes += 3;
  state.user.streak = Math.min(state.user.streak + 1, 365);

  const doc = state.docs.find((d) => d.id === runtime.currentQuiz.docId);
  let wrongRate = 0.5;
  if (doc && doc.quizStats && doc.quizStats.total) {
    wrongRate = 1 - doc.quizStats.correct / doc.quizStats.total;
  }

  if (doc) {
    scheduleReviewsForDoc(doc.id, wrongRate);
  }

  saveState();
  quizCallbacks.onStateChange();
  renderQuizQuestion();
}

function scheduleReviewsForDoc(docId, wrongRate) {
  const state = getState();
  const today = todayStr();
  state.reviews.forEach((review) => {
    if (review.docId === docId && review.dueDate >= today) {
      review.priority = 1 + Math.round(wrongRate * 3);
    }
  });

  [1, 3, 7, 14].forEach((d, idx) => {
    state.reviews.push({
      id: `rev_${docId}_extra_${Date.now()}_${d}`,
      docId,
      dueDate: addDays(today, d),
      stage: idx + 1,
      priority: 1 + Math.round(wrongRate * 3),
    });
  });
}

async function generateQuestionsForDocAI(doc) {
  if (!doc.fileId) {
    throw new Error("fileId가 없어 서버에서 문서 내용을 읽을 수 없습니다.");
  }

  const res = await fetch(`${API_BASE}/api/generate-quiz-from-file`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileId: doc.fileId, numQuestions: 5 }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error("퀴즈 생성 실패: " + (data.error || "unknown"));
  }

  return data.questions.map((q) => ({
    q: q.question,
    opts: q.options,
    correct: q.correctIndex,
    explanation: q.explanation,
  }));
}

function generateLocalQuestions(doc) {
  const topics = (doc.notes || "")
    .split(/\n|-/)
    .map((line) => line.trim())
    .filter(Boolean);

  const pool = topics.length ? topics : [doc.title.replace(/\.[^.]+$/, "")];

  return pool.map((topic, idx) => buildQuestionFromTopic(topic, doc.title, idx));
}

function buildQuestionFromTopic(topic, docTitle, idx) {
  const baseQuestion = `${docTitle} 학습 내용 중 핵심 개념을 고르세요.`;
  const decoys = getDecoyOptions(topic, idx);
  const options = shuffle([topic, ...decoys]).slice(0, 4);
  const correct = options.indexOf(topic);

  return {
    q: baseQuestion,
    opts: options,
    correct: correct === -1 ? 0 : correct,
    explanation: `${topic} 관련 핵심 개념입니다.`,
  };
}

function getDecoyOptions(answer, seed) {
  const filtered = DEFAULT_DECOYS.filter((item) => item !== answer);
  const decoys = [];
  for (let i = 0; i < filtered.length && decoys.length < 3; i += 1) {
    const index = (seed + i) % filtered.length;
    decoys.push(filtered[index]);
  }
  while (decoys.length < 3) {
    decoys.push(filtered[Math.floor(Math.random() * filtered.length)] || "심화 학습");
  }
  return decoys;
}

function shuffle(arr) {
  return arr
    .map((value) => ({ value, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ value }) => value);
}
