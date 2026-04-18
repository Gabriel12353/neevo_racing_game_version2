const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

let raceStarted = false;
let raceFinished = false;

let results = {
  player1: null,
  player2: null
};

function resetRaceState() {
  raceStarted = false;
  raceFinished = false;
  results = {
    player1: null,
    player2: null
  };
}

function getTrackTimeFromMass(weight) {
  const numericWeight = Number(weight);

  if (Number.isNaN(numericWeight)) {
    return 1.0;
  }

  return 1.0 + (numericWeight - 50) * (0.7 / 30);
}

function buildScoredResult(playerResult) {
  if (!playerResult) return null;

  if (playerResult.type === "false-start") {
    return {
      ...playerResult,
      trackTime: null,
      totalTime: null,
      score: null
    };
  }

  const trackTime = getTrackTimeFromMass(playerResult.weight);
  const totalTime = playerResult.reactionTime + trackTime;
  const score = totalTime * 100;

  return {
    ...playerResult,
    trackTime,
    totalTime,
    score
  };
}

function getWinner(summary) {
  const p1 = summary.player1;
  const p2 = summary.player2;

  if (!p1 && !p2) return "No result";

  if (p1 && p1.type === "false-start" && p2 && p2.type === "false-start") {
    return "Both false started";
  }

  if (p1 && p1.type === "false-start" && p2 && p2.type === "valid") {
    return "Player 2";
  }

  if (p2 && p2.type === "false-start" && p1 && p1.type === "valid") {
    return "Player 1";
  }

  if (p1 && p1.type === "false-start" && !p2) return "Player 2";
  if (p2 && p2.type === "false-start" && !p1) return "Player 1";

  if (p1 && p2 && p1.type === "valid" && p2.type === "valid") {
    if (p1.totalTime < p2.totalTime) return "Player 1";
    if (p2.totalTime < p1.totalTime) return "Player 2";
    return "Tie";
  }

  if (p1 && p1.type === "valid" && !p2) return "Player 1";
  if (p2 && p2.type === "valid" && !p1) return "Player 2";

  return "No result";
}

function maybeFinishRace() {
  if (raceFinished) return;

  const p1Done = results.player1 !== null;
  const p2Done = results.player2 !== null;

  if (!p1Done || !p2Done) return;

  raceFinished = true;
  raceStarted = false;

  const scoredPlayer1 = buildScoredResult(results.player1);
  const scoredPlayer2 = buildScoredResult(results.player2);

  const summary = {
    player1: scoredPlayer1,
    player2: scoredPlayer2
  };

  summary.winner = getWinner(summary);

  io.emit("reaction-summary", summary);
  io.emit("race-finished", summary.winner);
}

io.on("connection", (socket) => {
  console.log("A user connected");

  socket.on("join", (role) => {
    console.log(`User joined as ${role}`);
    socket.broadcast.emit("player-joined", role);
  });

  socket.on("start-race", () => {
    console.log("SERVER RECEIVED start-race");

    resetRaceState();
    io.emit("reset-race");

    const lightStep = 700;
    const randomDelay = 1200 + Math.floor(Math.random() * 1800);

    setTimeout(() => io.emit("light-step", 1), lightStep * 1);
    setTimeout(() => io.emit("light-step", 2), lightStep * 2);
    setTimeout(() => io.emit("light-step", 3), lightStep * 3);
    setTimeout(() => io.emit("light-step", 4), lightStep * 4);
    setTimeout(() => io.emit("light-step", 5), lightStep * 5);

    setTimeout(() => {
      io.emit("lights-out");
      raceStarted = true;
      io.emit("race-started");
      console.log("LIGHTS OUT");
    }, lightStep * 5 + randomDelay);
  });

  socket.on("reaction-result", (data) => {
    if (raceFinished) return;
    if (!data || !data.player || !data.type) return;

    if (data.player !== "player1" && data.player !== "player2") return;
    if (results[data.player] !== null) return;

    if (data.type === "false-start") {
      results[data.player] = {
        type: "false-start",
        weight: Number(data.weight)
      };
      console.log(`${data.player} false start`);
      maybeFinishRace();
      return;
    }

    if (!raceStarted) return;

    if (data.type === "valid" && typeof data.reactionTime === "number") {
      results[data.player] = {
        type: "valid",
        reactionTime: data.reactionTime,
        weight: Number(data.weight)
      };
      console.log(`${data.player} reaction: ${data.reactionTime.toFixed(3)} s`);
      maybeFinishRace();
    }
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected");
  });
});

server.listen(process.env.PORT || 3000, "0.0.0.0", () => {
  console.log("Server is running");
});