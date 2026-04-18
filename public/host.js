const socket = io();

const qrPlayer1 = document.getElementById("qrPlayer1");
const qrPlayer2 = document.getElementById("qrPlayer2");
const startRaceBtn = document.getElementById("startRaceBtn");

const player1WeightEl = document.getElementById("player1Weight");
const player2WeightEl = document.getElementById("player2Weight");
const player1ResultEl = document.getElementById("player1Result");
const player2ResultEl = document.getElementById("player2Result");
const player1ScoreEl = document.getElementById("player1Score");
const player2ScoreEl = document.getElementById("player2Score");
const winnerBanner = document.getElementById("winnerBanner");
const centerStatus = document.getElementById("centerStatus");

const car1 = document.getElementById("car1");
const car2 = document.getElementById("car2");

const lights = [
  document.getElementById("light1"),
  document.getElementById("light2"),
  document.getElementById("light3"),
  document.getElementById("light4"),
  document.getElementById("light5")
];

const baseUrl = window.location.origin;

const player1Url = `${baseUrl}/controller.html?player=player1`;
const player2Url = `${baseUrl}/controller.html?player=player2`;

QRCode.toCanvas(qrPlayer1, player1Url, { width: 180 });
QRCode.toCanvas(qrPlayer2, player2Url, { width: 180 });

let car1Position = 25;
let car2Position = 25;

const winnerOverlay = document.createElement("div");
winnerOverlay.id = "winnerOverlay";
winnerOverlay.style.position = "fixed";
winnerOverlay.style.inset = "0";
winnerOverlay.style.display = "none";
winnerOverlay.style.alignItems = "center";
winnerOverlay.style.justifyContent = "center";
winnerOverlay.style.background = "rgba(0, 0, 0, 0.72)";
winnerOverlay.style.zIndex = "9999";
winnerOverlay.style.pointerEvents = "none";
winnerOverlay.innerHTML = `
  <div style="
    text-align:center;
    color:white;
    font-weight:900;
    font-size:88px;
    line-height:1.1;
    text-shadow:0 0 24px rgba(0,0,0,0.45);
  " id="winnerOverlayText">
    WINNER
  </div>
`;
document.body.appendChild(winnerOverlay);
const winnerOverlayText = document.getElementById("winnerOverlayText");

function resetLights() {
  lights.forEach((light) => {
    light.classList.remove("active");
  });
}

function resetCars() {
  car1Position = 25;
  car2Position = 25;

  car1.style.transition = "none";
  car2.style.transition = "none";

  car1.style.left = car1Position + "px";
  car2.style.left = car2Position + "px";
}

function resetBoard() {
  resetLights();
  resetCars();

  player1WeightEl.textContent = "Waiting";
  player2WeightEl.textContent = "Waiting";
  player1ResultEl.textContent = "Waiting";
  player2ResultEl.textContent = "Waiting";
  player1ScoreEl.textContent = "Waiting";
  player2ScoreEl.textContent = "Waiting";
  winnerBanner.textContent = "Winner: Waiting";
  centerStatus.textContent = "Press Start Race";
  winnerOverlay.style.display = "none";
}

function getFinishPosition(carEl) {
  const track = carEl.parentElement;
  const finishLine = track.querySelector(".finish-line");

  const trackRect = track.getBoundingClientRect();
  const finishRect = finishLine.getBoundingClientRect();
  const carRect = carEl.getBoundingClientRect();

  const finishXInsideTrack = finishRect.left - trackRect.left;
  const carWidth = carRect.width;

  return finishXInsideTrack - carWidth + 8;
}

function formatSeconds(value) {
  return `${value.toFixed(3)} s`;
}

