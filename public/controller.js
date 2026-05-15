const socket = io();

const controllerTitle = document.getElementById("controllerTitle");
const controllerStatus = document.getElementById("controllerStatus");
const nameEntryPanel = document.getElementById("nameEntryPanel");
const playerNameInput = document.getElementById("playerNameInput");
const playerEmailInput = document.getElementById("playerEmailInput");
const joinWithNameBtn = document.getElementById("joinWithNameBtn");
const builderPanel = document.getElementById("builderPanel");
const singlePresetPanel = document.getElementById("singlePresetPanel");
const readyPanel = document.getElementById("readyPanel");
const confirmBuildBtn = document.getElementById("confirmBuildBtn");
const confirmPresetBtn = document.getElementById("confirmPresetBtn");
const editBuildBtn = document.getElementById("editBuildBtn");
const tapButton = document.getElementById("tapButton");
const phoneWinnerOverlay = document.getElementById("phoneWinnerOverlay");
const phoneWinnerText = document.getElementById("phoneWinnerText");

const frontImage = document.getElementById("frontImage");
const frontName = document.getElementById("frontName");
const frontStats = document.getElementById("frontStats");

const bodyImage = document.getElementById("bodyImage");
const bodyName = document.getElementById("bodyName");
const bodyStats = document.getElementById("bodyStats");

const rearImage = document.getElementById("rearImage");
const rearName = document.getElementById("rearName");
const rearStats = document.getElementById("rearStats");

const frontSelectBtn = document.getElementById("frontSelectBtn");
const bodySelectBtn = document.getElementById("bodySelectBtn");
const rearSelectBtn = document.getElementById("rearSelectBtn");

const frontSelectedText = document.getElementById("frontSelectedText");
const bodySelectedText = document.getElementById("bodySelectedText");
const rearSelectedText = document.getElementById("rearSelectedText");

const presetImage = document.getElementById("presetImage");
const presetName = document.getElementById("presetName");
const presetStats = document.getElementById("presetStats");
const presetSelectBtn = document.getElementById("presetSelectBtn");
const presetSelectedText = document.getElementById("presetSelectedText");

const massSummary = document.getElementById("massSummary");
const cdSummary = document.getElementById("cdSummary");
const readyMassText = document.getElementById("readyMassText");
const readyCdText = document.getElementById("readyCdText");

const params = new URLSearchParams(window.location.search);
const qrPlayer = params.get("player");
let sessionId = params.get("session") || null;

let currentPlayer = null;
let currentName = "";
let currentEmail = "";
let partsData = null;
let presetsData = [];
let currentMode = null;

let bothPlayersReady = false;
let raceArmed = false;
let raceStarted = false;
let raceFinished = false;

const currentIndexes = {
  front: 0,
  body: 0,
  rear: 0,
  preset: 0
};

const selectedIndexes = {
  front: null,
  body: null,
  rear: null,
  preset: null
};

let canTap = false;
let alreadyTapped = false;
let lightsOutTime = 0;
let lastTapPressAt = 0;

function formatMass(value) {
  return `${Number(value).toFixed(1)}g`;
}

function makeAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  return new AudioContextClass();
}

function playTapBuzzer() {
  try {
    const audioCtx = makeAudioContext();
    if (!audioCtx) return;
    const now = audioCtx.currentTime;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "square";
    osc.frequency.setValueAtTime(145, now);
    osc.frequency.linearRampToValueAtTime(120, now + 0.08);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.12);
  } catch (error) {
    console.log("tap buzzer failed", error);
  }
}

function playVictorySound() {
  try {
    const audioCtx = makeAudioContext();
    if (!audioCtx) return;
    const now = audioCtx.currentTime;

    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc1.type = "triangle";
    osc2.type = "sine";

    osc1.frequency.setValueAtTime(523.25, now);
    osc1.frequency.setValueAtTime(659.25, now + 0.12);
    osc1.frequency.setValueAtTime(783.99, now + 0.24);

    osc2.frequency.setValueAtTime(659.25, now);
    osc2.frequency.setValueAtTime(783.99, now + 0.12);
    osc2.frequency.setValueAtTime(1046.5, now + 0.24);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(audioCtx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.7);
    osc2.stop(now + 0.7);
  } catch (error) {
    console.log("victory sound failed", error);
  }
}

