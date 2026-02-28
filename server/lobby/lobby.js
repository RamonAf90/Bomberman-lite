/* =========================================================
   EXTENSION: Multi-Room Lobby Support (Incremental)
   This does NOT replace LobbyManager.
   ========================================================= */

import { randomUUID } from "crypto";

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 4;

function makeRoomCode(len = 5) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function generateUniqueRoomCode(existingCodes) {
  let code = makeRoomCode();
  while (existingCodes.has(code)) {
    code = makeRoomCode();
  }
  return code;
}

/**
 * Multi-room lobby with ready state + bots.
 * Does NOT interfere with existing LobbyManager.
 */
export class RoomLobby {
  constructor(roomCode) {
    this.roomCode = roomCode;
  
    /** Map<playerId, player> */
    this.players = new Map();

    /** Map<socketId, playerId> */
    this.socketToPlayer = new Map();

    this.leadPlayerId = null;
    this.botCounter = 0;
  }

  addHuman(socketId, name, sessionKey = null) {
    const trimmed = String(name || "").trim();
    if (!trimmed) return { ok: false, message: "Name is required" };
    if (trimmed.length > 20)
      return { ok: false, message: "Name must be 20 characters or less" };

    if (this.players.size >= MAX_PLAYERS) {
      return { ok: false, message: "Room is full (max 4 players)" };
    }

    const nameLower = trimmed.toLowerCase();
    for (const p of this.players.values()) {
      if (p.name.toLowerCase() === nameLower) {
        return { ok: false, message: "Name already taken in this room" };
      }
    }

    const isFirst = this.players.size === 0;

    const player = {
      id: randomUUID(),
      name: trimmed,
      socketId,
      sessionKey,
      isLead: isFirst,
      isReady: false,
      isBot: false,
    };

    this.players.set(player.id, player);
    this.socketToPlayer.set(socketId, player.id);

    if (isFirst) this.leadPlayerId = player.id;

    return { ok: true, player };
  }

  addBot() {
    if (this.players.size >= MAX_PLAYERS) {
      return { ok: false, message: "Room is full (max 4 players)" };
    }

    this.botCounter++;

    const player = {
      id: randomUUID(),
      name: `Bot ${this.botCounter}`,
      socketId: null,
      isLead: false,
      isReady: true,
      isBot: true,
    };

    this.players.set(player.id, player);
    return { ok: true, player };
  }

  removeBySocket(socketId) {
    const pid = this.socketToPlayer.get(socketId);
    if (!pid) return null;
    return this.removeByPlayerId(pid);
  }

  removeByPlayerId(playerId) {
    const pid = String(playerId || "");
    if (!pid) return null;

    const player = this.players.get(pid);
    if (!player) return null;

    this.players.delete(pid);
    if (player.socketId) this.socketToPlayer.delete(player.socketId);

    if (this.leadPlayerId === pid) {
      const first = this.players.values().next().value;
      this.leadPlayerId = first ? first.id : null;
      if (first) first.isLead = true;
    }

    return player;
  }

  markDisconnectedBySocket(socketId) {
    const pid = this.socketToPlayer.get(socketId);
    if (!pid) return null;

    const player = this.players.get(pid);
    if (!player || player.isBot) return null;

    this.socketToPlayer.delete(socketId);
    player.socketId = null;
    // Disconnected humans must re-ready on return.
    player.isReady = false;
    return player;
  }

  reconnectPlayer(playerId, socketId, name) {
    const player = this.players.get(playerId);
    if (!player || player.isBot) return { ok: false, message: "Player not found" };
    if (player.socketId) return { ok: false, message: "Player already connected" };

    player.socketId = socketId;
    if (name) player.name = String(name).trim() || player.name;
    this.socketToPlayer.set(socketId, player.id);
    return { ok: true, player };
  }

  setReady(socketId, ready) {
    const pid = this.socketToPlayer.get(socketId);
    if (!pid) return { ok: false, message: "Not in room" };

    const player = this.players.get(pid);
    if (!player) return { ok: false, message: "Player not found" };

    player.isReady = !!ready;
    return { ok: true };
  }

  renameBySocket(socketId, name) {
    const pid = this.socketToPlayer.get(socketId);
    if (!pid) return { ok: false, message: "Not in room" };

    const player = this.players.get(pid);
    if (!player) return { ok: false, message: "Player not found" };

    const trimmed = String(name || "").trim();
    if (!trimmed) return { ok: false, message: "Name is required" };
    if (trimmed.length > 20)
      return { ok: false, message: "Name must be 20 characters or less" };

    const nameLower = trimmed.toLowerCase();
    for (const p of this.players.values()) {
      if (p.id !== player.id && p.name.toLowerCase() === nameLower) {
        return { ok: false, message: "Name already taken in this room" };
      }
    }

    player.name = trimmed;
    return { ok: true, player };
  }

  isLead(socketId) {
    const pid = this.socketToPlayer.get(socketId);
    return pid && pid === this.leadPlayerId;
  }

  allReady() {
    if (this.players.size < MIN_PLAYERS) return false;
    for (const p of this.players.values()) {
      if (!p.isReady) return false;
    }
    return true;
  }

  canStart(socketId) {
    return this.isLead(socketId) && this.allReady();
  }

  getState(forSocketId) {
    const selfPlayerId = forSocketId
      ? this.socketToPlayer.get(forSocketId) || null
      : null;
    return {
      roomCode: this.roomCode,
      players: Array.from(this.players.values()).map((p) => ({
        id: p.id,
        name: p.name,
        isLead: p.isLead,
        isReady: p.isReady,
        isBot: p.isBot,
        isDisconnected: !p.isBot && !p.socketId,
      })),
      canStart: forSocketId ? this.canStart(forSocketId) : false,
      isLead: forSocketId ? this.isLead(forSocketId) : false,
      selfPlayerId,
    };
  }

  getPlayersForGame() {
    return Array.from(this.players.values()).map((p) => ({
      id: p.id,
      name: p.name,
    }));
  }

  get playerCount() {
    return this.players.size;
  }
}
