/**
 * Multi-room orchestrator (incremental upgrade).
 * Keeps old events but routes gameplay per room.
 */

import { randomUUID } from "crypto";
import { EVENTS, SERVER_EVENTS } from "../../shared/protocol.js";
import { ROOM_EVENTS, ROOM_SERVER_EVENTS } from "../../shared/events.js";
import { RoomLobby, generateUniqueRoomCode } from "../lobby/lobby.js";

// dynamic sim import
let sim = null;
try {
  sim = await import("../game/sim.js");
} catch (e) {
  console.warn("Game sim not available:", e.message);
}

/** @type {import("socket.io").Server} */
let io = null;

// --- Session registry (socketId -> name) ---
const sessions = new Map();
// --- Reconnect reservation (sessionKey -> reservation) ---
const reconnectReservations = new Map();

// --- Rooms (roomCode -> { lobby, gameState, loopId }) ---
const rooms = new Map();


const RECONNECT_GRACE_MS = 30000;

/** @type {ReturnType<typeof setInterval> | null} */
let gameLoopId = null;

const TICK_MS = 1000 / 60;

export function createGameServer(socketServer) {
  io = socketServer;

  io.on("connection", (socket) => {

    socket.on(EVENTS.JOIN, (payload) => handleSessionJoin(socket, payload));

    socket.on(ROOM_EVENTS.ROOM_CREATE, () => handleCreateRoom(socket));
    socket.on(ROOM_EVENTS.ROOM_JOIN, (payload) => handleJoinRoom(socket, payload));
    socket.on(ROOM_EVENTS.ROOM_RESTORE, () => handleRoomRestore(socket));
    socket.on(ROOM_EVENTS.ROOM_LEAVE, () => handleLeaveRoom(socket));
    socket.on(ROOM_EVENTS.ROOM_RENAME, (payload) => handleRename(socket, payload));
    socket.on(ROOM_EVENTS.ROOM_REMOVE_PLAYER, (payload) => handleRemovePlayer(socket, payload));

    socket.on("lobby:ready:set", (payload) => handleReady(socket, payload));
    socket.on("lobby:bot:add", () => handleAddBot(socket));

    socket.on(EVENTS.START, () => handleStart(socket));
    socket.on(EVENTS.PAUSE, () => handlePause(socket));
    socket.on(EVENTS.RESUME, () => handleResume(socket));
    socket.on(EVENTS.QUIT, () => handleQuit(socket));

    socket.on("chat:send", (payload) => handleChat(socket, payload));

    socket.on(EVENTS.INPUT, (payload) => {
      if (!sim) return;

      const code = getRoomCode(socket);
      if (!code) return;

      const room = rooms.get(code);
      if (!room || !room.gameState || room.paused) return;

      sim.applyPlayerInput(room.gameState, payload);
    });

    socket.on("disconnect", () => handleDisconnect(socket));
  });
}

/* =========================================================
   SESSION
   ========================================================= */

function handleSessionJoin(socket, payload) {
  const name = String(payload?.name || "").trim();
  if (!name) {
    socket.emit(SERVER_EVENTS.JOIN_ERR, { message: "Name is required" });
    return;
  }

  const sessionKey = normalizeSessionKey(payload?.sessionKey);
  sessions.set(socket.id, { name, sessionKey });
  socket.emit(SERVER_EVENTS.JOIN_OK, { name, sessionKey });
  socket.emit(ROOM_SERVER_EVENTS.SESSION_NAME, { name });
}

/* =========================================================
   ROOM MANAGEMENT
   ========================================================= */

function getRoomCode(socket) {
  return socket.data?.roomCode || null;
}

function setRoomCode(socket, code) {
  socket.data = socket.data || {};
  socket.data.roomCode = code;
}

function clearRoomCode(socket) {
  if (socket.data) socket.data.roomCode = null;
}

function handleCreateRoom(socket) {
  const session = sessions.get(socket.id);
  if (!session) return;

  if (getRoomCode(socket)) return;

  const code = generateUniqueRoomCode(new Set(rooms.keys()));
  const lobby = new RoomLobby(code);

  const add = lobby.addHuman(socket.id, session.name, session.sessionKey);
  if (!add.ok) {
    socket.emit("room:err", { message: add.message });
    return;
  }

  rooms.set(code, { lobby, gameState: null, loopId: null, pausedBy: null });

  socket.join(code);
  setRoomCode(socket, code);

  socket.emit("room:joined", getRoomStateForSocket(rooms.get(code), socket.id));
  broadcastRoomState(code);
}

