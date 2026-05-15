const socket = io();

const modeOverlay = document.getElementById("modeOverlay");
const multiplayerModeBtn = document.getElementById("multiplayerModeBtn");
const singleplayerModeBtn = document.getElementById("singleplayerModeBtn");
const modeOverlayNote = document.getElementById("modeOverlayNote");
const menuBtn = document.getElementById("menuBtn");
const leaderboardHoverList = document.getElementById("leaderboardHoverList");

const player1Panel = document.getElementById("player1Panel");
const player2Panel = document.getElementById("player2Panel");
const lane1 = document.getElementById("lane1");
const lane2 = document.getElementById("lane2");

const player1Ready = document.getElementById("player1Ready");
const player2Ready = document.getElementById("player2Ready");
const player1Name = document.getElementById("player1Name");
const player2Name = document.getElementById("player2Name");

const player1Qr = document.getElementById("player1Qr");
const player2Qr = document.getElementById("player2Qr");

const player1PreviewCar = document.getElementById("player1PreviewCar");
const player2PreviewCar = document.getElementById("player2PreviewCar");
const trackCar1 = document.getElementById("trackCar1");
const trackCar2 = document.getElementById("trackCar2");
const trackCarWrap1 = document.getElementById("trackCarWrap1");
const trackCarWrap2 = document.getElementById("trackCarWrap2");

const player1MiniBuild = document.getElementById("player1MiniBuild");
const player2MiniBuild = document.getElementById("player2MiniBuild");

const player1RaceTime = document.getElementById("player1RaceTime");
const player2RaceTime = document.getElementById("player2RaceTime");
const player1Reaction = document.getElementById("player1Reaction");
const player2Reaction = document.getElementById("player2Reaction");
const player1Finish = document.getElementById("player1Finish");
const player2Finish = document.getElementById("player2Finish");

const lane1Label = document.getElementById("lane1Label");
const lane2Label = document.getElementById("lane2Label");
const hostStatus = document.getElementById("hostStatus");
const winnerBanner = document.getElementById("winnerBanner");
const startRaceBtn = document.getElementById("startRaceBtn");
const clearBtn = document.getElementById("clearBtn");

const lights = [
  document.getElementById("light1"),
  document.getElementById("light2"),
  document.getElementById("light3"),
  document.getElementById("light4"),
  document.getElementById("light5")
];

let partsData = null;
let currentSessionId = null;
let selectedMode = null;
let modeChosenThisPageLoad = false;

let currentState = {
  player1: {},
  player2: {},
  bothReady: false,
  sessionId: null,
  mode: null
};