function firePhoneConfetti() {
  if (typeof confetti !== "function") return;

  confetti({
    particleCount: 120,
    spread: 90,
    startVelocity: 45,
    origin: { y: 0.55 }
  });

  setTimeout(() => {
    confetti({
      particleCount: 80,
      spread: 100,
      startVelocity: 40,
      origin: { y: 0.65 }
    });
  }, 250);
}

function triggerPhoneWinEffects() {
  firePhoneConfetti();
  playVictorySound();
}

function setButtonState(state, text) {
  tapButton.classList.remove("ready", "go", "false-start");
  if (state) tapButton.classList.add(state);
  tapButton.textContent = text;
}

function updateTapAvailability() {
  const hasBuild = currentMode === "singleplayer" ? !!getSelectedPreset() : !!getSelectedBuild();
  tapButton.disabled = !(currentPlayer && sessionId && hasBuild && bothPlayersReady && raceStarted && canTap && !alreadyTapped);
}

function updateEditBuildAvailability() {
  const lockBuild = raceArmed || raceStarted || raceFinished;
  editBuildBtn.disabled = lockBuild;
}

function resetTapState() {
  canTap = false;
  alreadyTapped = false;
  lightsOutTime = 0;
  lastTapPressAt = 0;
  tapButton.disabled = true;
  setButtonState("ready", "tap");
}

function showExpiredMessage() {
  nameEntryPanel.style.display = "block";
  builderPanel.style.display = "none";
  singlePresetPanel.style.display = "none";
  readyPanel.style.display = "none";
  phoneWinnerOverlay.style.display = "none";
  playerNameInput.value = "";
  playerEmailInput.value = "";
  currentPlayer = null;
  currentName = "";
  currentEmail = "";
  bothPlayersReady = false;
  raceArmed = false;
  raceStarted = false;
  raceFinished = false;
  controllerTitle.textContent = "car builder";
  controllerStatus.textContent = "session expired. scan the new qr";
  resetTapState();
  updateEditBuildAvailability();
}

function getSelectedBuild() {
  if (!partsData) return null;
  if (
    selectedIndexes.front === null ||
    selectedIndexes.body === null ||
    selectedIndexes.rear === null
  ) {
    return null;
  }

  const front = partsData.front[selectedIndexes.front];
  const body = partsData.body[selectedIndexes.body];
  const rear = partsData.rear[selectedIndexes.rear];

  const totalMass = Number((front.mass + body.mass + rear.mass).toFixed(1));
  const totalCd = Number((front.cd + body.cd + rear.cd).toFixed(3));

  return {
    front,
    body,
    rear,
    totalMass,
    totalCd
  };
}

function getSelectedPreset() {
  if (!presetsData.length || selectedIndexes.preset === null) return null;
  return presetsData[selectedIndexes.preset];
}

function getCurrentPart(type) {
  if (!partsData) return null;
  return partsData[type][currentIndexes[type]];
}

function getCurrentPreset() {
  if (!presetsData.length) return null;
  return presetsData[currentIndexes.preset];
}

function showBuilderPanel() {
  if (raceArmed || raceStarted || raceFinished) return;

  builderPanel.style.display = currentMode === "multiplayer" ? "block" : "none";
  singlePresetPanel.style.display = currentMode === "singleplayer" ? "block" : "none";
  readyPanel.style.display = "none";
}

function showReadyPanel() {
  builderPanel.style.display = "none";
  singlePresetPanel.style.display = "none";
  readyPanel.style.display = "block";
}

function updateEmailFieldVisibility() {
  if (currentMode === "singleplayer") {
    playerEmailInput.style.display = "none";
  } else {
    playerEmailInput.style.display = "block";
  }
}

