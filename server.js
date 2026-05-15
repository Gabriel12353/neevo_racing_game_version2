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

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "host.html"));
});

app.get("/api/parts", (req, res) => {
  res.json(CAR_PARTS);
});

const SINGLEPLAYER_PRESETS = [
  {
    id: "regionals",
    name: "Regionals Car",
    totalMass: 59.0,
    totalCd: 0.510,
    image: "/assets/cars/orange/car1.png",
    colorClass: "preset-regionals",
    carFamily: 1
  },
  {
    id: "nationals",
    name: "Nationals Car",
    totalMass: 48.0,
    totalCd: 0.400,
    image: "/assets/cars/orange/car1.png",
    colorClass: "preset-nationals",
    carFamily: 1
  },
  {
    id: "solar",
    name: "Neevo Solar",
    totalMass: 50.4,
    totalCd: 0.424,
    image: "/assets/cars/white/car1.png",
    colorClass: "preset-yellow",
    carFamily: 1
  },
  {
    id: "crimson",
    name: "Neevo Crimson",
    totalMass: 51.0,
    totalCd: 0.432,
    image: "/assets/cars/white/car1.png",
    colorClass: "preset-red",
    carFamily: 1
  },
  {
    id: "pulse",
    name: "Neevo Pulse",
    totalMass: 49.8,
    totalCd: 0.416,
    image: "/assets/cars/white/car1.png",
    colorClass: "preset-green",
    carFamily: 1
  },
  {
    id: "velocity",
    name: "Neevo Velocity",
    totalMass: 50.8,
    totalCd: 0.428,
    image: "/assets/cars/white/car1.png",
    colorClass: "preset-blue",
    carFamily: 1
  }
];

app.get("/api/presets", (req, res) => {
  res.json(SINGLEPLAYER_PRESETS);
});

function createSessionId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

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

let currentMode = null;
let raceStarted = false;
let raceFinished = false;
let raceArmed = false;
let currentSessionId = createSessionId();

function getPublicState() {
  return {
    sessionId: currentSessionId,
    mode: currentMode,
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
    bothReady:
      currentMode === "singleplayer"
        ? players.player1.ready
        : players.player1.ready && players.player2.ready
  };
}

function emitStateSync() {
  io.emit("state-sync", getPublicState());
}

function resetRaceOnly() {
  raceStarted = false;
  raceFinished = false;
  raceArmed = false;
  players.player1.result = null;
  players.player2.result = null;
}

function resetPlayersKeepMode() {
  players = {
    player1: createPlayerState(),
    player2: createPlayerState()
  };
  raceStarted = false;
  raceFinished = false;
  raceArmed = false;
  currentSessionId = createSessionId();
}

function clearGameKeepMode() {
  players = {
    player1: createPlayerState(),
    player2: createPlayerState()
  };
  raceStarted = false;
  raceFinished = false;
  raceArmed = false;
  currentSessionId = createSessionId();
}

function fullClearGame() {
  players = {
    player1: createPlayerState(),
    player2: createPlayerState()
  };
  currentMode = null;
  raceStarted = false;
  raceFinished = false;
  raceArmed = false;
  currentSessionId = createSessionId();
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

  if (currentMode === "singleplayer") {
    if (!p1) return "No result";
    if (p1.type === "false-start") return "False start";
    if (p1.type === "valid") return "Player 1";
    return "No result";
  }

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

  if (currentMode === "singleplayer") {
    if (!players.player1.result) return;
  } else {
    if (!players.player1.result || !players.player2.result) return;
  }

  raceFinished = true;
  raceStarted = false;
  raceArmed = false;

  const summary = {
    player1: buildScoredResult("player1"),
    player2: currentMode === "multiplayer" ? buildScoredResult("player2") : null,
    mode: currentMode
  };

  summary.winner = getWinner(summary);
  summary.winnerName =
    currentMode === "singleplayer"
      ? players.player1.name || "player"
      : summary.winner === "Player 1"
      ? players.player1.name || "player 1"
      : summary.winner === "Player 2"
      ? players.player2.name || "player 2"
      : summary.winner === "Tie"
      ? "tie"
      : "no result";

  io.emit("reaction-summary", summary);
  io.emit("race-finished", {
    winner: summary.winner,
    winnerName: summary.winnerName,
    mode: currentMode
  });
}

function isValidSession(sessionId) {
  return typeof sessionId === "string" && sessionId === currentSessionId;
}

function buildSingleplayerPreset(presetId) {
  const preset = SINGLEPLAYER_PRESETS.find((item) => item.id === presetId);
  if (!preset) return null;

  return {
    mode: "singleplayer",
    presetId: preset.id,
    presetName: preset.name,
    totalMass: preset.totalMass,
    totalCd: preset.totalCd,
    image: preset.image,
    colorClass: preset.colorClass,
    carFamily: preset.carFamily
  };
}

