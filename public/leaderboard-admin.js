const fullLeaderboardList = document.getElementById("fullLeaderboardList");
const params = new URLSearchParams(window.location.search);
const adminKey = params.get("admin");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadFullLeaderboard() {
  try {
    const response = await fetch("/api/leaderboard");
    if (!response.ok) {
      fullLeaderboardList.innerHTML = '<div class="leaderboard-empty">failed to load</div>';
      return;
    }

    const rows = await response.json();
    renderFullLeaderboard(rows);
  } catch (error) {
    console.error(error);
    fullLeaderboardList.innerHTML = '<div class="leaderboard-empty">failed to load</div>';
  }
}

function renderFullLeaderboard(rows) {
  if (!rows || !rows.length) {
    fullLeaderboardList.innerHTML = '<div class="leaderboard-empty">no results yet</div>';
    return;
  }

  fullLeaderboardList.innerHTML = rows
    .map((row, index) => {
      const emailText = row.email ? escapeHtml(row.email) : "no email";
      return `
        <div class="leaderboard-full-row">
          <div class="leaderboard-full-rank">#${index + 1}</div>
          <div class="leaderboard-full-main">
            <div class="leaderboard-full-name">${escapeHtml(row.name || "player")}</div>
            <div class="leaderboard-full-email">${emailText}</div>
            <div class="leaderboard-full-meta">
              total ${Number(row.totalTime).toFixed(3)}s • reaction ${Number(row.reactionTime).toFixed(3)}s • finish ${Number(row.trackTime).toFixed(3)}s
            </div>
          </div>
          <button class="leaderboard-delete-btn" data-id="${escapeHtml(row.id)}" type="button">×</button>
        </div>
      `;
    })
    .join("");

  fullLeaderboardList.querySelectorAll(".leaderboard-delete-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!adminKey) {
        window.alert("Not allowed");
        return;
      }

      const id = button.dataset.id;
      const ok = window.confirm("Remove this leaderboard entry?");
      if (!ok) return;

      try {
        const response = await fetch(`/api/leaderboard/${encodeURIComponent(id)}`, {
          method: "DELETE",
          headers: {
            "x-admin-key": adminKey
          }
        });

        if (!response.ok) {
          window.alert("Delete failed");
          return;
        }

        await loadFullLeaderboard();
      } catch (error) {
        console.error(error);
        window.alert("Delete failed");
      }
    });
  });
}

loadFullLeaderboard();