let raceResults = {
  player1: { reaction: null, finish: null, race: null },
  player2: { reaction: null, finish: null, race: null }
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadLeaderboard() {
  try {
    const response = await fetch("/api/leaderboard");
    if (!response.ok) return;
    const rows = await response.json();
    console.log("leaderboard loaded", rows.length);
  } catch (error) {
    console.error("failed to load leaderboard", error);
  }
}

async function loadLeaderboardPreview() {
  try {
    const response = await fetch("/api/leaderboard-preview");
    if (!response.ok) return;
    const rows = await response.json();
    renderLeaderboardPreview(rows);
  } catch (error) {
    console.error("failed to load leaderboard preview", error);
  }
}

function renderLeaderboardPreview(rows) {
  if (!leaderboardHoverList) return;

  if (!rows || !rows.length) {
    leaderboardHoverList.innerHTML = '<div class="leaderboard-empty">no results yet</div>';
    return;
  }

  leaderboardHoverList.innerHTML = rows
    .map((row, index) => {
      return `
        <div class="leaderboard-hover-row">
          <div class="leaderboard-hover-rank">#${index + 1}</div>
          <div class="leaderboard-hover-name">${escapeHtml(row.name || "player")}</div>
          <div class="leaderboard-hover-time">${Number(row.totalTime).toFixed(3)}s</div>
        </div>
      `;
    })
    .join("");
}

function buildJoinUrl(playerKey) {
  if (!currentSessionId) return "#";
  return `${window.location.origin}/controller.html?player=${playerKey}&session=${currentSessionId}`;
}

function renderQrCodes() {
  if (!currentSessionId) return;

  if (selectedMode === "singleplayer") {
    player1Qr.innerHTML = '<canvas id="qrCanvas1"></canvas>';
    player2Qr.innerHTML = "";

    const qrCanvas1 = document.getElementById("qrCanvas1");
    QRCode.toCanvas(qrCanvas1, buildJoinUrl("player1"), { width: 140 }, function (err) {
      if (err) console.error("QR1 failed", err);
    });
    return;
  }

  if (selectedMode === "multiplayer") {
    player1Qr.innerHTML = '<canvas id="qrCanvas1"></canvas>';
    player2Qr.innerHTML = '<canvas id="qrCanvas2"></canvas>';

    const qrCanvas1 = document.getElementById("qrCanvas1");
    const qrCanvas2 = document.getElementById("qrCanvas2");

    QRCode.toCanvas(qrCanvas1, buildJoinUrl("player1"), { width: 140 }, function (err) {
      if (err) console.error("QR1 failed", err);
    });

    QRCode.toCanvas(qrCanvas2, buildJoinUrl("player2"), { width: 140 }, function (err) {
      if (err) console.error("QR2 failed", err);
    });
    return;
  }

  player1Qr.innerHTML = "";
  player2Qr.innerHTML = "";
}

function showModeOverlay() {
  modeOverlay.style.display = "flex";
  selectedMode = null;
  modeChosenThisPageLoad = false;
  startRaceBtn.disabled = true;
  clearBtn.disabled = true;
  renderQrCodes();
  renderAll();
}

function hideModeOverlay() {
  modeOverlay.style.display = "none";
}

function setMode(mode) {
  selectedMode = mode;
  modeChosenThisPageLoad = true;
  modeOverlayNote.textContent = mode === "multiplayer" ? "multiplayer selected" : "singleplayer selected";
  hideModeOverlay();
  clearBtn.disabled = false;
  socket.emit("set-mode", { mode });
  renderQrCodes();
  renderAll();
}

function resetToMenu() {
  socket.emit("reset-all");
}

multiplayerModeBtn.addEventListener("click", () => {
  setMode("multiplayer");
});

singleplayerModeBtn.addEventListener("click", () => {
  setMode("singleplayer");
});

menuBtn.addEventListener("click", () => {
  resetToMenu();
});

async function loadParts() {
  try {
    const response = await fetch("/api/parts");
    partsData = await response.json();
    renderAll();
  } catch (error) {
    console.error("failed to load parts", error);
  }
}

function formatTime(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "waiting";
  return `${Number(value).toFixed(3)}s`;
}

function resetRaceMetrics() {
  raceResults = {
    player1: { reaction: null, finish: null, race: null },
    player2: { reaction: null, finish: null, race: null }
  };

  player1RaceTime.textContent = "waiting";
  player2RaceTime.textContent = "waiting";
  player1Reaction.textContent = "waiting";
  player2Reaction.textContent = "waiting";
  player1Finish.textContent = "waiting";
  player2Finish.textContent = "waiting";
}

function clearLights() {
  lights.forEach((light) => {
    light.classList.remove("active-light", "go-light");
  });
}

function getPlayerName(playerKey) {
  const player = currentState[playerKey] || {};
  return player.name || (playerKey === "player1" ? "player 1" : "player 2");
}

function getPlayerBuild(playerKey) {
  const player = currentState[playerKey] || {};
  const build = player.build;

  if (!build) return null;

  if (build.mode === "singleplayer") {
    return build;
  }

  if (!partsData) return null;
  if (
    build.frontIndex === undefined ||
    build.bodyIndex === undefined ||
    build.rearIndex === undefined
  ) {
    return null;
  }

  const front = partsData.front[build.frontIndex];
  const body = partsData.body[build.bodyIndex];
  const rear = partsData.rear[build.rearIndex];

  if (!front || !body || !rear) return null;

  return {
    frontIndex: build.frontIndex,
    bodyIndex: build.bodyIndex,
    rearIndex: build.rearIndex,
    totalMass: front.mass + body.mass + rear.mass,
    totalCd: Number((front.cd + body.cd + rear.cd).toFixed(3))
  };
}

function chooseCarFamily(buildInfo) {
  if (!buildInfo) return 1;
  if (buildInfo.mode === "singleplayer") return buildInfo.carFamily || 1;

  const f = Number(buildInfo.frontIndex) + 1;
  const b = Number(buildInfo.bodyIndex) + 1;
  const r = Number(buildInfo.rearIndex) + 1;

  if (f === b) return f;
  if (b === r) return b;
  if (f === r) return f;
  return b;
}

function getHostCarPath(playerKey, buildInfo) {
  if (!buildInfo) return "";

  if (buildInfo.mode === "singleplayer") {
    return buildInfo.image;
  }

  const family = chooseCarFamily(buildInfo);
  const color = playerKey === "player2" ? "white" : "orange";
  return `/assets/cars/${color}/car${family}.png`;
}

function applyCarAppearance(imgEl, playerKey, buildInfo, imageType) {
  if (!imgEl) return;

  const src = getHostCarPath(playerKey, buildInfo);

  if (!src) {
    imgEl.removeAttribute("src");
    imgEl.style.display = "none";
    return;
  }

  imgEl.src = src;
  imgEl.style.display = "block";

  const baseClass = imageType === "track" ? "full-track-car" : "full-car-preview";
  imgEl.className = `${baseClass}${buildInfo.colorClass ? ` ${buildInfo.colorClass}` : ""}`;
}

function renderPlayerCard(playerKey) {
  const player = currentState[playerKey] || {};
  const buildInfo = getPlayerBuild(playerKey);

  const readyEl = playerKey === "player1" ? player1Ready : player2Ready;
  const nameEl = playerKey === "player1" ? player1Name : player2Name;
  const previewEl = playerKey === "player1" ? player1PreviewCar : player2PreviewCar;
  const miniBuildEl = playerKey === "player1" ? player1MiniBuild : player2MiniBuild;
  const trackEl = playerKey === "player1" ? trackCar1 : trackCar2;

  readyEl.textContent = player.ready ? "ready" : "not ready";
  readyEl.classList.toggle("ready-on", !!player.ready);

  nameEl.textContent =
    selectedMode === "singleplayer" && playerKey === "player1"
      ? (player.name || "player")
      : getPlayerName(playerKey);

  if (buildInfo) {
    miniBuildEl.textContent = `${Number(buildInfo.totalMass).toFixed(1)}g / Cd ${buildInfo.totalCd.toFixed(3)}`;
  } else {
    miniBuildEl.textContent = "mass / Cd: waiting";
  }

  if (player.ready && buildInfo) {
    applyCarAppearance(previewEl, playerKey, buildInfo, "preview");
    applyCarAppearance(trackEl, playerKey, buildInfo, "track");
  } else {
    previewEl.removeAttribute("src");
    previewEl.style.display = "none";
    trackEl.removeAttribute("src");
    trackEl.style.display = "none";
  }
}

function renderTrackCars() {
  lane1Label.textContent =
    selectedMode === "singleplayer" ? (getPlayerName("player1") || "player") : getPlayerName("player1");
  lane2Label.textContent = getPlayerName("player2");
  setTrackProgress("player1", 0);
  setTrackProgress("player2", 0);
}

function setTrackProgress(playerKey, ratio) {
  const safeRatio = Math.max(0, Math.min(1, ratio));
  const wrap = playerKey === "player1" ? trackCarWrap1 : trackCarWrap2;
  const lane = playerKey === "player1" ? lane1 : lane2;

  if (!wrap || !lane) return;

  const laneWidth = lane.clientWidth;
  const carWidth = wrap.offsetWidth || 170;
  const finishPadding = 95;
  const x = safeRatio * (laneWidth - carWidth - finishPadding);

  wrap.style.transform = `translateX(${x}px)`;
}

function animateRace(player1Total, player2Total) {
  const start = performance.now();
  const effectiveP2 = selectedMode === "singleplayer" ? 999 : player2Total;
  const maxTime = Math.max(player1Total || 0, effectiveP2 || 0, 0.1) * 1000;

  function step(now) {
    const elapsed = now - start;
    const p1Ratio = Math.min(elapsed / (player1Total * 1000 || 1), 1);
    setTrackProgress("player1", p1Ratio);

    if (selectedMode !== "singleplayer") {
      const p2Ratio = Math.min(elapsed / (player2Total * 1000 || 1), 1);
      setTrackProgress("player2", p2Ratio);
    }

    if (elapsed < maxTime) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
}

function updateMetricDisplays() {
  player1RaceTime.textContent = formatTime(raceResults.player1.race);
  player1Reaction.textContent = formatTime(raceResults.player1.reaction);
  player1Finish.textContent = formatTime(raceResults.player1.finish);

  if (selectedMode === "singleplayer") {
    player2RaceTime.textContent = "hidden";
    player2Reaction.textContent = "hidden";
    player2Finish.textContent = "hidden";
  } else {
    player2RaceTime.textContent = formatTime(raceResults.player2.race);
    player2Reaction.textContent = formatTime(raceResults.player2.reaction);
    player2Finish.textContent = formatTime(raceResults.player2.finish);
  }
}

function applyModeLayout() {
  if (selectedMode === "singleplayer") {
    document.body.classList.add("singleplayer-host");
    player2Panel.style.display = "none";
    lane2.style.display = "none";
  } else {
    document.body.classList.remove("singleplayer-host");
    player2Panel.style.display = "flex";
    lane2.style.display = "block";
  }
}

function renderAll() {
  applyModeLayout();
  renderPlayerCard("player1");
  renderPlayerCard("player2");
  renderTrackCars();

  if (selectedMode === "singleplayer") {
    startRaceBtn.disabled = !currentState.player1?.ready;
    hostStatus.textContent = currentState.player1?.ready ? "ready to start" : "waiting for player";
  } else if (selectedMode === "multiplayer") {
    startRaceBtn.disabled = !currentState.bothReady;
    hostStatus.textContent = currentState.bothReady ? "ready to start" : "waiting for both players to build";
  } else {
    startRaceBtn.disabled = true;
    hostStatus.textContent = "choose a mode";
  }

  updateMetricDisplays();
}

function playBeep(freq = 700, duration = 120) {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const audioCtx = new AudioContextClass();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const now = audioCtx.currentTime;

    osc.type = "square";
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration / 1000);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(now);
    osc.stop(now + duration / 1000);
  } catch (error) {
    console.log("beep failed", error);
  }
}

