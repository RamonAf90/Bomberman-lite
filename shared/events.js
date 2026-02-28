/**
 * Extended socket events for multi-room + ready + chat.
 * This file is incremental and does NOT replace existing protocol.js
 */

// -------- Client -> Server --------
export const ROOM_EVENTS = {
  ROOM_CREATE: "room:create",
  ROOM_JOIN: "room:join",
  ROOM_RESTORE: "room:restore",
  ROOM_LEAVE: "room:leave",
  ROOM_RENAME: "room:rename",
  ROOM_REMOVE_PLAYER: "room:player:remove",

  READY_SET: "lobby:ready:set",
  ADD_BOT: "lobby:bot:add",

  CHAT_SEND: "chat:send",
};


// -------- Server -> Client --------
export const ROOM_SERVER_EVENTS = {
  ROOM_JOINED: "room:joined",
  ROOM_STATE: "room:state",
  ROOM_ERR: "room:err",
  SESSION_NAME: "session:name",
  ROOM_KICKED: "room:kicked",

  CHAT_MESSAGE: "chat:message",
};
