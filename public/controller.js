const socket = io();

const tapButton = document.getElementById("tapButton");
const controllerTitle = document.getElementById("controllerTitle");
const controllerStatus = document.getElementById("controllerStatus");
const joinButtons = document.getElementById("joinButtons");
const selectedWeightEl = document.getElementById("selectedWeight");
const weightSlider = document.getElementById("weightSlider");
const sliderValue = document.getElementById("sliderValue");

const params = new URLSearchParams(window.location.search);
const qrPlayer = params.get("player");

let currentPlayer = null;
let selectedWeight = 50;
let raceArmed = false;
let canReact = false;
let reactionSent = false;
let signalTime = 0;

const phoneOverlay = document.createElement("div");
phoneOverlay.id = "phoneOverlay";
phoneOverlay.style.position = "fixed";
phoneOverlay.style.inset = "0";
phoneOverlay.style.display = "none";
phoneOverlay.style.alignItems = "center";
phoneOverlay.style.justifyContent = "center";
phoneOverlay.style.background = "rgba(0, 0, 0, 0.82)";
phoneOverlay.style.zIndex = "9999";
phoneOverlay.style.padding = "24px";
phoneOverlay.style.boxSizing = "border-box";
phoneOverlay.innerHTML = `
  <div id="phoneOverlayText" style="
    text-align:center;
    font-weight:900;
    font-size:56px;
    line-height:1.1;
    color:white;
  ">RESULT</div>
`;
document.body.appendChild(phoneOverlay);

const phoneOverlayText = document.getElementById("phoneOverlayText");

function setButtonState(state, text) {
  tapButton.classList.remove("ready", "go", "false-start");

  if (state) {
    tapButton.classList.add(state);
  }

  tapButton.textContent = text;
}

function updateSelectedWeight(value) {
  selectedWeight = Number(value);
  sliderValue.textContent = `${selectedWeight}g`;
  selectedWeightEl.textContent = `Selected: ${selectedWeight}g`;
}

function showPhoneOverlay(message, color = "white") {
  phoneOverlayText.textContent = message;
  phoneOverlayText.style.color = color;
  phoneOverlay.style.display = "flex";
}

function hidePhoneOverlay() {
  phoneOverlay.style.display = "none";
}

updateSelectedWeight(weightSlider.value);

weightSlider.addEventListener("input", (event) => {
  updateSelectedWeight(event.target.value);
});

function joinPlayer(player) {
  currentPlayer = player;
  socket.emit("join", player);

  if (player === "player1") {
    controllerTitle.textContent = "Phone Controller • Player 1";
  } else if (player === "player2") {
    controllerTitle.textContent = "Phone Controller • Player 2";
  }

  joinButtons.style.display = "none";
  tapButton.disabled = false;
  controllerStatus.textContent = "Wait for lights out";
  setButtonState("ready", "READY");
}

if (qrPlayer === "player1" || qrPlayer === "player2") {
  joinPlayer(qrPlayer);
}

function handleReactionPress(event) {
  event.preventDefault();

  if (!currentPlayer || reactionSent) return;

  if (raceArmed && !canReact) {
    reactionSent = true;
    tapButton.disabled = true;
    setButtonState("false-start", "FALSE START");
    controllerStatus.textContent = "Too early!";

    socket.emit("reaction-result", {
      player: currentPlayer,
      type: "false-start",
      weight: selectedWeight
    });
    return;
  }

  if (!canReact) return;

  reactionSent = true;
  tapButton.disabled = true;

  const reactionTimeMs = Date.now() - signalTime;
  const reactionTimeSeconds = reactionTimeMs / 1000;

  setButtonState("go", "LOCKED");
  controllerStatus.textContent = `Reaction: ${reactionTimeSeconds.toFixed(3)} s`;

  socket.emit("reaction-result", {
    player: currentPlayer,
    type: "valid",
    reactionTime: reactionTimeSeconds,
    weight: selectedWeight
  });
}

tapButton.addEventListener("pointerdown", handleReactionPress);
tapButton.addEventListener("touchstart", handleReactionPress, { passive: false });

socket.on("reset-race", () => {
  raceArmed = false;
  canReact = false;
  reactionSent = false;
  signalTime = 0;

  hidePhoneOverlay();

  controllerStatus.textContent = "Wait for lights out";
  tapButton.disabled = false;
  setButtonState("ready", "READY");
});

socket.on("light-step", (step) => {
  raceArmed = true;
  canReact = false;
  tapButton.disabled = false;
  controllerStatus.textContent = `Lights sequence... ${step}/5`;
  setButtonState("ready", "WAIT");
});

socket.on("lights-out", () => {
  canReact = true;
  signalTime = Date.now();
  controllerStatus.textContent = "TAP NOW!";
  setButtonState("go", "TAP!");
});

socket.on("reaction-summary", (summary) => {
  raceArmed = false;
  canReact = false;

  if (!currentPlayer) return;

  const myResult = currentPlayer === "player1" ? summary.player1 : summary.player2;

  if (!myResult) return;

  if (myResult.type === "false-start") {
    setButtonState("false-start", "FALSE START");
    controllerStatus.textContent = "Too early!";
    return;
  }

  if (myResult.type === "valid") {
    setButtonState("go", `${myResult.reactionTime.toFixed(3)} s`);
    controllerStatus.textContent = `Finish: ${myResult.totalTime.toFixed(3)} s`;
  }
});

socket.on("race-finished", (winner) => {
  raceArmed = false;
  canReact = false;

  const amPlayer1 = currentPlayer === "player1";
  const amPlayer2 = currentPlayer === "player2";
  const iWon =
    (winner === "Player 1" && amPlayer1) ||
    (winner === "Player 2" && amPlayer2);

  if (winner === "Tie") {
    controllerStatus.textContent = "It's a tie";
    showPhoneOverlay("IT'S A TIE!", "#ff8a00");
    return;
  }

  if (winner === "Both false started") {
    controllerStatus.textContent = "Both false started";
    showPhoneOverlay("FALSE START", "#ff4d4f");
    return;
  }

  if (iWon) {
    controllerStatus.textContent = "YOU ARE THE WINNER!";
    showPhoneOverlay("YOU WIN!", "#39d353");
  } else {
    controllerStatus.textContent = `${winner} wins`;
    showPhoneOverlay("YOU LOSE", "#ff4d4f");
  }
});