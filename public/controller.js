const socket = io();

const params = new URLSearchParams(window.location.search);
const playerRole = params.get("role") || "player1";
const sessionId = params.get("sessionId") || "";
const showEmailField = params.get("email") === "1" || params.get("adminView") === "1";

const joinCard = document.getElementById("joinCard");
const builderCard = document.getElementById("builderCard");
const tapCard = document.getElementById("tapCard");

const controllerRoleLabel = document.getElementById("controllerRoleLabel");
const controllerStatus = document.getElementById("controllerStatus");
const buildNote = document.getElementById("buildNote");

const playerNameInput = document.getElementById("playerName");
const playerEmailInput = document.getElementById("playerEmail");
const emailRow = document.getElementById("emailRow");
const confirmNameBtn = document.getElementById("confirmNameBtn");

const readyBtn = document.getElementById("readyBtn");
const editBuildBtn = document.getElementById("editBuildBtn");

const frontPrevBtn = document.getElementById("frontPrevBtn");
const frontNextBtn = document.getElementById("frontNextBtn");
const bodyPrevBtn = document.getElementById("bodyPrevBtn");
const bodyNextBtn = document.getElementById("bodyNextBtn");
const rearPrevBtn = document.getElementById("rearPrevBtn");
const rearNextBtn = document.getElementById("rearNextBtn");

const frontPreview = document.getElementById("frontPreview");
const bodyPreview = document.getElementById("bodyPreview");
const rearPreview = document.getElementById("rearPreview");

const frontName = document.getElementById("frontName");
const bodyName = document.getElementById("bodyName");
const rearName = document.getElementById("rearName");

const frontStats = document.getElementById("frontStats");
const bodyStats = document.getElementById("bodyStats");
const rearStats = document.getElementById("rearStats");

const totalMassValue = document.getElementById("totalMassValue");
const totalCdValue = document.getElementById("totalCdValue");

const tapButton = document.getElementById("tapButton");
const tapButtonText = document.getElementById("tapButtonText");
const tapHelpText = document.getElementById("tapHelpText");
const tapReadout = document.getElementById("tapReadout");

let partsData = {
  front: [],
  body: [],
  rear: []
};

let selectedIndex = {
  front: 0,
  body: 0,
  rear: 0
};

let joined = false;
let buildSaved = false;
let countdownActive = false;
let canTap = false;
let alreadyTapped = false;
let lightsOutTime = null;
let bothPlayersReady = false;
let raceStarted = false;
let raceFinished = false;

controllerRoleLabel.textContent = playerRole === "player2" ? "player 2" : "player 1";

if (showEmailField) {
  emailRow.classList.remove("hidden");
}

function safeText(value, fallback = "") {
  return String(value ?? fallback);
}

function getPartLabel(part, fallback) {
  return safeText(
    part?.displayName || part?.name || part?.label || part?.id || fallback,
    fallback
  );
}

function getPartMass(part) {
  return Number(part?.mass ?? part?.mass_g ?? 0);
}

function getPartCd(part) {
  return Number(part?.cd ?? part?.Cd ?? 0);
}

function getPartImage(part) {
  return safeText(part?.image || part?.imagePath || part?.asset || "", "");
}

function wrapIndex(index, length) {
  if (!length) return 0;
  if (index < 0) return length - 1;
  if (index >= length) return 0;
  return index;
}

function currentPart(type) {
  return partsData[type]?.[selectedIndex[type]] || null;
}

function currentSelection() {
  const front = currentPart("front");
  const body = currentPart("body");
  const rear = currentPart("rear");

  return {
    front: front?.id || "front1",
    body: body?.id || "body1",
    rear: rear?.id || "rear1"
  };
}

function updateTapVisual(state, text) {
  tapButton.dataset.state = state;
  tapButtonText.textContent = text;
}

function updateTapAvailability() {
  tapButton.disabled = !(canTap || countdownActive) || alreadyTapped || !buildSaved;
}