function celebrateWinner() {
  if (typeof confetti !== "function") return;

  confetti({
    particleCount: 160,
    spread: 85,
    startVelocity: 45,
    origin: { y: 0.55 }
  });

  setTimeout(() => {
    confetti({
      particleCount: 100,
      spread: 100,
      startVelocity: 40,
      origin: { y: 0.62 }
    });
  }, 250);
}

function parseReactionSummary(summary) {
  const p1Reaction =
    summary.player1ReactionTime ??
    summary.player1?.reactionTime ??
    summary.results?.player1?.reactionTime ??
    null;

  const p2Reaction =
    summary.player2ReactionTime ??
    summary.player2?.reactionTime ??
    summary.results?.player2?.reactionTime ??
    null;

  const p1Finish =
    summary.player1FinishTime ??
    summary.player1?.trackTime ??
    summary.player1?.finishTime ??
    summary.results?.player1?.finishTime ??
    null;

  const p2Finish =
    summary.player2FinishTime ??
    summary.player2?.trackTime ??
    summary.player2?.finishTime ??
    summary.results?.player2?.finishTime ??
    null;

  const p1Race =
    summary.player1RaceTime ??
    summary.player1TotalTime ??
    summary.player1?.raceTime ??
    summary.player1?.totalTime ??
    summary.results?.player1?.raceTime ??
    (p1Reaction !== null && p1Finish !== null ? p1Reaction + p1Finish : null);

  const p2Race =
    summary.player2RaceTime ??
    summary.player2TotalTime ??
    summary.player2?.raceTime ??
    summary.player2?.totalTime ??
    summary.results?.player2?.raceTime ??
    (p2Reaction !== null && p2Finish !== null ? p2Reaction + p2Finish : null);

  raceResults.player1 = { reaction: p1Reaction, finish: p1Finish, race: p1Race };
  raceResults.player2 = { reaction: p2Reaction, finish: p2Finish, race: p2Race };

  updateMetricDisplays();

  if (p1Race !== null) {
    animateRace(p1Race, p2Race);
  }
}