io.on("connection", (socket) => {
  console.log("A user connected", socket.id, "| session:", currentSessionId);
  socket.emit("state-sync", getPublicState());

  socket.on("set-mode", (payload) => {
    const mode = payload?.mode;

    if (mode !== "multiplayer" && mode !== "singleplayer") return;

    currentMode = mode;
    resetPlayersKeepMode();

    io.emit("session-cleared", {
      sessionId: currentSessionId,
      mode: currentMode,
      keepMode: true
    });
    emitStateSync();

    console.log("Mode set:", currentMode, "| new session:", currentSessionId);
  });

  socket.on("join", (payload) => {
    const role = payload?.role;
    const name = payload?.name || "";
    const sessionId = payload?.sessionId;

    if (!players[role]) return;

    if (currentMode === "singleplayer" && role !== "player1") {
      socket.emit("session-invalid", { sessionId: currentSessionId });
      return;
    }

    if (!isValidSession(sessionId)) {
      socket.emit("session-invalid", { sessionId: currentSessionId });
      return;
    }

    players[role].name = String(name).trim().slice(0, 20);
    players[role].socketId = socket.id;

    emitStateSync();
  });

  socket.on("save-build", (data) => {
    if (!data || !data.player || !data.selection) return;
    if (!players[data.player]) return;
    if (currentMode !== "multiplayer") return;

    if (!isValidSession(data.sessionId)) {
      socket.emit("session-invalid", { sessionId: currentSessionId });
      return;
    }

    const build = buildSelection(data.selection);

    players[data.player].build = build;
    players[data.player].ready = true;
    players[data.player].result = null;

    emitStateSync();
  });

  socket.on("save-singleplayer-car", (data) => {
    if (!data || !data.player || !data.presetId) return;
    if (!players[data.player]) return;
    if (currentMode !== "singleplayer") return;

    if (!isValidSession(data.sessionId)) {
      socket.emit("session-invalid", { sessionId: currentSessionId });
      return;
    }

    const build = buildSingleplayerPreset(data.presetId);
    if (!build) return;

    players[data.player].build = build;
    players[data.player].ready = true;
    players[data.player].result = null;

    emitStateSync();
  });

  socket.on("edit-build", (data) => {
    if (!data || !data.player) return;
    if (!players[data.player]) return;
    if (raceArmed || raceStarted || raceFinished) return;

    if (!isValidSession(data.sessionId)) {
      socket.emit("session-invalid", { sessionId: currentSessionId });
      return;
    }

    players[data.player].ready = false;
    players[data.player].build = null;
    players[data.player].result = null;

    emitStateSync();
  });

  socket.on("clear-game", () => {
    clearGameKeepMode();
    io.emit("session-cleared", {
      sessionId: currentSessionId,
      mode: currentMode,
      keepMode: true
    });
    emitStateSync();
  });

  socket.on("reset-all", () => {
    fullClearGame();
    io.emit("session-cleared", {
      sessionId: currentSessionId,
      mode: currentMode,
      keepMode: false
    });
    emitStateSync();
  });

  socket.on("start-race", () => {
    if (currentMode === "singleplayer") {
      if (!players.player1.ready) return;
    } else {
      if (!(players.player1.ready && players.player2.ready)) return;
    }

    resetRaceOnly();
    raceArmed = true;
    io.emit("reset-race");
    io.emit("race-started");

    const lightStep = 1000;
    const randomDelay = 200 + Math.floor(Math.random() * 2801);

    setTimeout(() => io.emit("light-step", 1), 0);
    setTimeout(() => io.emit("light-step", 2), lightStep * 1);
    setTimeout(() => io.emit("light-step", 3), lightStep * 2);
    setTimeout(() => io.emit("light-step", 4), lightStep * 3);
    setTimeout(() => io.emit("light-step", 5), lightStep * 4);

    setTimeout(() => {
      if (!raceArmed || raceFinished) return;
      raceStarted = true;
      io.emit("lights-out");
    }, lightStep * 4 + randomDelay);
  });

  socket.on("reaction-result", (data) => {
    if (raceFinished) return;
    if (!data || !data.player || !data.type) return;
    if (!players[data.player]) return;

    if (!isValidSession(data.sessionId)) {
      socket.emit("session-invalid", { sessionId: currentSessionId });
      return;
    }

    if (!players[data.player].ready || !players[data.player].build) return;
    if (players[data.player].result !== null) return;

    if (data.type === "false-start") {
      if (!raceArmed || raceStarted) return;

      players[data.player].result = {
        type: "false-start",
        reactionTime: null
      };

      maybeFinishRace();
      return;
    }

    if (!raceStarted) return;

    if (data.type === "valid" && typeof data.reactionTime === "number") {
      players[data.player].result = {
        type: "valid",
        reactionTime: data.reactionTime
      };

      maybeFinishRace();
    }
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected", socket.id);
  });
});

server.listen(process.env.PORT || 3000, "0.0.0.0", () => {
  console.log("Server is running");
});