function renderPart(type) {
  const part = currentPart(type);
  if (!part) return;

  const label = getPartLabel(part, type);
  const mass = getPartMass(part).toFixed(1);
  const cd = getPartCd(part).toFixed(3);
  const image = getPartImage(part);

  if (type === "front") {
    frontName.textContent = label;
    frontStats.textContent = `${mass}g • Cd ${cd}`;
    frontPreview.src = image;
  }

  if (type === "body") {
    bodyName.textContent = label;
    bodyStats.textContent = `${mass}g • Cd ${cd}`;
    bodyPreview.src = image;
  }

  if (type === "rear") {
    rearName.textContent = label;
    rearStats.textContent = `${mass}g • Cd ${cd}`;
    rearPreview.src = image;
  }
}

function updateTotals() {
  const front = currentPart("front");
  const body = currentPart("body");
  const rear = currentPart("rear");

  const totalMass =
    getPartMass(front) +
    getPartMass(body) +
    getPartMass(rear);

  const totalCd =
    getPartCd(front) +
    getPartCd(body) +
    getPartCd(rear);

  totalMassValue.textContent = `${totalMass.toFixed(1)}g`;
  totalCdValue.textContent = totalCd.toFixed(3);
}

function renderBuilder() {
  renderPart("front");
  renderPart("body");
  renderPart("rear");
  updateTotals();
}

async function loadParts() {
  try {
    const response = await fetch("/api/parts");
    const data = await response.json();

    partsData.front = Array.isArray(data.front) ? data.front : [];
    partsData.body = Array.isArray(data.body) ? data.body : [];
    partsData.rear = Array.isArray(data.rear) ? data.rear : [];

    renderBuilder();
  } catch (error) {
    console.error("failed to load parts", error);
    controllerStatus.textContent = "failed to load parts";
  }
}

function setBuilderLocked(locked) {
  [
    frontPrevBtn,
    frontNextBtn,
    bodyPrevBtn,
    bodyNextBtn,
    rearPrevBtn,
    rearNextBtn
  ].forEach((btn) => {
    btn.disabled = locked;
  });

  readyBtn.disabled = locked;
  editBuildBtn.disabled = !locked || countdownActive || raceStarted;
}

function goPrev(type) {
  selectedIndex[type] = wrapIndex(selectedIndex[type] - 1, partsData[type].length);
  renderBuilder();
}

function goNext(type) {
  selectedIndex[type] = wrapIndex(selectedIndex[type] + 1, partsData[type].length);
  renderBuilder();
}

function resetTapState() {
  countdownActive = false;
  canTap = false;
  alreadyTapped = false;
  lightsOutTime = null;
  raceStarted = false;
  raceFinished = false;
  tapReadout.textContent = "reaction: waiting";
  tapHelpText.textContent = buildSaved ? "wait for the lights" : "save your build first";
  updateTapVisual("idle", "WAIT");
  updateTapAvailability();
}

function enterJoinedState() {
  joined = true;
  joinCard.classList.add("collapsed");
  builderCard.classList.remove("hidden");
  tapCard.classList.remove("hidden");
  controllerStatus.textContent = "build your car";
}

function saveBuild() {
  if (!joined) {
    controllerStatus.textContent = "enter your name first";
    return;
  }

  socket.emit("save-build", {
    player: playerRole,
    selection: currentSelection(),
    sessionId
  });

  buildSaved = true;
  setBuilderLocked(true);
  buildNote.textContent = "build saved";
  controllerStatus.textContent = "ready";
  tapHelpText.textContent = "wait for the lights";
  resetTapState();
}

function editBuild() {
  socket.emit("edit-build", {
    player: playerRole,
    sessionId
  });

  buildSaved = false;
  setBuilderLocked(false);
  buildNote.textContent = "choose your parts, then press ready";
  controllerStatus.textContent = "editing build";
  resetTapState();
}

function joinRace() {
  const name = playerNameInput.value.trim();
  const email = playerEmailInput ? playerEmailInput.value.trim() : "";

  if (!name) {
    controllerStatus.textContent = "enter your name";
    return;
  }

  socket.emit("join", {
    role: playerRole,
    name,
    email,
    sessionId
  });

  enterJoinedState();
}

