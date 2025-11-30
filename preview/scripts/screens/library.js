import { getState, saveState } from "../state.js";
import { runtime } from "../runtime.js";
import { todayStr, addDays } from "../utils/date.js";
import { uploadFileToServer } from "../services/files.js";

export function renderDocsList({ onStartQuiz, onAfterChange }) {
  const state = getState();
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
    meta.textContent = `${doc.progress || 0}% 완료 · 개념 ${doc.conceptsCount || 0}개`;

    const btnRow = document.createElement("div");
    btnRow.className = "button-row";

    const btnDetail = document.createElement("button");
    btnDetail.className = "btn-secondary";
    btnDetail.textContent = "상세 보기";
    btnDetail.addEventListener("click", () => showDocDetail(doc));

    const btnQuiz = document.createElement("button");
    btnQuiz.className = "btn-primary";
    btnQuiz.textContent = "퀴즈 풀기";
    btnQuiz.addEventListener("click", () => {
      showDocDetail(doc);
      onStartQuiz(doc.id);
    });

    const btnDelete = document.createElement("button");
    btnDelete.className = "icon-button";
    btnDelete.innerHTML = "🗑️";
    btnDelete.title = "삭제";
    btnDelete.addEventListener("click", () => {
      deleteDoc(doc.id, onAfterChange);
    });

    btnRow.appendChild(btnDetail);
    btnRow.appendChild(btnQuiz);
    btnRow.appendChild(btnDelete);

    li.appendChild(title);
    li.appendChild(meta);
    li.appendChild(btnRow);

    listEl.appendChild(li);
  });
}

export function setupUpload({ onAfterUpload }) {
  const input = document.getElementById("file-input");
  if (!input) return;

  input.addEventListener("change", async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    for (const file of files) {
      try {
        const uploaded = await uploadFileToServer(file);
        const id = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const state = getState();
        state.docs.push({
          id,
          fileId: uploaded.fileId,
          title: uploaded.originalName,
          type: uploaded.originalName.split(".").pop(),
          progress: 0,
          conceptsCount: 0,
          createdAt: todayStr(),
          notes: "문서를 기반으로 개념을 자동으로 생성할 예정입니다.",
          quizStats: { attempts: 0, correct: 0, total: 0 },
        });

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
    onAfterUpload();
    input.value = "";
  });
}

function showDocDetail(doc) {
  runtime.currentDocId = doc.id;
  const card = document.getElementById("doc-detail-card");
  card.style.display = "block";

  document.getElementById("doc-detail-title").textContent = doc.title;
  document.getElementById("doc-detail-progress").textContent = `${
    doc.progress || 0
  }% 완료`;
  document.getElementById("doc-detail-concepts").textContent =
    doc.conceptsCount || 0;

  const stats = doc.quizStats || { correct: 0, total: 0 };
  const statsEl = document.getElementById("doc-quiz-stats");
  if (!stats.total) {
    statsEl.textContent = "아직 퀴즈 기록이 없습니다.";
  } else {
    const acc = Math.round((stats.correct / stats.total) * 100);
    statsEl.textContent = `총 ${stats.total}문제, 정답률 ${acc}%`;
  }

  const notesEl = document.getElementById("doc-notes");
  notesEl.textContent = doc.notes || "자동 생성된 개념노트가 여기에 표시됩니다.";
  notesEl.style.display = "none";
}

function deleteDoc(docId, onAfterChange) {
  const state = getState();
  const target = state.docs.find((doc) => doc.id === docId);
  if (!target) return;

  const ok = confirm(`"${target.title}" 학습 자료를 삭제할까요?`);
  if (!ok) return;

  state.docs = state.docs.filter((doc) => doc.id !== docId);
  state.reviews = state.reviews.filter((review) => review.docId !== docId);

  if (runtime.currentDocId === docId) {
    runtime.currentDocId = null;
    document.getElementById("doc-detail-card").style.display = "none";
  }

  if (runtime.currentQuiz && runtime.currentQuiz.docId === docId) {
    runtime.currentQuiz = null;
    runtime.selectedOptionIndex = null;
    const quizStatus = document.getElementById("quiz-status");
    if (quizStatus) {
      quizStatus.textContent = "삭제된 자료의 퀴즈가 종료되었습니다.";
    }
  }

  saveState();
  onAfterChange();
}
