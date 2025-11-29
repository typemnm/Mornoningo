// app.js

const STORAGE_KEY = "mornoning_app_state_v1";
// 배포 시 동일 호스트에서 제공하도록 상대 경로 사용. 필요한 경우 절대 URL로 덮어쓰세요.
const API_BASE = ""; // e.g., "https://your-domain.com"

let state = null;
let currentDocId = null;
let currentQuiz = null;
let selectedOptionIndex = null;

async function fetchQuizFromAI({ sourceText, numQuestions = 5 }) {
  const res = await fetch(`${API_BASE}/api/generate-quiz`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceText, numQuestions }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "퀴즈 생성 API 오류");
  }

  const data = await res.json();
  return data.questions; // [{question, options, correctIndex, explanation}, ...]
}

async function uploadFileToServer(file) {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${API_BASE}/api/upload`, {
    method: "POST",
    body: form
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error("파일 업로드 실패: " + (err.error || "unknown"));
  }

  return await res.json(); // { ok: true, fileId, originalName }
}

// ====== 상태 관리 ======
function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    state = createSampleState();
    saveState();
    return;
  }
  try {
    state = JSON.parse(raw);
  } catch (e) {
    console.error("Failed to parse state, reset.", e);
    state = createSampleState();
    saveState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(base, days) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ====== 초기 샘플 데이터 ======
function createSampleState() {
  const today = todayStr();
  const docs = [
    {
      id: "doc_os",
      title: "운영체제 개론.pptx",
      type: "pptx",
      progress: 78,
      conceptsCount: 23,
      createdAt: today,
      notes:
        "- 프로세스/스레드 개념 정리\n- 프로세스 상태 전이\n- 스케줄링 알고리즘(FCFS, SJF, RR)\n- 동기화와 세마포어\n- 교착상태 조건",
      quizStats: { attempts: 2, correct: 15, total: 20 },
    },
    {
      id: "doc_ds",
      title: "자료구조 개념 정리.pdf",
      type: "pdf",
      progress: 56,
      conceptsCount: 18,
      createdAt: today,
      notes:
        "- 배열, 연결리스트 비교\n- 스택/큐, 덱\n- 트리/그래프 기본 용어\n- 시간 복잡도 개념(O, Ω, Θ)",
      quizStats: { attempts: 1, correct: 6, total: 10 },
    },
  ];

  // 샘플 복습(1/3/7/14일 큐 일부만 생성)
  const reviews = [];
  docs.forEach((doc, idx) => {
    const base = addDays(today, idx === 0 ? 0 : -1);
    [1, 3, 7, 14].forEach((d, stage) => {
      reviews.push({
        id: `rev_${doc.id}_${d}`,
        docId: doc.id,
        dueDate: addDays(base, d),
        stage: stage + 1,
        priority: 1,
      });
    });
  });

  return {
    user: {
      name: "Data Rookie",
      level: 12,
      streak: 3,
      totalMinutes: 13 * 60 + 22,
      totalAnswers: 30,
      correctAnswers: 21,
      bestRankDiff: 23,
    },
    docs,
    reviews,
    lastLoginDate: today,
    quizSessions: [],
  };
}

// ====== 네비게이션 ======
function setupNavigation() {
  const navItems = document.querySelectorAll(".nav-item");
  navItems.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-target");
      switchScreen(target);
    });
  });
}

function switchScreen(name) {
  document
    .querySelectorAll(".screen")
    .forEach((s) => s.classList.remove("active"));
  const screen = document.getElementById(`screen-${name}`);
  if (screen) screen.classList.add("active");

  document
    .querySelectorAll(".nav-item")
    .forEach((n) => n.classList.remove("active"));
  document
    .querySelector(`.nav-item[data-target="${name}"]`)
    ?.classList.add("active");

  // 헤더 서브타이틀 약간 변경
  const subtitle = document.getElementById("header-subtitle");
  const map = {
    home: "오늘 해야 할 것만 명확하게",
    library: "학습 콘텐츠 관리 중심",
    quiz: "성취감 & 경쟁심 유발",
    schedule: "기억 정착 & 장기 리텐션",
    profile: "동기부여 & 성장 기록",
  };
  subtitle.textContent = map[name] || "모르노닝고";
}

// ====== 홈 렌더 ======
function renderHome() {
  const today = todayStr();
  const dueReviews = state.reviews.filter((r) => r.dueDate <= today);
  const reviewSummary = document.getElementById("home-review-summary");
  reviewSummary.textContent = `오늘 복습할 퀴즈 ${dueReviews.length}개`;

  // 진도: 모든 문서 progress 평균
  const docs = state.docs;
  const avg =
    docs.length === 0
      ? 0
      : Math.round(
          docs.reduce((s, d) => s + (d.progress || 0), 0) / docs.length
        );
  document.getElementById("home-progress-percent").textContent = avg;
  document.getElementById("home-progress-bar").style.width = `${avg}%`;

  document.getElementById(
    "home-streak"
  ).textContent = `🔥 ${state.user.streak}일 연속 달성`;

  // 추천 카드: 진도 낮거나 복습 임박한 문서
  let recommended = null;
  if (docs.length > 0) {
    recommended = [...docs].sort((a, b) => (a.progress || 0) - (b.progress || 0))[0];
  }
  const recTitle = document.getElementById("home-recommend-title");
  if (recommended) {
    recTitle.textContent = `${recommended.title} 개념 정리 →`;
  } else {
    recTitle.textContent = "업로드 후 추천 카드가 여기에 표시됩니다.";
  }

  // 랭킹 요약
  const diff = state.user.bestRankDiff || 0;
  document.getElementById(
    "home-ranking-summary"
  ).textContent = `김철수보다 +${diff}점 ↑`;
}

// ====== 라이브러리 렌더 ======
function renderDocsList() {
  const listEl = document.getElementById("doc-list");
  const emptyHint = document.getElementById("doc-empty-hint");
  listEl.innerHTML = "";

  if (state.docs.length === 0) {
    emptyHint.style.display = "block";
    document.getElementById("doc-detail-card").style.display = "none";
    return;
  }
  emptyHint.style.display = "none";

  state.docs.forEach((doc) => {
    const li = document.createElement("li");
    li.className = "doc-item";

    const title = document.createElement("div");
    title.className = "doc-title";
    title.textContent = doc.title;

    const meta = document.createElement("div");
    meta.className = "doc-meta";
    meta.textContent = `${doc.progress || 0}% 완료 · 개념 ${
      doc.conceptsCount || 0
    }개`;

    const btnRow = document.createElement("div");
    btnRow.className = "button-row";

    const btnDetail = document.createElement("button");
    btnDetail.className = "btn-secondary";
    btnDetail.textContent = "상세 보기";
    btnDetail.addEventListener("click", () => showDocDetail(doc.id));

    const btnQuiz = document.createElement("button");
    btnQuiz.className = "btn-primary";
    btnQuiz.textContent = "퀴즈 풀기";
    btnQuiz.addEventListener("click", () => {
      showDocDetail(doc.id);
      startQuizForDoc(doc.id);
      switchScreen("quiz");
    });

    const btnDelete = document.createElement("button");
    btnDelete.className = "icon-button";
    btnDelete.innerHTML = "🗑️";
    btnDelete.title = "삭제";
    btnDelete.addEventListener("click", () => deleteDoc(doc.id));

    btnRow.appendChild(btnDetail);
    btnRow.appendChild(btnQuiz);
    btnRow.appendChild(btnDelete);

    li.appendChild(title);
    li.appendChild(meta);
    li.appendChild(btnRow);

    listEl.appendChild(li);
  });
}

function showDocDetail(docId) {
  const doc = state.docs.find((d) => d.id === docId);
  if (!doc) return;
  currentDocId = docId;

  const card = document.getElementById("doc-detail-card");
  card.style.display = "block";

  document.getElementById("doc-detail-title").textContent = doc.title;
  document.getElementById(
    "doc-detail-progress"
  ).textContent = `${doc.progress || 0}% 완료`;
  document.getElementById("doc-detail-concepts").textContent =
    doc.conceptsCount || 0;

  const stats = doc.quizStats || { correct: 0, total: 0 };
  const elStats = document.getElementById("doc-quiz-stats");
  if (!stats.total) {
    elStats.textContent = "아직 퀴즈 기록이 없습니다.";
  } else {
    const acc = Math.round((stats.correct / stats.total) * 100);
    elStats.textContent = `총 ${stats.total}문제, 정답률 ${acc}%`;
  }

  const notesEl = document.getElementById("doc-notes");
  notesEl.textContent = doc.notes || "자동 생성된 개념노트가 여기에 표시됩니다.";
  notesEl.style.display = "none";
}

function deleteDoc(docId) {
  const doc = state.docs.find((d) => d.id === docId);
  if (!doc) return;
  const ok = confirm(`"${doc.title}" 학습 자료를 삭제할까요?`);
  if (!ok) return;

  state.docs = state.docs.filter((d) => d.id !== docId);
  state.reviews = state.reviews.filter((r) => r.docId !== docId);

  if (currentDocId === docId) {
    currentDocId = null;
    document.getElementById("doc-detail-card").style.display = "none";
  }

  if (currentQuiz && currentQuiz.docId === docId) {
    currentQuiz = null;
    selectedOptionIndex = null;
    document.getElementById("quiz-status").textContent =
      "삭제된 자료의 퀴즈가 종료되었습니다.";
    renderQuizQuestion();
  }

  saveState();
  renderDocsList();
  renderHome();
  renderSchedule();
  renderProfile();
}

function setupUpload() {
  const input = document.getElementById("file-input");

  input.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    for (const file of files) {
      try {
        // 1) 파일 서버 업로드
        const uploaded = await uploadFileToServer(file);
        const fileId = uploaded.fileId;

        // 2) 문서 데이터 상태에 추가
        const id = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        state.docs.push({
          id,
          fileId,                    // 🔥 가장 중요: 서버 파일명
          title: uploaded.originalName,
          type: uploaded.originalName.split(".").pop(),
          progress: 0,
          conceptsCount: 0,
          createdAt: todayStr(),
          notes: "문서를 기반으로 개념을 자동으로 생성할 예정입니다.",
          quizStats: { attempts: 0, correct: 0, total: 0 }
        });

        // 3) 기본 복습 스케줄 생성
        [1, 3, 7, 14].forEach((d, idx) => {
          state.reviews.push({
            id: `rev_${id}_${d}`,
            docId: id,
            dueDate: addDays(todayStr(), d),
            stage: idx + 1,
            priority: 1,
          });
        });

      } catch (err) {
        alert("업로드 실패: " + err.message);
      }
    }

    saveState();
    renderDocsList();
    renderHome();
    renderSchedule();

    input.value = "";
  });
}


// ====== 퀴즈 생성 & 진행 ======
async function generateQuestionsForDocAI(doc) {
  if (!doc.fileId) {
    throw new Error("fileId가 없어 서버에서 문서 내용을 읽을 수 없습니다.");
  }

  document.getElementById("quiz-status").textContent =
    `"${doc.title}"에서 텍스트 추출 중... (AI)`;

  const res = await fetch(`${API_BASE}/api/generate-quiz-from-file`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileId: doc.fileId,
      numQuestions: 5
    })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error("퀴즈 생성 실패: " + (data.error || "unknown"));
  }

  return data.questions.map((q) => ({
    q: q.question,
    opts: q.options,
    correct: q.correctIndex,
    explanation: q.explanation
  }));
}

async function startQuizForDoc(docId) {
  const doc = state.docs.find((d) => d.id === docId);
  if (!doc) return;

  const statusEl = document.getElementById("quiz-status");
  statusEl.textContent = `"${doc.title}" 퀴즈 생성 준비 중...`;

  try {
    const questions = await generateQuestionsForDocAI(doc);

    currentQuiz = {
      docId,
      questions,
      currentIndex: 0,
      score: 0,
      finished: false,
    };
    selectedOptionIndex = null;

    statusEl.textContent = `"${doc.title}" 퀴즈 시작합니다!`;
    renderQuizQuestion();

  } catch (err) {
    alert("AI 퀴즈 생성 실패: " + err.message);
    statusEl.textContent = "퀴즈 생성 실패.";
  }
}


function startQuickRandomQuiz() {
  // 아무 문서나 골라서 5문제
  if (state.docs.length === 0) {
    alert("먼저 학습 자료를 업로드해 주세요.");
    return;
  }
  const doc =
    state.docs[Math.floor(Math.random() * state.docs.length)];
  const allQ = generateQuestionsForDoc(doc);
  const questions = allQ.slice(0, 5);

  currentQuiz = {
    docId: doc.id,
    questions,
    currentIndex: 0,
    score: 0,
    finished: false,
  };
  selectedOptionIndex = null;

  document.getElementById(
    "quiz-status"
  ).textContent = `"${doc.title}" 기반 랜덤 5문제 퀴즈입니다.`;
  renderQuizQuestion();
}

function renderQuizQuestion() {
  const body = document.getElementById("quiz-body");
  const counter = document.getElementById("quiz-counter");
  const scoreEl = document.getElementById("quiz-score");
  const qEl = document.getElementById("quiz-question");
  const optsEl = document.getElementById("quiz-options");
  const feedbackEl = document.getElementById("quiz-feedback");
  const submitBtn = document.getElementById("btn-submit-answer");

  if (!currentQuiz || currentQuiz.finished) {
    body.classList.add("hidden");
    feedbackEl.textContent = "";
    submitBtn.disabled = true;
    return;
  }

  const { questions, currentIndex, score } = currentQuiz;
  const q = questions[currentIndex];

  body.classList.remove("hidden");
  counter.textContent = `문제 ${currentIndex + 1}/${questions.length}`;
  scoreEl.textContent = `점수 ${score}`;
  qEl.textContent = q.q;

  optsEl.innerHTML = "";
  selectedOptionIndex = null;
  submitBtn.disabled = true;
  feedbackEl.textContent = "";

  q.opts.forEach((opt, idx) => {
    const btn = document.createElement("button");
    btn.className = "quiz-option";
    btn.textContent = opt;
    btn.addEventListener("click", () => {
      selectedOptionIndex = idx;
      document
        .querySelectorAll(".quiz-option")
        .forEach((o) => o.classList.remove("selected"));
      btn.classList.add("selected");
      submitBtn.disabled = false;
    });
    optsEl.appendChild(btn);
  });
}

function handleSubmitAnswer() {
  if (!currentQuiz || currentQuiz.finished) return;
  if (selectedOptionIndex === null) return;

  const { questions, currentIndex } = currentQuiz;
  const q = questions[currentIndex];
  const feedbackEl = document.getElementById("quiz-feedback");

  const isCorrect = selectedOptionIndex === q.correct;
  if (isCorrect) {
    currentQuiz.score += 10;
    feedbackEl.textContent = "정답입니다! +10점";
    feedbackEl.style.color = "#16a34a";
  } else {
    feedbackEl.textContent = `오답입니다. 정답: ${
      q.opts[q.correct]
    }`;
    feedbackEl.style.color = "#dc2626";
  }

  // 사용자 전체 통계 업데이트
  state.user.totalAnswers += 1;
  if (isCorrect) state.user.correctAnswers += 1;

  // 문서별 통계
  const doc = state.docs.find((d) => d.id === currentQuiz.docId);
  if (doc) {
    if (!doc.quizStats) doc.quizStats = { attempts: 0, correct: 0, total: 0 };
    doc.quizStats.attempts += 1;
    doc.quizStats.total += 1;
    if (isCorrect) doc.quizStats.correct += 1;

    // 진도 조금씩 올리기 (최대 100%)
    doc.progress = Math.min(100, (doc.progress || 0) + (isCorrect ? 5 : 2));
  }

  saveState();
  renderProfile();
  renderDocsList();
  renderHome();

  setTimeout(() => {
    // 다음 문제로
    if (currentQuiz.currentIndex < currentQuiz.questions.length - 1) {
      currentQuiz.currentIndex += 1;
      renderQuizQuestion();
    } else {
      finishQuiz();
    }
  }, 800);
}

function finishQuiz() {
  currentQuiz.finished = true;
  document.getElementById(
    "quiz-status"
  ).textContent = `퀴즈 완료! 총 점수: ${currentQuiz.score}점`;

  // 간단한 학습 시간 증가(퀴즈 1회당 3분 가정)
  state.user.totalMinutes += 3;
  // 스크롤된 날이 바뀌지 않았다면 streak 유지, 실제 서비스면 날짜 체크 필요
  state.user.streak = Math.min(state.user.streak + 1, 365);

  // 오답률 기반 복습 우선순위 조정
  const doc = state.docs.find((d) => d.id === currentQuiz.docId);
  let wrongRate = 0.5;
  if (doc && doc.quizStats && doc.quizStats.total) {
    wrongRate =
      1 - doc.quizStats.correct / doc.quizStats.total;
  }

  scheduleReviewsForDoc(doc.id, wrongRate);

  saveState();
  renderProfile();
  renderSchedule();
  renderHome();
  renderDocsList();
  renderQuizQuestion();
}

function scheduleReviewsForDoc(docId, wrongRate) {
  // 기존 리뷰 중 아직 안 지난 것 priority 조정
  const today = todayStr();
  state.reviews.forEach((r) => {
    if (r.docId === docId && r.dueDate >= today) {
      r.priority = 1 + Math.round(wrongRate * 3);
    }
  });

  // 추가 큐 생성(간단하게 한번 더 푸시)
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

// ====== 복습 스케줄 렌더 ======
function renderSchedule() {
  const listEl = document.getElementById("review-list");
  const emptyHint = document.getElementById("review-empty-hint");

  const today = todayStr();
  const due = state.reviews.filter((r) => r.dueDate <= today);
  due.sort((a, b) => b.priority - a.priority);

  listEl.innerHTML = "";
  if (due.length === 0) {
    emptyHint.style.display = "block";
    return;
  }
  emptyHint.style.display = "none";

  due.forEach((rev) => {
    const doc = state.docs.find((d) => d.id === rev.docId);
    if (!doc) return;

    const li = document.createElement("li");
    li.className = "review-item";

    const head = document.createElement("div");
    head.className = "review-item-header";
    const title = document.createElement("span");
    title.textContent = doc.title;
    const tag = document.createElement("span");
    tag.textContent = `D+${rev.stage} · 우선순위 ${rev.priority}`;
    tag.style.fontSize = "11px";
    tag.style.color = "#2563eb";
    head.appendChild(title);
    head.appendChild(tag);

    const sub = document.createElement("div");
    sub.className = "review-item-sub";
    sub.textContent = `예정일: ${rev.dueDate}`;

    const btn = document.createElement("button");
    btn.className = "btn-primary";
    btn.textContent = "퀴즈 시작";
    btn.addEventListener("click", () => {
      startQuizForDoc(doc.id);
      switchScreen("quiz");
    });

    li.appendChild(head);
    li.appendChild(sub);
    li.appendChild(btn);
    listEl.appendChild(li);
  });
}

// ====== 프로필 렌더 ======
function renderProfile() {
  const u = state.user;
  const nameEl = document.getElementById("profile-name");
  nameEl.textContent = `Lv.${u.level} Data Rookie 🔥`;

  const h = Math.floor(u.totalMinutes / 60);
  const m = u.totalMinutes % 60;
  document.getElementById(
    "profile-time"
  ).textContent = `${h}h ${m}m`;

  const acc =
    u.totalAnswers === 0
      ? 0
      : Math.round((u.correctAnswers / u.totalAnswers) * 100);
  document.getElementById("profile-accuracy").textContent = `${acc}%`;

  const rankingEl = document.getElementById("profile-ranking");
  rankingEl.textContent = `친구 평균보다 +${u.bestRankDiff || 0}점`;

  renderBadges();
}

function renderBadges() {
  const list = document.getElementById("badge-list");
  list.innerHTML = "";

  const u = state.user;
  const badges = [];

  if (u.totalAnswers >= 10) {
    badges.push("첫 10문제 돌파");
  }
  if (u.totalAnswers >= 30) {
    badges.push("퀴즈 장인");
  }
  if (u.streak >= 3) {
    badges.push("3일 연속 학습");
  }
  if (u.correctAnswers >= 20) {
    badges.push("정답 왕");
  }

  if (badges.length === 0) {
    const li = document.createElement("li");
    li.className = "badge-item";
    li.textContent = "아직 획득한 뱃지가 없습니다. 퀴즈를 풀어보세요!";
    list.appendChild(li);
    return;
  }

  badges.forEach((b) => {
    const li = document.createElement("li");
    li.className = "badge-item";
    li.textContent = `🏅 ${b}`;
    list.appendChild(li);
  });
}

// ====== 이벤트 설정 ======
function setupEvents() {
  document
    .getElementById("btn-go-review")
    .addEventListener("click", () => switchScreen("schedule"));

  document
    .getElementById("btn-new-quiz")
    .addEventListener("click", () => {
      startQuickRandomQuiz();
      switchScreen("quiz");
    });

  document
    .getElementById("btn-go-recommend")
    .addEventListener("click", () => switchScreen("library"));

  document
    .getElementById("btn-start-doc-quiz")
    .addEventListener("click", () => {
      if (!currentDocId) return;
      startQuizForDoc(currentDocId);
      switchScreen("quiz");
    });

  document
    .getElementById("btn-show-notes")
    .addEventListener("click", () => {
      const el = document.getElementById("doc-notes");
      el.style.display = el.style.display === "none" ? "block" : "none";
    });

  document
    .getElementById("btn-submit-answer")
    .addEventListener("click", handleSubmitAnswer);

  document
    .getElementById("btn-quick-quiz")
    .addEventListener("click", () => {
      startQuickRandomQuiz();
    });

  document
    .getElementById("btn-open-ranking")
    .addEventListener("click", () => {
      alert("랭킹 기능은 실제 서비스에서 구현됩니다. (데모)");
    });

  document
    .getElementById("toggle-notifications")
    .addEventListener("change", (e) => {
      if (e.target.checked) {
        alert("알림이 켜졌다고 가정합니다. (실제 푸시는 서버/앱이 필요)");
      }
    });
}

// ====== 초기화 ======
function init() {
  loadState();
  setupNavigation();
  setupUpload();
  setupEvents();

  renderHome();
  renderDocsList();
  renderSchedule();
  renderProfile();
}

document.addEventListener("DOMContentLoaded", init);