function joinPlayerWithName() {
  const enteredName = playerNameInput.value.trim();
  const enteredEmail = playerEmailInput.value.trim();

  if (!enteredName) {
    controllerStatus.textContent = "enter your name first";
    return;
  }

  if (!qrPlayer || !sessionId) {
    showExpiredMessage();
    return;
  }

  currentPlayer = qrPlayer;
  currentName = enteredName;
  currentEmail = currentMode === "singleplayer" ? "" : enteredEmail;

  socket.emit("join", {
    role: currentPlayer,
    name: currentName,
    email: currentEmail,
    sessionId
  });

  controllerTitle.textContent = currentName;
  controllerStatus.textContent =
    currentMode === "singleplayer" ? "choose your car" : "choose your components";

  nameEntryPanel.style.display = "none";
  showBuilderPanel();

  renderBuilder();
  renderPresetChooser();
  updateTapAvailability();
  updateEditBuildAvailability();
}

function renderBuilder() {
  if (!partsData) return;

  const front = getCurrentPart("front");
  const body = getCurrentPart("body");
  const rear = getCurrentPart("rear");

  frontImage.src = front.image;
  frontName.textContent = front.name;
  frontStats.textContent = `${formatMass(front.mass)} • Cd ${front.cd.toFixed(3)}`;

  bodyImage.src = body.image;
  bodyName.textContent = body.name;
  bodyStats.textContent = `${formatMass(body.mass)} • Cd ${body.cd.toFixed(3)}`;

  rearImage.src = rear.image;
  rearName.textContent = rear.name;
  rearStats.textContent = `${formatMass(rear.mass)} • Cd ${rear.cd.toFixed(3)}`;

  updateSelectedUi();
  updateSummary();
}

function updateSelectedUi() {
  const frontSelected = selectedIndexes.front === currentIndexes.front;
  const bodySelected = selectedIndexes.body === currentIndexes.body;
  const rearSelected = selectedIndexes.rear === currentIndexes.rear;

  frontSelectBtn.classList.toggle("selected", frontSelected);
  bodySelectBtn.classList.toggle("selected", bodySelected);
  rearSelectBtn.classList.toggle("selected", rearSelected);

  frontSelectBtn.textContent = frontSelected ? "selected" : "select front";
  bodySelectBtn.textContent = bodySelected ? "selected" : "select body";
  rearSelectBtn.textContent = rearSelected ? "selected" : "select rear";

  frontSelectedText.textContent =
    selectedIndexes.front === null
      ? "not selected"
      : `selected: ${partsData.front[selectedIndexes.front].name}`;

  bodySelectedText.textContent =
    selectedIndexes.body === null
      ? "not selected"
      : `selected: ${partsData.body[selectedIndexes.body].name}`;

  rearSelectedText.textContent =
    selectedIndexes.rear === null
      ? "not selected"
      : `selected: ${partsData.rear[selectedIndexes.rear].name}`;
}

function updateSummary() {
  const selectedBuild = getSelectedBuild();

  if (!selectedBuild) {
    massSummary.textContent = "total mass: select all 3 parts";
    cdSummary.textContent = "total Cd: select all 3 parts";
    readyMassText.textContent = "total mass: waiting";
    readyCdText.textContent = "total Cd: waiting";
    confirmBuildBtn.disabled = true;
    return;
  }

  massSummary.textContent = `total mass: ${formatMass(selectedBuild.totalMass)}`;
  cdSummary.textContent = `total Cd: ${selectedBuild.totalCd.toFixed(3)}`;
  readyMassText.textContent = `total mass: ${formatMass(selectedBuild.totalMass)}`;
  readyCdText.textContent = `total Cd: ${selectedBuild.totalCd.toFixed(3)}`;
  confirmBuildBtn.disabled = false;
}