function resetBoardForNewRace() {
  clearLights();
  winnerBanner.textContent = "winner: waiting";
  setTrackProgress("player1", 0);
  setTrackProgress("player2", 0);
  resetRaceMetrics();
}

startRaceBtn.addEventListener("click", () => {
  if (!selectedMode) return;
  socket.emit("start-race");
});

clearBtn.addEventListener("click", () => {
  socket.emit("clear-game");
});

socket.on("connect", () => {
  console.log("host connected");
});

socket.on("state-sync", (state) => {
  currentState = state || currentState;

  if (state && state.sessionId) {
    currentSessionId = state.sessionId;
  }

  if (modeChosenThisPageLoad && state && state.mode) {
    selectedMode = state.mode;
    hideModeOverlay();
    clearBtn.disabled = false;
  }

  renderQrCodes();
  renderAll();
});

socket.on("session-cleared", (payload) => {
  if (payload && payload.sessionId) {
    currentSessionId = payload.sessionId;
  }

  if (payload?.keepMode) {
    selectedMode = payload.mode || selectedMode;
    modeChosenThisPageLoad = true;
    hideModeOverlay();
    clearBtn.disabled = false;
  } else {
    showModeOverlay();
  }

  currentState = {
    player1: {},
    player2: {},
    bothReady: false,
    sessionId: currentSessionId,
    mode: selectedMode
  };

  renderQrCodes();
  resetBoardForNewRace();
  renderAll();
});

