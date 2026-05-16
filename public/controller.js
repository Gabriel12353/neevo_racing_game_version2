const socket = io();


const controllerTitle = document.getElementById("controllerTitle");
const controllerStatus = document.getElementById("controllerStatus");
const nameEntryPanel = document.getElementById("nameEntryPanel");
const playerNameInput = document.getElementById("playerNameInput");
const joinWithNameBtn = document.getElementById("joinWithNameBtn");
const builderPanel = document.getElementById("builderPanel");
const readyPanel = document.getElementById("readyPanel");
const confirmBuildBtn = document.getElementById("confirmBuildBtn");
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


const massSummary = document.getElementById("massSummary");
const cdSummary = document.getElementById("cdSummary");
const readyMassText = document.getElementById("readyMassText");
const readyCdText = document.getElementById("readyCdText");


const params = new URLSearchParams(window.location.search);
const qrPlayer = params.get("player");
let sessionId = params.get("session") || null;


let currentPlayer = null;
let currentName = "";
let partsData = null;


let bothPlayersReady = false;
let raceArmed = false;
let raceStarted = false;
let raceFinished = false;


const currentIndexes = {
  front: 0,
  body: 0,
  rear: 0
};


const selectedIndexes = {
  front: null,
  body: null,
  rear: null
};


let canTap = false;
let alreadyTapped = false;
let lightsOutTime = 0;
let lastTapPressAt = 0;


function isPlayerTwo() {
  return currentPlayer === "player2";
}


function getPlayerAssetPath(originalPath) {
  if (!originalPath) return originalPath;
  if (!isPlayerTwo()) return originalPath;


  const match = originalPath.match(/^\/assets\/parts\/(front|body|rear)\/([a-z]+)(\d+)\.png$/i);
  if (!match) return originalPath;


  const folder = match[1];
  const baseName = match[2];
  const number = match[3];


  return `/assets/parts/${folder}/w${baseName}${number}.png`;
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


  const totalMass = front.mass + body.mass + rear.mass;
  const totalCd = Number((front.cd + body.cd + rear.cd).toFixed(3));


  return {
    front,
    body,
    rear,
    totalMass,
    totalCd
  };
}


function updateTapAvailability() {
  const hasBuild = !!getSelectedBuild();
  tapButton.disabled = !(currentPlayer && sessionId && hasBuild && bothPlayersReady && raceStarted && canTap && !alreadyTapped);
}


function updateEditBuildAvailability() {
  const lockBuild = raceArmed || raceStarted || raceFinished;
  editBuildBtn.disabled = lockBuild;
}


function resetTapState() {
  canTap = false;
  alreadyTapped = false;
  tapButton.disabled = true;
  setButtonState("ready", "tap");
}


function showExpiredMessage() {
  nameEntryPanel.style.display = "block";
  builderPanel.style.display = "none";
  readyPanel.style.display = "none";
  phoneWinnerOverlay.style.display = "none";
  playerNameInput.value = "";
  currentPlayer = null;
  currentName = "";
  bothPlayersReady = false;
  raceArmed = false;
  raceStarted = false;
  raceFinished = false;
  controllerTitle.textContent = "car builder";
  controllerStatus.textContent = "session expired. scan the new qr";
  resetTapState();
  updateEditBuildAvailability();
}


function joinPlayerWithName() {
  const enteredName = playerNameInput.value.trim();


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


  socket.emit("join", {
    role: currentPlayer,
    name: currentName,
    sessionId
  });


  controllerTitle.textContent = currentName;
  controllerStatus.textContent = "choose your components";
  nameEntryPanel.style.display = "none";
  builderPanel.style.display = "block";


  renderBuilder();
  updateTapAvailability();
  updateEditBuildAvailability();
}


function getCurrentPart(type) {
  if (!partsData) return null;
  return partsData[type][currentIndexes[type]];
}


