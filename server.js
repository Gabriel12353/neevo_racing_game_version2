const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const { CAR_PARTS, buildSelection } = require("./carParts");
const { simulateRun } = require("./physicsEngine");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/parts", (req, res) => {
  res.json(CAR_PARTS);
});

function createPlayerState() {
  return {
    ready: false,
    build: null,
    result: null,
    name: "",
    socketId: null
  };
}

let players = {
  player1: createPlayerState(),
  player2: createPlayerState()
};

let raceStarted = false;
let raceFinished = false;
let currentSessionId = Date.now().toString();

function getPublicState() {
  return {
    sessionId: currentSessionId,
    player1: {
      ready: players.player1.ready,
      build: players.player1.build,
      name: players.player1.name
    },
    player2: {
      ready: players.player2.ready,
      build: players.player2.build,
      name: players.player2.name
    },
    bothReady: players.player1.ready && players.player2.ready
  };
}

function resetRaceOnly() {
  raceStarted = false;
  raceFinished = false;
  players.player1.result = null;
  players.player2.result = null;
}

function fullClearGame() {
  players = {
    player1: createPlayerState(),
    player2: createPlayerState()
  };
  raceStarted = false;
  raceFinished = false;
  currentSessionId = Date.now().toString();
}

function buildPhysicsParams(build) {
  return {
    mass_g: build.totalMass,
    Cd: build.totalCd,
    area_cm2: 0.5,
    co2_thrust: 10.6,
    co2_duration: 0.5,
    wheel_friction: 1.0,
    wheel_diameter_mm: 25,
    bearing_quality: 2,
    track_length_m: 20,
    surface: "Regular",
    temperature: 20,
    pressure: 101.325,
    time_step: 0.001,
    enable_drag: true,
    enable_rolling: true,
    launch_technique: "Standard"
  };
}

function buildScoredResult(playerKey) {
  const player = players[playerKey];
  const result = player.result;

  if (!result || !player.build) return null;

  if (result.type === "false-start") {
    return {
      type: "false-start",
      name: player.name,
      build: player.build,
      reactionTime: null,
      trackTime: null,
      totalTime: null,
      score: null,
      topSpeed: null,
      avgSpeed: null,
      maxAccel: null
    };
  }

  const simulation = simulateRun(buildPhysicsParams(player.build));
  const trackTime = simulation.finish_time;
  const totalTime = result.reactionTime + trackTime;
  const score = totalTime * 100;

  return {
    type: "valid",
    name: player.name,
    build: player.build,
    reactionTime: result.reactionTime,
    trackTime,
    totalTime,
    score,
    topSpeed: simulation.top_speed,
    avgSpeed: simulation.avg_speed,
    maxAccel: simulation.max_accel
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

  if (p1 && p1.type === "valid" && !p2) return "Player 1";
  if (p2 && p2.type === "valid" && !p1) return "Player 2";

  if (p1 && p2 && p1.type === "valid" && p2.type === "valid") {
    if (p1.totalTime < p2.totalTime) return "Player 1";
    if (p2.totalTime < p1.totalTime) return "Player 2";
    return "Tie";
  }

  return "No result";
}

function maybeFinishRace() {
  if (raceFinished) return;
  if (!players.player1.result || !players.player2.result) return;

  raceFinished = true;
  raceStarted = false;

  const summary = {
    player1: buildScoredResult("player1"),
    player2: buildScoredResult("player2")
  };

  summary.winner = getWinner(summary);
  summary.winnerName =
    summary.winner === "Player 1"
      ? players.player1.name || "player 1"
      : summary.winner === "Player 2"
      ? players.player2.name || "player 2"
      : summary.winner === "Tie"
      ? "tie"
      : "no result";

  io.emit("reaction-summary", summary);
  io.emit("race-finished", {
    winner: summary.winner,
    winnerName: summary.winnerName
  });
}

io.on("connection", (socket) => {
  console.log("A user connected");
  socket.emit("state-sync", getPublicState());

  socket.on("join", (payload) => {
    const role = typeof payload === "string" ? payload : payload?.role;
    const name = typeof payload === "string" ? "" : payload?.name || "";
    const sessionId = typeof payload === "string" ? currentSessionId : payload?.sessionId;

    if (sessionId !== currentSessionId) {
      socket.emit("session-invalid", { sessionId: currentSessionId });
      return;
    }

    if (!players[role]) return;

    players[role].name = String(name).trim().slice(0, 20);
    players[role].socketId = socket.id;

    console.log(`User joined as ${role} with name ${players[role].name}`);
    io.emit("state-sync", getPublicState());
  });

  socket.on("save-build", (data) => {
    if (!data || !data.player || !data.selection || !data.sessionId) return;
    if (!players[data.player]) return;

    if (data.sessionId !== currentSessionId) {
      socket.emit("session-invalid", { sessionId: currentSessionId });
      return;
    }

    const build = buildSelection(data.selection);

    players[data.player].build = build;
    players[data.player].ready = true;
    players[data.player].result = null;

    io.emit("state-sync", getPublicState());

    console.log(
      `${data.player} build saved | mass ${build.totalMass}g | drag ${build.totalCd}`
    );
  });

  socket.on("edit-build", (data) => {
    if (!data || !data.player || !data.sessionId) return;
    if (!players[data.player]) return;

    if (data.sessionId !== currentSessionId) {
      socket.emit("session-invalid", { sessionId: currentSessionId });
      return;
    }

    players[data.player].ready = false;
    players[data.player].build = null;
    players[data.player].result = null;

    io.emit("state-sync", getPublicState());
  });

  socket.on("clear-game", () => {
    fullClearGame();
    io.emit("session-cleared", { sessionId: currentSessionId });
    io.emit("state-sync", getPublicState());
    console.log("game cleared");
  });

  socket.on("start-race", () => {
    if (!(players.player1.ready && players.player2.ready)) {
      console.log("Cannot start race. Both players are not ready.");
      return;
    }

    resetRaceOnly();
    io.emit("reset-race");

    const lightStep = 1000;
const randomDelay = 200 + Math.floor(Math.random() * 2801);

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
    if (!data || !data.player || !data.type || !data.sessionId) return;
    if (!players[data.player]) return;

    if (data.sessionId !== currentSessionId) {
      socket.emit("session-invalid", { sessionId: currentSessionId });
      return;
    }

    if (!players[data.player].ready || !players[data.player].build) return;
    if (players[data.player].result !== null) return;

    if (data.type === "false-start") {
      players[data.player].result = {
        type: "false-start",
        reactionTime: null
      };

      console.log(`${data.player} false start`);
      maybeFinishRace();
      return;
    }

    if (!raceStarted) return;

    if (data.type === "valid" && typeof data.reactionTime === "number") {
      players[data.player].result = {
        type: "valid",
        reactionTime: data.reactionTime
      };

      console.log(`${data.player} reaction ${data.reactionTime.toFixed(3)}s`);
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