socket.on("reset-race", () => {
  resetBoardForNewRace();
  hostStatus.textContent = "get ready";
});

socket.on("light-step", (step) => {
  clearLights();

  for (let i = 0; i < step; i++) {
    if (lights[i]) lights[i].classList.add("active-light");
  }

  playBeep(720, 110);
  hostStatus.textContent = "wait for lights out";
});

socket.on("lights-out", () => {
  clearLights();
  hostStatus.textContent = "tap now";
  playBeep(1150, 180);
});

socket.on("reaction-summary", (summary) => {
  parseReactionSummary(summary);
});

socket.on("race-finished", async (payload) => {
  if (selectedMode === "singleplayer") {
    const isFalseStart = payload.winner === "False start";

    winnerBanner.textContent = isFalseStart
      ? "false start"
      : `${payload.winnerName} finished`;

    hostStatus.textContent = "race finished";

    if (!isFalseStart) {
      celebrateWinner();
    }
    return;
  }

  const winnerName = payload.winnerName || payload.winner || "winner";
  winnerBanner.textContent = `${winnerName} wins`;
  hostStatus.textContent = "race finished";
  celebrateWinner();
  await loadLeaderboard();
  await loadLeaderboardPreview();
});

loadParts();
loadLeaderboard();
loadLeaderboardPreview();
resetBoardForNewRace();
showModeOverlay();