function renderPresetChooser() {
  if (!presetsData.length) return;

  const preset = getCurrentPreset();
  if (!preset) return;

  presetImage.src = preset.image;
  presetImage.className = `part-image preset-preview-image ${preset.colorClass || ""}`;
  presetName.textContent = preset.name;
  presetStats.textContent = `${formatMass(preset.totalMass)} • Cd ${preset.totalCd.toFixed(3)}`;

  const presetSelected = selectedIndexes.preset === currentIndexes.preset;
  presetSelectBtn.classList.toggle("selected", presetSelected);
  presetSelectBtn.textContent = presetSelected ? "selected" : "select car";

  presetSelectedText.textContent =
    selectedIndexes.preset === null
      ? "not selected"
      : `selected: ${presetsData[selectedIndexes.preset].name}`;

  const selectedPreset = getSelectedPreset();
  if (selectedPreset) {
    readyMassText.textContent = `total mass: ${formatMass(selectedPreset.totalMass)}`;
    readyCdText.textContent = `total Cd: ${selectedPreset.totalCd.toFixed(3)}`;
    confirmPresetBtn.disabled = false;
  } else {
    confirmPresetBtn.disabled = true;
  }
}

function cyclePart(type, direction) {
  if (!partsData) return;
  if (raceArmed || raceStarted || raceFinished) return;

  const maxIndex = partsData[type].length - 1;
  currentIndexes[type] += direction;

  if (currentIndexes[type] < 0) currentIndexes[type] = maxIndex;
  if (currentIndexes[type] > maxIndex) currentIndexes[type] = 0;

  renderBuilder();
}

function cyclePreset(direction) {
  if (!presetsData.length) return;
  if (raceArmed || raceStarted || raceFinished) return;

  const maxIndex = presetsData.length - 1;
  currentIndexes.preset += direction;

  if (currentIndexes.preset < 0) currentIndexes.preset = maxIndex;
  if (currentIndexes.preset > maxIndex) currentIndexes.preset = 0;

  renderPresetChooser();
}

function selectPart(type) {
  if (raceArmed || raceStarted || raceFinished) return;

  selectedIndexes[type] = currentIndexes[type];
  updateSelectedUi();
  updateSummary();
  updateTapAvailability();
}

function selectPreset() {
  if (raceArmed || raceStarted || raceFinished) return;

  selectedIndexes.preset = currentIndexes.preset;
  renderPresetChooser();
  updateTapAvailability();
}

function handleTapPress(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  const pressTime = performance.now();

  if (pressTime - lastTapPressAt < 180) return;
  lastTapPressAt = pressTime;

  const hasBuild = currentMode === "singleplayer" ? !!getSelectedPreset() : !!getSelectedBuild();

  if (!currentPlayer || !sessionId) return;
  if (!hasBuild) return;
  if (!bothPlayersReady) return;
  if (!raceArmed) return;

  if (!canTap) {
    if (alreadyTapped) return;

    playTapBuzzer();
    alreadyTapped = true;
    setButtonState("false-start", "false start");
    tapButton.disabled = true;

    socket.emit("reaction-result", {
      player: currentPlayer,
      type: "false-start",
      sessionId
    });
    return;
  }

  if (alreadyTapped) return;
  if (!raceStarted) return;
  if (!lightsOutTime) return;

  playTapBuzzer();
  alreadyTapped = true;

  const reactionTime = Math.max(0, (pressTime - lightsOutTime) / 1000);

  tapButton.disabled = true;
  setButtonState("ready", `${reactionTime.toFixed(3)}s`);

  socket.emit("reaction-result", {
    player: currentPlayer,
    type: "valid",
    reactionTime,
    sessionId
  });
}

joinWithNameBtn.addEventListener("click", joinPlayerWithName);

playerNameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    joinPlayerWithName();
  }
});

playerEmailInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    joinPlayerWithName();
  }
});

document.getElementById("frontPrevBtn").addEventListener("click", () => cyclePart("front", -1));
document.getElementById("frontNextBtn").addEventListener("click", () => cyclePart("front", 1));
document.getElementById("bodyPrevBtn").addEventListener("click", () => cyclePart("body", -1));
document.getElementById("bodyNextBtn").addEventListener("click", () => cyclePart("body", 1));
document.getElementById("rearPrevBtn").addEventListener("click", () => cyclePart("rear", -1));
document.getElementById("rearNextBtn").addEventListener("click", () => cyclePart("rear", 1));

