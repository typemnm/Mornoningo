import { getState } from "../state.js";

export function renderRanking() {
    const state = getState();
    const listEl = document.getElementById("ranking-list");
    const highlight = document.getElementById("ranking-highlight");
    if (!listEl || !highlight) return;

    const leaderboard = getSortedLeaderboard(state);
    const currentUserId = state.currentUserId || "user_me";
    const myIndex = leaderboard.findIndex(
        (entry) => entry.id === currentUserId
    );
    const myRank = myIndex >= 0 ? myIndex + 1 : null;
    if (myRank) {
        highlight.textContent = `현재 ${myRank}위, ${
            state.user.bestRankDiff || 0
        }점 차이입니다.`;
    } else {
        highlight.textContent = `상위권 유지 중! ${
            state.user.bestRankDiff || 0
        }점 차이`;
    }

    listEl.innerHTML = "";
    leaderboard.forEach((entry, index) => {
        const li = document.createElement("li");
        li.className = "ranking-item";
        if (entry.id === currentUserId) {
            li.classList.add("me");
        }

        const left = document.createElement("div");
        left.className = "ranking-meta";
        left.innerHTML = `<span class="ranking-position">${
            index + 1
        }</span><div><p class="ranking-name">${
            entry.name
        }</p><p class="ranking-sub">🔥 ${entry.streak}일</p></div>`;

        const score = document.createElement("span");
        score.className = "ranking-score";
        score.textContent = `${entry.score}점`;

        li.appendChild(left);
        li.appendChild(score);
        li.addEventListener("click", () =>
            openRankingModal(entry, index + 1, {
                isMe: entry.id === currentUserId,
                isHigherRank: myRank ? index + 1 < myRank : false,
            })
        );
        listEl.appendChild(li);
    });
}

function getSortedLeaderboard(state) {
    const base =
        state.leaderboard && state.leaderboard.length
            ? state.leaderboard
            : buildFallbackLeaderboard(state);
    return [...base].sort((a, b) => b.score - a.score);
}

function buildFallbackLeaderboard(state) {
    const baseScore = 1000 + (state.user.correctAnswers || 0) * 5;
    return [
        {
            id: state.currentUserId || "user_me",
            name: state.user.name || "나",
            score: baseScore,
            streak: state.user.streak || 0,
        },
        { id: "u2", name: "AI Explorer", score: baseScore - 30, streak: 5 },
        { id: "u3", name: "알고리즘 장인", score: baseScore - 60, streak: 2 },
    ];
}

let modalRefs = null;

function getModalRefs() {
    if (modalRefs) return modalRefs;
    const overlay = document.getElementById("ranking-modal");
    if (!overlay) return null;

    modalRefs = {
        overlay,
        closeBtn: document.getElementById("ranking-modal-close"),
        name: document.getElementById("modal-name"),
        rank: document.getElementById("modal-rank"),
        score: document.getElementById("modal-score"),
        streak: document.getElementById("modal-streak"),
        challengeBtn: document.getElementById("modal-challenge"),
    };

    modalRefs.closeBtn?.addEventListener("click", closeRankingModal);
    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) closeRankingModal();
    });
    modalRefs.challengeBtn?.addEventListener("click", () => {
        alert("친구에게 도전장을 보냈습니다! 🔥");
        closeRankingModal();
    });

    return modalRefs;
}

function openRankingModal(entry, rank, { isMe, isHigherRank }) {
    const refs = getModalRefs();
    if (!refs) return;
    refs.rank.textContent = isMe ? "내 순위" : `${rank}위`;
    refs.name.textContent = entry.name;
    refs.score.textContent = `점수 ${entry.score}점`;
    refs.streak.textContent = `🔥 ${entry.streak}일 연속 학습`;
    if (isMe) {
        refs.challengeBtn.disabled = true;
        refs.challengeBtn.textContent = "나에게는 보내지 못합니다.";
    } else if (isHigherRank) {
        refs.challengeBtn.disabled = true;
        refs.challengeBtn.textContent = "랭킹이 너무 높습니다!";
    } else {
        refs.challengeBtn.disabled = false;
        refs.challengeBtn.textContent = "덤벼봐! 🔥";
    }
    refs.overlay.setAttribute("aria-hidden", "false");
}

function closeRankingModal() {
    modalRefs?.overlay?.setAttribute("aria-hidden", "true");
}