function handleTapPress(event) {
  event.preventDefault();

  if (alreadyTapped || !buildSaved) return;

  if (countdownActive) {
    alreadyTapped = true;
    tapReadout.textContent = "reaction: false start";
    tapHelpText.textContent = "false start";
    controllerStatus.textContent = "false start";
    updateTapVisual("false", "FALSE");
    updateTapAvailability();

    socket.emit("reaction-result", {
      player: playerRole,
      type: "false-start",
      sessionId
    });
    return;
  }

  if (!canTap || lightsOutTime === null) return;

  const reactionTime = Math.max(0, (performance.now() - lightsOutTime) / 1000);

  alreadyTapped = true;
  canTap = false;
  raceFinished = true;

  tapReadout.textContent = `reaction: ${reactionTime.toFixed(3)}s`;
  tapHelpText.textContent = "reaction sent";
  controllerStatus.textContent = "reaction sent";
  updateTapVisual("sent", reactionTime.toFixed(3));
  updateTapAvailability();

  socket.emit("reaction-result", {
    player: playerRole,
    type: "valid",
    reactionTime,
    sessionId
  });
}

function applyStateSync(state) {
  if (!state) return;

  bothPlayersReady = !!state.bothReady;

  const me = state[playerRole];
  if (!me) return;

  if (me.name && !playerNameInput.value.trim()) {
    playerNameInput.value = me.name;
  }

  if (me.ready) {
    buildSaved = true;
    setBuilderLocked(true);
    buildNote.textContent = "build saved";
  } else {
    buildSaved = false;
    setBuilderLocked(false);
    buildNote.textContent = "choose your parts, then press ready";
  }

  updateTapAvailability();
}

confirmNameBtn.addEventListener("click", joinRace);
playerNameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") joinRace();
});

frontPrevBtn.addEventListener("click", () => goPrev("front"));
frontNextBtn.addEventListener("click", () => goNext("front"));
bodyPrevBtn.addEventListener("click", () => goPrev("body"));
bodyNextBtn.addEventListener("click", () => goNext("body"));
rearPrevBtn.addEventListener("click", () => goPrev("rear"));
rearNextBtn.addEventListener("click", () => goNext("rear"));

readyBtn.addEventListener("click", saveBuild);
editBuildBtn.addEventListener("click", editBuild);

tapButton.addEventListener("pointerdown", handleTapPress);
tapButton.addEventListener("click", (event) => event.preventDefault());
tapButton.addEventListener(
  "touchstart",
  (event) => {
    event.preventDefault();
  },
  { passive: false }
);

socket.on("connect", () => {
  controllerStatus.textContent = "connected";
});

socket.on("state-sync", (state) => {
  applyStateSync(state);
});

socket.on("session-invalid", () => {
  controllerStatus.textContent = "session expired";
  tapHelpText.textContent = "scan the new qr";
  updateTapVisual("idle", "WAIT");
  tapButton.disabled = true;
});

socket.on("session-cleared", () => {
  controllerStatus.textContent = "session reset";
  tapHelpText.textContent = "scan the new qr";
  tapReadout.textContent = "reaction: waiting";
  updateTapVisual("idle", "WAIT");
  tapButton.disabled = true;
});

socket.on("reset-race", () => {
  resetTapState();
  controllerStatus.textContent = buildSaved ? "waiting for lights" : "save your build";
});

socket.on("light-step", () => {
  if (!buildSaved) return;

  countdownActive = true;
  canTap = false;
  alreadyTapped = false;
  lightsOutTime = null;
  raceStarted = false;
  raceFinished = false;

  controllerStatus.textContent = "hold";
  tapHelpText.textContent = "do not tap yet";
  updateTapVisual("armed", "HOLD");
  updateTapAvailability();
});

socket.on("lights-out", () => {
  if (!buildSaved) return;

  countdownActive = false;
  canTap = true;
  alreadyTapped = false;
  raceStarted = true;
  raceFinished = false;
  lightsOutTime = performance.now();

  controllerStatus.textContent = "tap now";
  tapHelpText.textContent = "tap now";
  updateTapVisual("go", "TAP");
  updateTapAvailability();
});

socket.on("race-finished", () => {
  canTap = false;
  countdownActive = false;
  updateTapAvailability();

  if (!alreadyTapped) {
    updateTapVisual("idle", "DONE");
    tapHelpText.textContent = "race finished";
  }
});

builderCard.classList.remove("hidden");
tapCard.classList.remove("hidden");
setBuilderLocked(false);
resetTapState();
loadParts();