document.getElementById("presetPrevBtn").addEventListener("click", () => cyclePreset(-1));
document.getElementById("presetNextBtn").addEventListener("click", () => cyclePreset(1));

frontSelectBtn.addEventListener("click", () => selectPart("front"));
bodySelectBtn.addEventListener("click", () => selectPart("body"));
rearSelectBtn.addEventListener("click", () => selectPart("rear"));
presetSelectBtn.addEventListener("click", () => selectPreset());

confirmBuildBtn.addEventListener("click", () => {
  if (raceArmed || raceStarted || raceFinished) return;

  if (!currentPlayer || !sessionId) {
    showExpiredMessage();
    return;
  }

  const build = getSelectedBuild();
  if (!build) {
    controllerStatus.textContent = "select all 3 parts first";
    return;
  }

  socket.emit("save-build", {
    player: currentPlayer,
    selection: {
      frontIndex: selectedIndexes.front,
      bodyIndex: selectedIndexes.body,
      rearIndex: selectedIndexes.rear
    },
    sessionId
  });

  controllerStatus.textContent = "waiting to start";
  showReadyPanel();
  resetTapState();
  updateTapAvailability();
  updateEditBuildAvailability();
});

confirmPresetBtn.addEventListener("click", () => {
  if (raceArmed || raceStarted || raceFinished) return;

  if (!currentPlayer || !sessionId) {
    showExpiredMessage();
    return;
  }

  const preset = getSelectedPreset();
  if (!preset) {
    controllerStatus.textContent = "select a car first";
    return;
  }

  socket.emit("save-singleplayer-car", {
    player: currentPlayer,
    presetId: preset.id,
    sessionId
  });

  controllerStatus.textContent = "ready to start";
  showReadyPanel();
  resetTapState();
  updateTapAvailability();
  updateEditBuildAvailability();
});

editBuildBtn.addEventListener("click", () => {
  if (raceArmed || raceStarted || raceFinished) return;

  controllerStatus.textContent = currentMode === "singleplayer" ? "choose your car" : "choose your components";
  showBuilderPanel();
  resetTapState();

  if (currentPlayer && sessionId) {
    socket.emit("edit-build", {
      player: currentPlayer,
      sessionId
    });
  }
});

tapButton.addEventListener("pointerdown", handleTapPress);
tapButton.addEventListener("click", (e) => e.preventDefault());
tapButton.addEventListener(
  "touchstart",
  (e) => {
    e.preventDefault();
  },
  { passive: false }
);

async function loadParts() {
  try {
    const response = await fetch("/api/parts");
    if (!response.ok) {
      controllerStatus.textContent = "parts failed to load";
      return;
    }

    partsData = await response.json();
    renderBuilder();
  } catch (error) {
    console.error(error);
    controllerStatus.textContent = "parts failed to load";
  }
}

async function loadPresets() {
  try {
    const response = await fetch("/api/presets");
    if (!response.ok) return;
    presetsData = await response.json();
    renderPresetChooser();
  } catch (error) {
    console.error(error);
  }
}

socket.on("state-sync", (state) => {
  if (!state || !state.sessionId) return;

  if (!sessionId) {
    sessionId = state.sessionId;
  }

  currentMode = state.mode;
  bothPlayersReady = !!state.bothReady;
  updateEmailFieldVisibility();

  if (!currentPlayer) {
    updateTapAvailability();
    updateEditBuildAvailability();
    return;
  }

  const myState = state[currentPlayer];
  if (!myState) {
    updateTapAvailability();
    updateEditBuildAvailability();
    return;
  }

  if (myState.name) {
    controllerTitle.textContent = myState.name;
  }

  if (currentMode === "singleplayer") {
    editBuildBtn.textContent = "change car";
  } else {
    editBuildBtn.textContent = "change build";
  }

  if (myState.ready && myState.build) {
    if (currentMode === "singleplayer") {
      const presetIndex = presetsData.findIndex((item) => item.id === myState.build.presetId);
      if (presetIndex >= 0) {
        selectedIndexes.preset = presetIndex;
        currentIndexes.preset = presetIndex;
      }
      renderPresetChooser();
    } else {
      selectedIndexes.front = myState.build.frontIndex;
      selectedIndexes.body = myState.build.bodyIndex;
      selectedIndexes.rear = myState.build.rearIndex;

      currentIndexes.front = myState.build.frontIndex;
      currentIndexes.body = myState.build.bodyIndex;
      currentIndexes.rear = myState.build.rearIndex;

      renderBuilder();
    }

    showReadyPanel();

    if (!raceArmed && !raceStarted && !raceFinished) {
      controllerStatus.textContent = bothPlayersReady ? "ready to start" : "waiting";
    }
  } else if (!raceArmed && !raceStarted && !raceFinished) {
    controllerStatus.textContent = currentMode === "singleplayer" ? "choose your car" : "choose your components";
    showBuilderPanel();
  }

  updateTapAvailability();
  updateEditBuildAvailability();
});

