/**
 * Socket event names and payload conventions.
 * Single source of truth for client <-> server contracts.
 */

// --- Client -> Server ---
export const EVENTS = {
  // Lobby
  JOIN: "join",
  START: "start",
  // Game input (Person C / Person B)
  INPUT: "input",
  // Menu (Person C)
  PAUSE: "pause",
  RESUME: "resume",
  QUIT: "quit",
};

// --- Server -> Client ---
export const SERVER_EVENTS = {
  // Lobby
  JOIN_OK: "join:ok",
  JOIN_ERR: "join:err",
  LOBBY_STATE: "lobby:state",
  // Match lifecycle
  GAME_START: "game:start",
  GAME_STATE: "game:state",
  GAME_END: "game:end",
  // Menu/system announcements (pause/resume/quit actor updates)
  SYSTEM_MESSAGE: "system:message",
  // Disconnect / reconnect
  PLAYER_LEFT: "player:left",
  PLAYER_JOINED: "player:joined",
};

// --- Payload shapes ---

/** @typedef {{ name: string, sessionKey?: string }} JoinPayload */
/** @typedef {{ message: string }} JoinErrPayload */
/** @typedef {{ playerId: string, name: string, sessionKey?: string }} JoinOkPayload */

/**
 * @typedef {Object} LobbyPlayer
 * @property {string} id
 * @property {string} name
 * @property {boolean} isLead
 */

/**
 * @typedef {Object} LobbyStatePayload
 * @property {LobbyPlayer[]} players
 * @property {boolean} canStart - true if 2-4 players and current client is lead
 * @property {"lobby"|"running"|"ended"} [phase]
 */

/**
 * @typedef {Object} GameStartPayload
 * @property {Object} snapshot - initial game state from sim
 * @property {string} playerId - this client's player id
 */

/**
 * @typedef {Object} GameEndPayload
 * @property {string} roomCode
 * @property {string|null} winner
 * @property {"lobby"} next
 */

/**
 * @typedef {Object} SystemMessagePayload
 * @property {"pause" | "resume" | "quit"} action
 * @property {{ id: string, name: string }} actor
 * @property {string} message
 */