function showWinnerOverlay(winner) {
  if (winner === "Player 1") {
    winnerOverlayText.textContent = "PLAYER 1 WINS!";
    winnerOverlay.style.display = "flex";
  } else if (winner === "Player 2") {
    winnerOverlayText.textContent = "PLAYER 2 WINS!";
    winnerOverlay.style.display = "flex";
  } else if (winner === "Tie") {
    winnerOverlayText.textContent = "IT'S A TIE!";
    winnerOverlay.style.display = "flex";
  } else if (winner === "Both false started") {
    winnerOverlayText.textContent = "BOTH FALSE STARTED";
    winnerOverlay.style.display = "flex";
  }
}

function moveCarsToResult(summary) {
  const finish1 = getFinishPosition(car1);
  const finish2 = getFinishPosition(car2);

  const p1 = summary.player1;
  const p2 = summary.player2;

  if (p1 && p1.type === "false-start" && p2 && p2.type === "false-start") {
    car1.style.transition = "left 0.7s ease-out";
    car2.style.transition = "left 0.7s ease-out";
    car1.style.left = "120px";
    car2.style.left = "120px";
    return;
  }

  if (p1 && p1.type === "false-start" && p2 && p2.type === "valid") {
    car1.style.transition = "left 0.7s ease-out";
    car2.style.transition = `left ${Math.max(0.8, p2.totalTime)}s linear`;
    car1.style.left = "120px";
    car2.style.left = `${finish2}px`;
    return;
  }

  if (p2 && p2.type === "false-start" && p1 && p1.type === "valid") {
    car1.style.transition = `left ${Math.max(0.8, p1.totalTime)}s linear`;
    car2.style.transition = "left 0.7s ease-out";
    car1.style.left = `${finish1}px`;
    car2.style.left = "120px";
    return;
  }

  if (p1 && p1.type === "valid" && p2 && p2.type === "valid") {
    const t1 = Math.max(0.8, p1.totalTime);
    const t2 = Math.max(0.8, p2.totalTime);

    car1.style.transition = `left ${t1}s linear`;
    car2.style.transition = `left ${t2}s linear`;

    car1.style.left = `${finish1}px`;
    car2.style.left = `${finish2}px`;
    return;
  }
}

startRaceBtn.addEventListener("click", () => {
  resetBoard();
  centerStatus.textContent = "Starting sequence...";
  socket.emit("start-race");
});

socket.on("reset-race", () => {
  resetBoard();
  centerStatus.textContent = "Get Ready...";
});

socket.on("light-step", (step) => {
  resetLights();

  for (let i = 0; i < step; i += 1) {
    lights[i].classList.add("active");
  }

  centerStatus.textContent = `Lights: ${step}/5`;
});

socket.on("lights-out", () => {
  resetLights();
  centerStatus.textContent = "TAP NOW!";
});

socket.on("reaction-summary", (summary) => {
  if (summary.player1) {
    if (summary.player1.weight !== null && summary.player1.weight !== undefined) {
      player1WeightEl.textContent = `${summary.player1.weight}g`;
    }

    if (summary.player1.type === "false-start") {
      player1ResultEl.textContent = "False Start";
      player1ScoreEl.textContent = "DQ";
    } else if (summary.player1.type === "valid") {
      player1ResultEl.textContent = formatSeconds(summary.player1.reactionTime);
      player1ScoreEl.textContent = formatSeconds(summary.player1.totalTime);
    }
  }

  if (summary.player2) {
    if (summary.player2.weight !== null && summary.player2.weight !== undefined) {
      player2WeightEl.textContent = `${summary.player2.weight}g`;
    }

    if (summary.player2.type === "false-start") {
      player2ResultEl.textContent = "False Start";
      player2ScoreEl.textContent = "DQ";
    } else if (summary.player2.type === "valid") {
      player2ResultEl.textContent = formatSeconds(summary.player2.reactionTime);
      player2ScoreEl.textContent = formatSeconds(summary.player2.totalTime);
    }
  }

  winnerBanner.textContent = `Winner: ${summary.winner}`;
  centerStatus.textContent = "Race Result";

  moveCarsToResult(summary);
  showWinnerOverlay(summary.winner);
});

socket.on("race-finished", (winner) => {
  console.log("Race finished:", winner);
});

resetBoard();