socket.on("session-invalid", () => {
  sessionId = null;
  showExpiredMessage();
});

socket.on("session-cleared", () => {
  if (currentMode === "singleplayer") {
    playerEmailInput.value = "";
  }
  sessionId = null;
  showExpiredMessage();
});

socket.on("reset-race", () => {
  raceArmed = false;
  raceStarted = false;
  raceFinished = false;
  resetTapState();
  controllerStatus.textContent = "waiting for green lights";
  phoneWinnerOverlay.style.display = "none";
  updateTapAvailability();
  updateEditBuildAvailability();
});

socket.on("race-started", () => {
  raceArmed = true;
  raceStarted = false;
  raceFinished = false;
  controllerStatus.textContent = "wait for lights out";
  updateTapAvailability();
  updateEditBuildAvailability();
});

socket.on("light-step", (step) => {
  raceArmed = true;
  raceStarted = false;
  raceFinished = false;
  canTap = false;
  alreadyTapped = false;
  tapButton.disabled = true;
  controllerStatus.textContent = `green lights ${step}/5`;
  updateTapAvailability();
  updateEditBuildAvailability();
});

socket.on("lights-out", () => {
  if (!bothPlayersReady) {
    resetTapState();
    return;
  }

  raceArmed = true;
  raceStarted = true;
  raceFinished = false;

  lightsOutTime = performance.now();
  lastTapPressAt = 0;
  canTap = true;
  alreadyTapped = false;

  setButtonState("go", "tap");
  controllerStatus.textContent = "tap now";
  updateTapAvailability();
  updateEditBuildAvailability();
});

socket.on("reaction-summary", (summary) => {
  canTap = false;
  tapButton.disabled = true;

  const winnerNormalized =
    summary.winner === "Player 1"
      ? "player1"
      : summary.winner === "Player 2"
      ? "player2"
      : summary.winner;

  const singleplayerFalseStart =
    currentMode === "singleplayer" && summary.winner === "False start";

  if (singleplayerFalseStart) {
    return;
  }

  if (winnerNormalized === currentPlayer || currentMode === "singleplayer") {
    triggerPhoneWinEffects();
  }
});

socket.on("race-finished", (payload) => {
  raceFinished = true;
  canTap = false;
  tapButton.disabled = true;
  updateEditBuildAvailability();

  if (currentMode === "singleplayer") {
    if (payload.winner === "False start") {
      controllerStatus.textContent = "false start";
    } else {
      phoneWinnerText.textContent = `${payload.winnerName} finished`;
      phoneWinnerOverlay.style.display = "flex";
    }
    return;
  }

  if (
    (currentPlayer === "player1" && payload.winner === "Player 1") ||
    (currentPlayer === "player2" && payload.winner === "Player 2")
  ) {
    phoneWinnerText.textContent = `${payload.winnerName} wins`;
    phoneWinnerOverlay.style.display = "flex";
  } else if (payload.winner === "Tie") {
    controllerStatus.textContent = "tie";
  } else {
    controllerStatus.textContent = `${payload.winnerName} wins`;
  }
});

resetTapState();
loadParts();
loadPresets();