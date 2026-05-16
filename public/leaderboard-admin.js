const leaderboardTableBody = document.getElementById("leaderboardTableBody");
const leaderboardTop3 = document.getElementById("leaderboardTop3");

const params = new URLSearchParams(window.location.search);
const adminKey = params.get("admin") || "";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatNumber(value, digits = 3) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "0.000";
  return num.toFixed(digits);
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function renderTop3(rows) {
  if (!leaderboardTop3) return;

  const top3 = rows.slice(0, 3);

  leaderboardTop3.innerHTML = [0, 1, 2]
    .map((index) => {
      const row = top3[index];

      if (!row) {
        return `
          <div class="leaderboard-mini-card">
            <div class="leaderboard-mini-rank">#${index + 1}</div>
            <div class="leaderboard-mini-name">waiting</div>
            <div class="leaderboard-mini-time">0.000s</div>
          </div>
        `;
      }

      return `
        <div class="leaderboard-mini-card">
          <div class="leaderboard-mini-rank">#${index + 1}</div>
          <div class="leaderboard-mini-name">${escapeHtml(row.name || "player")}</div>
          <div class="leaderboard-mini-time">${formatNumber(row.totalTime)}s</div>
        </div>
      `;
    })
    .join("");
}

function renderLeaderboard(rows) {
  if (!leaderboardTableBody) return;

  if (!rows || !rows.length) {
    leaderboardTableBody.innerHTML = `
      <tr>
        <td colspan="8" class="leaderboard-empty-cell">no results yet</td>
      </tr>
    `;
    renderTop3([]);
    return;
  }

  renderTop3(rows);

  leaderboardTableBody.innerHTML = rows
    .map((row, index) => {
      return `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(row.name || "player")}</td>
          <td>${escapeHtml(row.email || "no email")}</td>
          <td>${formatNumber(row.totalTime)}s</td>
          <td>${formatNumber(row.reactionTime)}s</td>
          <td>${formatNumber(row.trackTime)}s</td>
          <td>${escapeHtml(formatDate(row.createdAt || row.date))}</td>
          <td>
            <button class="leaderboard-delete-btn" data-id="${escapeHtml(row.id || "")}">
              ×
            </button>
          </td>
        </tr>
      `;
    })
    .join("");

  document.querySelectorAll(".leaderboard-delete-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const entryId = button.dataset.id;
      if (!entryId) return;

      if (!adminKey) {
        alert("missing admin key");
        return;
      }

      const ok = window.confirm("remove this leaderboard entry?");
      if (!ok) return;

      try {
        const response = await fetch(`/api/leaderboard/${entryId}`, {
          method: "DELETE",
          headers: {
            "x-admin-key": adminKey
          }
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("delete failed", errorText);
          alert("failed to remove entry");
          return;
        }

        await loadLeaderboard();
      } catch (error) {
        console.error("failed to remove entry", error);
        alert("failed to remove entry");
      }
    });
  });
}

async function loadLeaderboard() {
  try {
    const response = await fetch("/api/leaderboard");
    if (!response.ok) {
      leaderboardTableBody.innerHTML = `
        <tr>
          <td colspan="8" class="leaderboard-empty-cell">failed to load leaderboard</td>
        </tr>
      `;
      return;
    }

    const rows = await response.json();
    renderLeaderboard(Array.isArray(rows) ? rows : []);
  } catch (error) {
    console.error("failed to load leaderboard", error);
    leaderboardTableBody.innerHTML = `
      <tr>
        <td colspan="8" class="leaderboard-empty-cell">failed to load leaderboard</td>
      </tr>
    `;
  }
}

loadLeaderboard();