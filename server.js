const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { CAR_PARTS, buildSelection } = require("./carParts");
const { simulateRun } = require("./physicsEngine");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "host.html"));
});

app.get("/api/parts", (req, res) => {
  res.json(CAR_PARTS);
});

const leaderboardFile = path.join(__dirname, "leaderboard.json");

function ensureLeaderboardFile() {
  if (!fs.existsSync(leaderboardFile)) {
    fs.writeFileSync(leaderboardFile, JSON.stringify([], null, 2), "utf8");
  }
}

function readLeaderboard() {
  try {
    ensureLeaderboardFile();
    const raw = fs.readFileSync(leaderboardFile, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Failed to read leaderboard:", error);
    return [];
  }
}

function writeLeaderboard(entries) {
  try {
    fs.writeFileSync(leaderboardFile, JSON.stringify(entries, null, 2), "utf8");
  } catch (error) {
    console.error("Failed to write leaderboard:", error);
  }
}

function addLeaderboardEntry(entry) {
  const entries = readLeaderboard();
  entries.push(entry);
  entries.sort((a, b) => a.totalTime - b.totalTime);
  writeLeaderboard(entries);
}

function getTopLeaderboard(limit = 20) {
  return readLeaderboard()
    .sort((a, b) => a.totalTime - b.totalTime)
    .slice(0, limit);
}

app.get("/api/leaderboard", (req, res) => {
  res.json(getTopLeaderboard(500));
});

app.get("/api/leaderboard-preview", (req, res) => {
  res.json(getTopLeaderboard(3));
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

function createGameId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function createAdminKey() {
  return crypto.randomBytes(18).toString("hex");
}

function createPlayerState() {
  return {
    ready: false,
    build: null,
    result: null,
    name: "",
    email: "",
    socketId: null
  };
}

function createGameState() {
  return {
    gameId: createGameId(),
    mode: null,
    sessionId: createSessionId(),
    adminKey: createAdminKey(),
    hostSocketId: null,
    players: {
      player1: createPlayerState(),
      player2: createPlayerState()
    },
    raceStarted: false,
    raceFinished: false,
    raceArmed: false,
    raceTimers: []
  };
}

const games = {};

function clearRaceTimers(game) {
  if (!game) return;
  game.raceTimers.forEach((timer) => clearTimeout(timer));
  game.raceTimers = [];
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

function getPublicState(game) {
  return {
    gameId: game.gameId,
    sessionId: game.sessionId,
    mode: game.mode,
    player1: {
      ready: game.players.player1.ready,
      build: game.players.player1.build,
      name: game.players.player1.name
    },
    player2: {
      ready: game.players.player2.ready,
      build: game.players.player2.build,
      name: game.players.player2.name
    },
    bothReady:
      game.mode === "singleplayer"
        ? game.players.player1.ready
        : game.players.player1.ready && game.players.player2.ready
  };
}

function emitStateSync(game) {
  io.to(game.gameId).emit("state-sync", getPublicState(game));
}

function resetRaceOnly(game) {
  clearRaceTimers(game);
  game.raceStarted = false;
  game.raceFinished = false;
  game.raceArmed = false;
  game.players.player1.result = null;
  game.players.player2.result = null;
}

function resetPlayersKeepMode(game) {
  clearRaceTimers(game);
  game.players = {
    player1: createPlayerState(),
    player2: createPlayerState()
  };
  game.sessionId = createSessionId();
  game.raceStarted = false;
  game.raceFinished = false;
  game.raceArmed = false;
}

function clearGameKeepMode(game) {
  clearRaceTimers(game);
  game.players = {
    player1: createPlayerState(),
    player2: createPlayerState()
  };
  game.sessionId = createSessionId();
  game.raceStarted = false;
  game.raceFinished = false;
  game.raceArmed = false;
}

function buildScoredResult(game, playerKey) {
  const player = game.players[playerKey];
  const result = player.result;

  if (!result || !player.build) return null;

  if (result.type === "false-start") {
    return {
      type: "false-start",
      name: player.name,
      email: player.email,
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
    email: player.email,
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

function getWinner(game, summary) {
  const p1 = summary.player1;
  const p2 = summary.player2;

  if (game.mode === "singleplayer") {
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

function storeMultiplayerWinner(game, summary) {
  if (game.mode !== "multiplayer") return;

  let winnerResult = null;
  let winnerLabel = null;

  if (summary.winner === "Player 1" && summary.player1?.type === "valid") {
    winnerResult = summary.player1;
    winnerLabel = "Player 1";
  } else if (summary.winner === "Player 2" && summary.player2?.type === "valid") {
    winnerResult = summary.player2;
    winnerLabel = "Player 2";
  }

  if (!winnerResult) return;

  addLeaderboardEntry({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    player: winnerLabel,
    name: winnerResult.name || winnerLabel,
    email: winnerResult.email || "",
    totalTime: Number(winnerResult.totalTime.toFixed(3)),
    reactionTime: Number(winnerResult.reactionTime.toFixed(3)),
    trackTime: Number(winnerResult.trackTime.toFixed(3)),
    mass: Number(winnerResult.build.totalMass.toFixed(1)),
    cd: Number(winnerResult.build.totalCd.toFixed(3)),
    createdAt: new Date().toISOString()
  });
}

function maybeFinishRace(game) {
  if (game.raceFinished) return;

  if (game.mode === "singleplayer") {
    if (!game.players.player1.result) return;
  } else {
    if (!game.players.player1.result || !game.players.player2.result) return;
  }

  clearRaceTimers(game);
  game.raceFinished = true;
  game.raceStarted = false;
  game.raceArmed = false;

  const summary = {
    player1: buildScoredResult(game, "player1"),
    player2: game.mode === "multiplayer" ? buildScoredResult(game, "player2") : null,
    mode: game.mode
  };

  summary.winner = getWinner(game, summary);
  summary.winnerName =
    game.mode === "singleplayer"
      ? game.players.player1.name || "player"
      : summary.winner === "Player 1"
      ? game.players.player1.name || "player 1"
      : summary.winner === "Player 2"
      ? game.players.player2.name || "player 2"
      : summary.winner === "Tie"
      ? "tie"
      : "no result";

  storeMultiplayerWinner(game, summary);

  io.to(game.gameId).emit("reaction-summary", summary);
  io.to(game.gameId).emit("race-finished", {
    winner: summary.winner,
    winnerName: summary.winnerName,
    mode: game.mode
  });
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

function getGame(gameId) {
  return typeof gameId === "string" ? games[gameId] : null;
}

function isValidSession(game, sessionId) {
  return !!game && typeof sessionId === "string" && sessionId === game.sessionId;
}

function isValidAdminKey(adminKey) {
  if (!adminKey || typeof adminKey !== "string") return false;
  return Object.values(games).some((game) => game.adminKey === adminKey);
}

app.delete("/api/leaderboard/:id", (req, res) => {
  try {
    const adminKey = req.headers["x-admin-key"];

    if (!isValidAdminKey(adminKey)) {
      return res.status(403).json({ ok: false, message: "Not allowed" });
    }

    const id = req.params.id;
    const entries = readLeaderboard();
    const nextEntries = entries.filter((entry) => entry.id !== id);

    if (nextEntries.length === entries.length) {
      return res.status(404).json({ ok: false, message: "Entry not found" });
    }

    writeLeaderboard(nextEntries);
    res.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete leaderboard entry:", error);
    res.status(500).json({ ok: false, message: "Delete failed" });
  }
});

io.on("connection", (socket) => {
  console.log("socket connected", socket.id);

  socket.on("host-create-game", () => {
    const game = createGameState();

    while (games[game.gameId]) {
      game.gameId = createGameId();
    }

    game.hostSocketId = socket.id;
    games[game.gameId] = game;

    socket.join(game.gameId);

    socket.emit("host-game-created", {
      gameId: game.gameId,
      sessionId: game.sessionId,
      adminKey: game.adminKey
    });

    emitStateSync(game);
  });

  socket.on("host-join-game", (payload) => {
    const game = getGame(payload?.gameId);
    if (!game) return;

    game.hostSocketId = socket.id;
    socket.join(game.gameId);

    socket.emit("host-game-created", {
      gameId: game.gameId,
      sessionId: game.sessionId,
      adminKey: game.adminKey
    });

    emitStateSync(game);
  });

  socket.on("set-mode", (payload) => {
    const game = getGame(payload?.gameId);
    const mode = payload?.mode;

    if (!game) return;
    if (mode !== "multiplayer" && mode !== "singleplayer") return;

    game.mode = mode;
    resetPlayersKeepMode(game);

    io.to(game.gameId).emit("session-cleared", {
      gameId: game.gameId,
      sessionId: game.sessionId,
      mode: game.mode,
      keepMode: true
    });

    emitStateSync(game);
  });

  socket.on("join", (payload) => {
    const game = getGame(payload?.gameId);
    const role = payload?.role;
    const name = payload?.name || "";
    const email = payload?.email || "";
    const sessionId = payload?.sessionId;

    if (!game) {
      socket.emit("session-invalid", { sessionId: null });
      return;
    }

    if (!game.players[role]) return;

    if (game.mode === "singleplayer" && role !== "player1") {
      socket.emit("session-invalid", { sessionId: game.sessionId });
      return;
    }

    if (!isValidSession(game, sessionId)) {
      socket.emit("session-invalid", { sessionId: game.sessionId });
      return;
    }

    game.players[role].name = String(name).trim().slice(0, 20);
    game.players[role].email = String(email).trim().slice(0, 120);
    game.players[role].socketId = socket.id;

    socket.join(game.gameId);
    emitStateSync(game);
  });

  socket.on("save-build", (data) => {
    const game = getGame(data?.gameId);

    if (!game) return;
    if (!data || !data.player || !data.selection) return;
    if (!game.players[data.player]) return;
    if (game.mode !== "multiplayer") return;

    if (!isValidSession(game, data.sessionId)) {
      socket.emit("session-invalid", { sessionId: game.sessionId });
      return;
    }

    const build = buildSelection(data.selection);

    game.players[data.player].build = build;
    game.players[data.player].ready = true;
    game.players[data.player].result = null;

    emitStateSync(game);
  });

  socket.on("save-singleplayer-car", (data) => {
    const game = getGame(data?.gameId);

    if (!game) return;
    if (!data || !data.player || !data.presetId) return;
    if (!game.players[data.player]) return;
    if (game.mode !== "singleplayer") return;

    if (!isValidSession(game, data.sessionId)) {
      socket.emit("session-invalid", { sessionId: game.sessionId });
      return;
    }

    const build = buildSingleplayerPreset(data.presetId);
    if (!build) return;

    game.players[data.player].build = build;
    game.players[data.player].ready = true;
    game.players[data.player].result = null;

    emitStateSync(game);
  });

  socket.on("edit-build", (data) => {
    const game = getGame(data?.gameId);

    if (!game) return;
    if (!data || !data.player) return;
    if (!game.players[data.player]) return;
    if (game.raceArmed || game.raceStarted || game.raceFinished) return;

    if (!isValidSession(game, data.sessionId)) {
      socket.emit("session-invalid", { sessionId: game.sessionId });
      return;
    }

    game.players[data.player].ready = false;
    game.players[data.player].build = null;
    game.players[data.player].result = null;

    emitStateSync(game);
  });

  socket.on("clear-game", (data) => {
    const game = getGame(data?.gameId);
    if (!game) return;

    clearGameKeepMode(game);

    io.to(game.gameId).emit("session-cleared", {
      gameId: game.gameId,
      sessionId: game.sessionId,
      mode: game.mode,
      keepMode: true
    });

    emitStateSync(game);
  });

  socket.on("start-race", (data) => {
    const game = getGame(data?.gameId);
    if (!game) return;

    if (game.mode === "singleplayer") {
      if (!game.players.player1.ready) return;
    } else {
      if (!(game.players.player1.ready && game.players.player2.ready)) return;
    }

    resetRaceOnly(game);

    game.raceArmed = true;
    game.raceFinished = false;
    game.raceStarted = false;

    io.to(game.gameId).emit("reset-race");
    io.to(game.gameId).emit("race-started");

    const randomDelay = 200 + Math.floor(Math.random() * 2801);

    const scheduleStep = (delayMs, stepNumber) => {
      const timer = setTimeout(() => {
        if (!game.raceArmed || game.raceFinished) return;
        io.to(game.gameId).emit("light-step", stepNumber);
      }, delayMs);
      game.raceTimers.push(timer);
    };

    scheduleStep(1000, 1);
    scheduleStep(2000, 2);
    scheduleStep(3000, 3);
    scheduleStep(4000, 4);
    scheduleStep(5000, 5);

    const lightsOutTimer = setTimeout(() => {
      if (!game.raceArmed || game.raceFinished) return;
      game.raceStarted = true;
      io.to(game.gameId).emit("lights-out");
    }, 5000 + randomDelay);

    game.raceTimers.push(lightsOutTimer);
  });

  socket.on("reaction-result", (data) => {
    const game = getGame(data?.gameId);

    if (!game) return;
    if (game.raceFinished) return;
    if (!data || !data.player || !data.type) return;
    if (!game.players[data.player]) return;

    if (!isValidSession(game, data.sessionId)) {
      socket.emit("session-invalid", { sessionId: game.sessionId });
      return;
    }

    if (!game.players[data.player].ready || !game.players[data.player].build) return;
    if (game.players[data.player].result !== null) return;

    if (data.type === "false-start") {
      if (!game.raceArmed || game.raceStarted) return;

      game.players[data.player].result = {
        type: "false-start",
        reactionTime: null
      };

      maybeFinishRace(game);
      return;
    }

    if (!game.raceStarted) return;

    if (data.type === "valid" && typeof data.reactionTime === "number") {
      game.players[data.player].result = {
        type: "valid",
        reactionTime: data.reactionTime
      };

      maybeFinishRace(game);
    }
  });

  socket.on("disconnect", () => {
    console.log("socket disconnected", socket.id);
  });
});

ensureLeaderboardFile();

server.listen(process.env.PORT || 3000, "0.0.0.0", () => {
  console.log("Server is running");
});