function renderBuilder() {
  if (!partsData) return;


  const front = getCurrentPart("front");
  const body = getCurrentPart("body");
  const rear = getCurrentPart("rear");


  frontImage.src = getPlayerAssetPath(front.image);
  frontName.textContent = front.name;
  frontStats.textContent = `${front.mass}g • Cd ${front.cd.toFixed(3)}`;


  bodyImage.src = getPlayerAssetPath(body.image);
  bodyName.textContent = body.name;
  bodyStats.textContent = `${body.mass}g • Cd ${body.cd.toFixed(3)}`;


  rearImage.src = getPlayerAssetPath(rear.image);
  rearName.textContent = rear.name;
  rearStats.textContent = `${rear.mass}g • Cd ${rear.cd.toFixed(3)}`;


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


  massSummary.textContent = `total mass: ${selectedBuild.totalMass}g`;
  cdSummary.textContent = `total Cd: ${selectedBuild.totalCd.toFixed(3)}`;
  readyMassText.textContent = `total mass: ${selectedBuild.totalMass}g`;
  readyCdText.textContent = `total Cd: ${selectedBuild.totalCd.toFixed(3)}`;
  confirmBuildBtn.disabled = false;
}


function showBuilderPanel() {
  if (raceArmed || raceStarted || raceFinished) return;
  builderPanel.style.display = "block";
  readyPanel.style.display = "none";
}


function showReadyPanel() {
  builderPanel.style.display = "none";
  readyPanel.style.display = "block";
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


function selectPart(type) {
  if (raceArmed || raceStarted || raceFinished) return;


  selectedIndexes[type] = currentIndexes[type];
  updateSelectedUi();
  updateSummary();
  updateTapAvailability();
}


function handleTapPress(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }


  const now = Date.now();
  if (now - lastTapPressAt < 180) return;
  lastTapPressAt = now;


  if (!currentPlayer || !sessionId) return;
  if (!getSelectedBuild()) return;
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


  playTapBuzzer();
  alreadyTapped = true;


  const reactionTime = (performance.now() - lightsOutTime) / 1000;


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


document.getElementById("frontPrevBtn").addEventListener("click", () => cyclePart("front", -1));
document.getElementById("frontNextBtn").addEventListener("click", () => cyclePart("front", 1));
document.getElementById("bodyPrevBtn").addEventListener("click", () => cyclePart("body", -1));
document.getElementById("bodyNextBtn").addEventListener("click", () => cyclePart("body", 1));
document.getElementById("rearPrevBtn").addEventListener("click", () => cyclePart("rear", -1));
document.getElementById("rearNextBtn").addEventListener("click", () => cyclePart("rear", 1));


frontSelectBtn.addEventListener("click", () => selectPart("front"));
bodySelectBtn.addEventListener("click", () => selectPart("body"));
rearSelectBtn.addEventListener("click", () => selectPart("rear"));


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


  controllerStatus.textContent = "waiting for both players";
  showReadyPanel();
  resetTapState();
  updateTapAvailability();
  updateEditBuildAvailability();
});


editBuildBtn.addEventListener("click", () => {
  if (raceArmed || raceStarted || raceFinished) return;


  controllerStatus.textContent = "choose your components";
  showBuilderPanel();
  resetTapState();


  if (currentPlayer && sessionId) {
    socket.emit("edit-build", {
      player: currentPlayer,
      sessionId
    });
  }
});


tapButton.addEventListener("pointerup", handleTapPress);
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
    updateTapAvailability();
    updateEditBuildAvailability();
  } catch (error) {
    console.error(error);
    controllerStatus.textContent = "parts failed to load";
  }
}


socket.on("state-sync", (state) => {
  if (!state || !state.sessionId) return;


  if (!sessionId) {
    sessionId = state.sessionId;
  }


  bothPlayersReady = !!state.bothReady;


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


  if (myState.ready && myState.build) {
    selectedIndexes.front = myState.build.frontIndex;
    selectedIndexes.body = myState.build.bodyIndex;
    selectedIndexes.rear = myState.build.rearIndex;


    currentIndexes.front = myState.build.frontIndex;
    currentIndexes.body = myState.build.bodyIndex;
    currentIndexes.rear = myState.build.rearIndex;


    renderBuilder();
    showReadyPanel();


    if (!raceArmed && !raceStarted && !raceFinished) {
      controllerStatus.textContent = bothPlayersReady ? "ready to start" : "waiting for both players";
    }
  } else if (!raceArmed && !raceStarted && !raceFinished) {
    controllerStatus.textContent = "choose your components";
  }


  updateTapAvailability();
  updateEditBuildAvailability();
});


socket.on("session-invalid", () => {
  sessionId = null;
  showExpiredMessage();
});


socket.on("session-cleared", () => {
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


  if (winnerNormalized === currentPlayer) {
    triggerPhoneWinEffects();
  }
});


socket.on("race-finished", (payload) => {
  raceFinished = true;
  canTap = false;
  tapButton.disabled = true;
  updateEditBuildAvailability();


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