function handleRoomRestore(socket) {
  const session = sessions.get(socket.id);
  if (!session?.sessionKey) return;

  const reservation = reconnectReservations.get(session.sessionKey);
  if (!reservation) return;
  if (Date.now() > reservation.expiresAt) {
    clearReconnectReservation(session.sessionKey);
    return;
  }

  const room = rooms.get(reservation.roomCode);
  if (!room) {
    clearReconnectReservation(session.sessionKey);
    return;
  }

  const result = room.lobby.reconnectPlayer(reservation.playerId, socket.id, session.name);
  if (!result.ok) {
    clearReconnectReservation(session.sessionKey);
    return;
  }

  clearReconnectReservation(session.sessionKey);
  socket.join(reservation.roomCode);
  setRoomCode(socket, reservation.roomCode);
  if (room.gameState && sim?.getSnapshot) {
    io.to(socket.id).emit(SERVER_EVENTS.GAME_START, {
      snapshot: sim.getSnapshot(room.gameState),
      playerId: result.player.id,
    });
  } else {
    socket.emit("room:joined", getRoomStateForSocket(room, socket.id));
  }
  broadcastRoomState(reservation.roomCode);
}

function handleJoinRoom(socket, payload) {
  const session = sessions.get(socket.id);
  if (!session) return;

  const code = String(payload?.roomCode || "").trim().toUpperCase();
  if (!code) return;

  const room = rooms.get(code);
  if (!room) {
    socket.emit("room:err", { message: "Room not found" });
    return;
  }

  const add = room.lobby.addHuman(socket.id, session.name, session.sessionKey);
  if (!add.ok) {
    socket.emit("room:err", { message: add.message });
    return;
  }

  socket.join(code);
  setRoomCode(socket, code);

  socket.emit("room:joined", getRoomStateForSocket(room, socket.id));
  broadcastRoomState(code);
}

function handleLeaveRoom(socket) {
  const code = getRoomCode(socket);
  if (!code) return;

  const room = rooms.get(code);
  if (!room) return;

  const removed = room.lobby.removeBySocket(socket.id);
  if (removed?.sessionKey) clearReconnectReservation(removed.sessionKey);

  socket.leave(code);
  clearRoomCode(socket);

  if (room.lobby.playerCount === 0) {
    if (room.gameState) {
      stopRoom(code);
    }
    rooms.delete(code);
    return;
  }

  broadcastRoomState(code);
}

function handleRename(socket, payload) {
  const nextName = String(payload?.name || "").trim();
  if (!nextName) {
    socket.emit("room:err", { message: "Name is required" });
    return;
  }

  if (nextName.length > 20) {
    socket.emit("room:err", { message: "Name must be 20 characters or less" });
    return;
  }

  const code = getRoomCode(socket);
  const session = sessions.get(socket.id);
  if (!session) return;

  if (!code) {
    // Pre-room rename: update session name used by future room create/join.
    session.name = nextName;
    socket.emit(ROOM_SERVER_EVENTS.SESSION_NAME, { name: session.name });
    return;
  }

  const room = rooms.get(code);
  if (!room) return;

  const result = room.lobby.renameBySocket(socket.id, nextName);
  if (!result.ok) {
    socket.emit("room:err", { message: result.message });
    return;
  }

  if (session) session.name = result.player.name;
  socket.emit(ROOM_SERVER_EVENTS.SESSION_NAME, { name: session.name });
  broadcastRoomState(code);
}

/**
 * Handle a player disconnecting from the server.
 *
 * 1. Remove the player from the lobby.
 * 2. Notify all other players that someone left via PLAYER_LEFT event.
 * 3. Broadcast updated lobby state to all clients.
 */
function handleDisconnect(socket) {
  const code = getRoomCode(socket);
  const session = sessions.get(socket.id);
  if (code && session?.sessionKey) {
    const room = rooms.get(code);
    if (room) {
      const disconnected = room.lobby.markDisconnectedBySocket(socket.id);
      if (disconnected) {
        clearRoomCode(socket);
        reserveReconnect(session.sessionKey, {
          roomCode: code,
          playerId: disconnected.id,
        });
        broadcastRoomState(code);
      } else {
        handleLeaveRoom(socket);
      }
    }
  } else {
    handleLeaveRoom(socket);
  }
  sessions.delete(socket.id);
}

/* =========================================================
   LOBBY ACTIONS
   ========================================================= */

function handleReady(socket, payload) {
  const code = getRoomCode(socket);
  if (!code) return;

  const room = rooms.get(code);
  if (!room) return;

  room.lobby.setReady(socket.id, !!payload?.ready);
  broadcastRoomState(code);
}

function handleAddBot(socket) {
  const code = getRoomCode(socket);
  if (!code) return;

  const room = rooms.get(code);
  if (!room) return;

  if (!room.lobby.isLead(socket.id)) return;

  room.lobby.addBot();
  broadcastRoomState(code);
}

function handleRemovePlayer(socket, payload) {
  const code = getRoomCode(socket);
  if (!code) return;
  const room = rooms.get(code);
  if (!room) return;
  if (room.gameState) return;
  if (!room.lobby.isLead(socket.id)) return;

  const targetId = String(payload?.playerId || "").trim();
  if (!targetId) return;

  const requesterId = room.lobby.socketToPlayer.get(socket.id);
  if (targetId === requesterId) {
    socket.emit("room:err", { message: "Lead cannot remove themselves" });
    return;
  }

  const target = room.lobby.players.get(targetId);
  if (!target) {
    socket.emit("room:err", { message: "Player not found" });
    return;
  }

  const removed = room.lobby.removeByPlayerId(targetId);
  if (!removed) return;
  if (removed.sessionKey) clearReconnectReservation(removed.sessionKey);

  if (removed.socketId) {
    const targetSocket = io.sockets.sockets.get(removed.socketId);
    if (targetSocket) {
      targetSocket.leave(code);
      clearRoomCode(targetSocket);
      io.to(targetSocket.id).emit(ROOM_SERVER_EVENTS.ROOM_KICKED, {
        message: "You were removed by the lead",
      });
    }
  }

  if (room.lobby.playerCount === 0) {
    if (room.gameState) stopRoom(code);
    rooms.delete(code);
    return;
  }

  broadcastRoomState(code);
}

/* =========================================================
   GAME START / LOOP
   ========================================================= */

function handleStart(socket) {

  const code = getRoomCode(socket);
  if (!code) return;
  const room = rooms.get(code);

  if (!room) return;

  if (room.gameState) return;
  if (!room.lobby.canStart(socket.id)) return;
  if (!sim) return;
  
  const players = room.lobby.getPlayersForGame();
  room.gameState = sim.createGame(players);
  room.pausedBy = null;

  for (const p of room.lobby.players.values()) {
    if (!p.socketId) continue;

    const snapshot = sim.getSnapshot(room.gameState, p.id);

    io.to(p.socketId).emit(SERVER_EVENTS.GAME_START, {
      snapshot,
      playerId: p.id,
    });
  }

  room.loopId = setInterval(() => tickRoom(code), TICK_MS);
}

function tickRoom(code) {
  const room = rooms.get(code);
  if (!room || !room.gameState) return;
  if (room.pausedBy) return;

  sim.updateGame(room.gameState, TICK_MS / 1000);

  for (const p of room.lobby.players.values()) {
    if (!p.socketId) continue;

    const snapshot = sim.getSnapshot(room.gameState, p.id);

    io.to(p.socketId).emit(SERVER_EVENTS.GAME_STATE, { snapshot });
  }

  if (room.gameState.phase === "ended") {
    stopRoom(code);
  }
}

function stopRoom(code) {
  const room = rooms.get(code);
  if (!room) return;

  const winner = room.gameState?.winner || null;

  if (room.loopId) {
    clearInterval(room.loopId);
    room.loopId = null;
  }

  for (const p of room.lobby.players.values()) {
    if (!p.socketId) continue;

    const snapshot = room.gameState && sim
    ? sim.getSnapshot(room.gameState, p.id)
    : null;

    io.to(p.socketId).emit(SERVER_EVENTS.GAME_END, {
      snapshot,
      roomCode: code,
      winner,
      next: "lobby",
    });
  }

  room.gameState = null;
  room.pausedBy = null;

  // Reset all connected clients in the room back to lobby state.
  broadcastRoomState(code);
}

function getRoomPlayerBySocket(room, socket) {
  const pid = room?.lobby?.socketToPlayer?.get(socket.id);
  if (!pid) return null;
  return room.lobby.players.get(pid) || null;
}

function emitSystemMessage(code, action, player) {
  if (!player) return;
  const payload = {
    action,
    actor: { id: player.id, name: player.name },
    message: `${player.name} ${action}${action === "pause" ? "d" : action === "resume" ? "d" : " the game"}`,
  };
  io.to(code).emit(SERVER_EVENTS.SYSTEM_MESSAGE, payload);
  // Keep compatibility with existing chat renderers until dedicated UI handling is added.
  io.to(code).emit("chat:message", {
    name: "System",
    message: payload.message,
    ts: Date.now(),
    type: "system",
    actor: payload.actor,
    action,
  });
}

function handlePause(socket) {
  const code = getRoomCode(socket);
  if (!code) return;
  const room = rooms.get(code);
  if (!room || !room.gameState) return;

  const player = getRoomPlayerBySocket(room, socket);
  if (!player) return;

  room.pausedBy = player.id;
  emitSystemMessage(code, "pause", player);
}

function handleResume(socket) {
  const code = getRoomCode(socket);
  if (!code) return;
  const room = rooms.get(code);
  if (!room || !room.gameState) return;

  const player = getRoomPlayerBySocket(room, socket);
  if (!player) return;

  room.pausedBy = null;
  emitSystemMessage(code, "resume", player);
}

function handleQuit(socket) {
  const code = getRoomCode(socket);
  if (!code) return;
  const room = rooms.get(code);
  if (!room) return;

  const player = getRoomPlayerBySocket(room, socket);
  if (player) emitSystemMessage(code, "quit", player);
  handleLeaveRoom(socket);
}


/* =========================================================
   CHAT
   ========================================================= */

function handleChat(socket, payload) {
  const code = getRoomCode(socket);
  if (!code) return;

  const room = rooms.get(code);
  if (!room) return;

  const player = room.lobby.players.get(
    room.lobby.socketToPlayer.get(socket.id)
  );

  if (!player) return;

  const message = String(payload?.message || "").trim();
  if (!message) return;

  io.to(code).emit("chat:message", {
    name: player.name,
    message,
    ts: Date.now(),
  });
}

/* ========================================================= */

function broadcastRoomState(code) {
  const room = rooms.get(code);
  if (!room) return;

  for (const p of room.lobby.players.values()) {
    if (!p.socketId) continue;
    io.to(p.socketId).emit("room:state", getRoomStateForSocket(room, p.socketId));
  }
}

function getRoomStateForSocket(room, socketId) {
  const state = room.lobby.getState(socketId);
  const phase = room.gameState
    ? room.gameState.phase === "ended"
      ? "ended"
      : "running"
    : "lobby";
  return { ...state, phase };
}

function normalizeSessionKey(raw) {
  const input = String(raw || "").trim();
  if (input.length >= 8 && input.length <= 128) return input;
  return randomUUID();
}

function clearReconnectReservation(sessionKey) {
  const existing = reconnectReservations.get(sessionKey);
  if (!existing) return;
  if (existing.timeoutId) clearTimeout(existing.timeoutId);
  reconnectReservations.delete(sessionKey);
}

function reserveReconnect(sessionKey, { roomCode, playerId }) {
  clearReconnectReservation(sessionKey);
  const timeoutId = setTimeout(() => {
    const reservation = reconnectReservations.get(sessionKey);
    if (!reservation) return;
    const room = rooms.get(reservation.roomCode);
    if (!room) {
      reconnectReservations.delete(sessionKey);
      return;
    }
    const player = room.lobby.players.get(reservation.playerId);
    if (player && !player.socketId) {
      room.lobby.removeByPlayerId(player.id);
      if (room.lobby.playerCount === 0) {
        if (room.gameState) stopRoom(reservation.roomCode);
        rooms.delete(reservation.roomCode);
      } else {
        broadcastRoomState(reservation.roomCode);
      }
    }
    reconnectReservations.delete(sessionKey);
  }, RECONNECT_GRACE_MS);

  reconnectReservations.set(sessionKey, {
    roomCode,
    playerId,
    expiresAt: Date.now() + RECONNECT_GRACE_MS,
    timeoutId,
  });
}
