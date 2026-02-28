/**
 * Lobby screen logic (Multi-room + Ready + Chat + Bot + Leave)
 * Incremental: keeps compatibility with older single-lobby events.
 */

import { EVENTS, SERVER_EVENTS } from "/shared/protocol.js";
import { ROOM_EVENTS, ROOM_SERVER_EVENTS } from "/shared/events.js";
import { getCurrentScreen, showScreen } from "./screens.js";

const AUTO_RECONNECT_STORAGE = "mp.autoReconnect";
const AUTO_RECONNECT_NAME_STORAGE = "mp.autoReconnectName";

export function initLobby(socket) {
  // --- Phase 1: choice ---
  const createSection = document.getElementById("create-section");
  const joinSection = document.getElementById("join-section");
  const usernameSection = document.getElementById("username-section");
  const createBtn = document.getElementById("create-room-btn");
  const joinBtn = document.getElementById("join-room-btn");
  const roomCodeInput = document.getElementById("room-code-input");
  const changeNameChoiceBtn = document.getElementById("change-name-choice-btn");
  const currentUsernameEl = document.getElementById("current-username");

  // --- Phase 2: room ---
  const roomSection = document.getElementById("room-section");
  const roomCodeEl = document.getElementById("room-code");
  const playersSection = document.getElementById("players-section");
  const playerList =
    document.getElementById("player-list") ||
    document.getElementById("lobby-player-list");

  // --- Footer controls (new HTML) ---
  const footer = document.getElementById("lobby-footer");
  const readyBtn = document.getElementById("ready-btn");
  const startBtn = document.getElementById("start-btn");
  const addBotBtn = document.getElementById("add-bot-btn");
  const leaveBtn = document.getElementById("leave-btn");

  // --- Legacy button (older HTML) ---
  const legacyReadyButton = document.getElementById("ready-button");

  // --- Chat (lobby + in-game) ---
  const chatSection = document.getElementById("chat-section");
  const chatMessages = document.getElementById("chat-messages");
  const chatInput = document.getElementById("chat-input");
  const chatSendBtn = document.getElementById("chat-send-btn");

  const gameChatMessages = document.getElementById("game-chat-messages");
  const gameChatInput = document.getElementById("game-chat-input");
  const gameChatSendBtn = document.getElementById("game-chat-send-btn");
  const resumeBtn = document.getElementById("resume-button");
  const quitBtn = document.getElementById("quit-button");

  const lobbyError = document.getElementById("lobby-error");

  const lobbyLayout = document.querySelector(".lobby-layout");


  if (!playerList) return;

  // --- local UI state ---
  let inRoom = false;
  let myReady = false;
  let currentUsername = String(socket?.__sessionName || "").trim();

  updateCurrentUsernameUI();

  // Initial state: only create/join visible
  enterChoiceMode();

  window.addEventListener("beforeunload", () => {
    if (inRoom) {
      sessionStorage.setItem(AUTO_RECONNECT_STORAGE, "1");
      if (currentUsername) {
        sessionStorage.setItem(AUTO_RECONNECT_NAME_STORAGE, currentUsername);
      }
    } else {
      sessionStorage.removeItem(AUTO_RECONNECT_STORAGE);
      sessionStorage.removeItem(AUTO_RECONNECT_NAME_STORAGE);
    }
  });

  // ----------------------------
  // UI: Phase transitions
  // ----------------------------

  function enterChoiceMode() {
    inRoom = false;
    myReady = false;

    createSection?.classList.remove("hidden");
    joinSection?.classList.remove("hidden");
    usernameSection?.classList.remove("hidden");

    roomSection?.classList.add("hidden");
    playersSection?.classList.add("hidden");
    chatSection?.classList.add("hidden");
    footer?.classList.add("hidden");
    lobbyLayout?.classList.add("hidden");


    // legacy
    if (legacyReadyButton) legacyReadyButton.classList.add("hidden");

    if (roomCodeEl) roomCodeEl.textContent = ".....";
    renderPlayerList(playerList, []);
    setError("");
  }

  function enterRoomMode(state) {
    inRoom = true;

    createSection?.classList.add("hidden");
    joinSection?.classList.add("hidden");
    usernameSection?.classList.add("hidden");

    roomSection?.classList.remove("hidden");
    playersSection?.classList.remove("hidden");
    chatSection?.classList.remove("hidden");
    footer?.classList.remove("hidden");
    lobbyLayout?.classList.remove("hidden");

    // show room code
    if (roomCodeEl && state?.roomCode) roomCodeEl.textContent = state.roomCode;

    // render players
    const roomPhase = String(state?.phase || "lobby");
    const isLobbyPhase = roomPhase === "lobby";
    renderPlayerList(
      playerList,
      state?.players || [],
      state?.selfPlayerId || null,
      !!state?.isLead && isLobbyPhase,
      (playerId) => socket.emit(ROOM_EVENTS.ROOM_REMOVE_PLAYER, { playerId })
    );

    // buttons
    const isLead = !!state?.isLead;
    const canStart = !!state?.canStart;

    if (readyBtn) {
      readyBtn.classList.toggle("hidden", !isLobbyPhase);
      readyBtn.disabled = false;
      readyBtn.textContent = myReady ? "Unready" : "Ready";
    }

    if (startBtn) {
      // Only the lead should see Start Game to avoid confusion.
      startBtn.classList.toggle("hidden", !isLobbyPhase || !isLead);
      startBtn.disabled = !(isLobbyPhase && isLead && canStart);
    }

    if (addBotBtn) {
      // Add Bot hidden for now; reinstate by using: !isLobbyPhase || !isLead
      addBotBtn.classList.toggle("hidden", true);
      addBotBtn.disabled = !(isLobbyPhase && isLead);
    }

    // legacy ready-button compatibility: map it to start (old UI)
    if (legacyReadyButton) {
      legacyReadyButton.textContent = "Start Game";
      legacyReadyButton.classList.toggle("hidden", !(isLead && canStart));
      legacyReadyButton.disabled = !(isLead && canStart);
    }

    setError("");
  }

  // ----------------------------
  // Click handlers (phase 1)
  // ----------------------------

  createBtn?.addEventListener("click", () => {
    if (inRoom) return;
    setError("");
    socket.emit(ROOM_EVENTS.ROOM_CREATE);
  });

  joinBtn?.addEventListener("click", () => {
    if (inRoom) return;

    const code = String(roomCodeInput?.value || "")
      .trim()
      .toUpperCase();

    if (!code) {
      setError("Enter a room code");
      return;
    }

    setError("");
    socket.emit(ROOM_EVENTS.ROOM_JOIN, { roomCode: code });
  });

  changeNameChoiceBtn?.addEventListener("click", () => {
    if (inRoom) return;
    const next = window.prompt("Enter new username:", currentUsername || "");
    if (next === null) return;
    setError("");
    socket.emit(ROOM_EVENTS.ROOM_RENAME, { name: next });
  });

  // ----------------------------
  // Lobby controls (phase 2)
  // ----------------------------

  readyBtn?.addEventListener("click", () => {
    if (!inRoom) return;
    myReady = !myReady;
    readyBtn.textContent = myReady ? "Unready" : "Ready";
    socket.emit(ROOM_EVENTS.READY_SET, { ready: myReady });
  });

  startBtn?.addEventListener("click", () => {
    if (!inRoom) return;

    socket.emit(EVENTS.START);
  });

  addBotBtn?.addEventListener("click", () => {
    if (!inRoom) return;
    socket.emit(ROOM_EVENTS.ADD_BOT);
  });

  leaveBtn?.addEventListener("click", () => {
    if (!inRoom) {
      // Already in lobby choice mode.
      showScreen("lobby");
      return;
    }

    socket.emit(ROOM_EVENTS.ROOM_LEAVE);
    // Keep active session/name and return to lobby choice view.
    enterChoiceMode();
    showScreen("lobby");
  });

  // Pause menu transport hooks (UI actions + room sync events).
  resumeBtn?.addEventListener("click", () => {
    socket.emit(EVENTS.RESUME);
    showScreen("game");
  });
  quitBtn?.addEventListener("click", () => {
    socket.emit(EVENTS.QUIT);
    enterChoiceMode();
    showScreen("lobby");
  });
  window.addEventListener("keydown", (e) => {
    if (e.code === "Escape" && !e.repeat && getCurrentScreen() === "game") {
      socket.emit(EVENTS.PAUSE);
    }
  });

  // Legacy button click (older HTML)
  legacyReadyButton?.addEventListener("click", () => {
    socket.emit(EVENTS.START);
  });

  // ----------------------------
  // Chat sending
  // ----------------------------

  function sendChatFrom(inputEl) {
    if (!inRoom) return;
    const msg = String(inputEl?.value || "").trim();
    if (!msg) return;
    inputEl.value = "";
    socket.emit(ROOM_EVENTS.CHAT_SEND, { message: msg });
  }

  chatSendBtn?.addEventListener("click", () => sendChatFrom(chatInput));
  chatInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendChatFrom(chatInput);
  });

  gameChatSendBtn?.addEventListener("click", () => sendChatFrom(gameChatInput));
  gameChatInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendChatFrom(gameChatInput);
  });

  // ----------------------------
  // Socket listeners (new multi-room)
  // ----------------------------

  socket.on(ROOM_SERVER_EVENTS.ROOM_JOINED, (state) => {
    myReady = false;
    enterRoomMode(state);
  });

  socket.on(ROOM_SERVER_EVENTS.ROOM_STATE, (state) => {
    enterRoomMode(state);
  });

  socket.on(ROOM_SERVER_EVENTS.ROOM_ERR, (payload) => {
    setError(payload?.message || "Room error");
  });

  socket.on(ROOM_SERVER_EVENTS.ROOM_KICKED, (payload) => {
    enterChoiceMode();
    setError(payload?.message || "You were removed from the room");
    showScreen("lobby");
  });

  socket.on(ROOM_SERVER_EVENTS.SESSION_NAME, (payload) => {
    currentUsername = String(payload?.name || "").trim();
    updateCurrentUsernameUI();
  });

  socket.on(ROOM_SERVER_EVENTS.CHAT_MESSAGE, (payload) => {
    appendChat(payload);
  });

  // Attempt room restore after reconnecting with same session key.
  socket.emit(ROOM_EVENTS.ROOM_RESTORE);

  // ----------------------------
  // Socket listeners (legacy single-lobby compatibility)
  // ----------------------------

  socket.on(SERVER_EVENTS.LOBBY_STATE, (state) => {
    // Older server path: no room code, no ready, only start lead gating
    // We still show something usable.
    createSection?.classList.add("hidden");
    joinSection?.classList.add("hidden");
    usernameSection?.classList.add("hidden");

    roomSection?.classList.add("hidden"); // no room in old mode
    playersSection?.classList.remove("hidden");
    footer?.classList.add("hidden"); // old mode didn't have ready/chat

    renderPlayerList(playerList, state.players);

    if (legacyReadyButton) {
      legacyReadyButton.textContent = "Start Game";
      legacyReadyButton.classList.toggle("hidden", !state.canStart);
      legacyReadyButton.disabled = !state.canStart;
    }
  });

  // Game start (shared)
  socket.on(SERVER_EVENTS.GAME_START, (payload) => {
    console.log("My player ID:", payload.playerId);
    showScreen("game");
    window.dispatchEvent(
      new CustomEvent("game:start", {
        detail: { socket, snapshot: payload.snapshot, playerId: payload.playerId },
      })
    );
  });

  // NOTE: GAME_END screen timing is controlled in client/main.js.
  // Lobby still updates from ROOM_STATE after match stop.

  socket.on(SERVER_EVENTS.JOIN_ERR, (payload) => {
    setError(payload?.message || "Error");
  });

  socket.on("disconnect", () => {
    enterChoiceMode();
    showScreen("join");
  });

  // ----------------------------
  // Helpers
  // ----------------------------

  function setError(msg) {
    if (!lobbyError) return;
    lobbyError.textContent = msg || "";
  }

  function updateCurrentUsernameUI() {
    if (!currentUsernameEl) return;
    currentUsernameEl.textContent = currentUsername || "Unknown";
  }

  function appendChat(payload) {
    const name = String(payload?.name || "Unknown");
    const message = String(payload?.message || "");
    if (!message) return;

    // lobby messages
    if (chatMessages) {
      chatMessages.appendChild(makeChatLine(name, message));
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // in-game messages
    if (gameChatMessages) {
      gameChatMessages.appendChild(makeChatLine(name, message));
      gameChatMessages.scrollTop = gameChatMessages.scrollHeight;
    }
  }

  function makeChatLine(name, message) {
    const line = document.createElement("div");
    line.className = "chat-message";

    const author = document.createElement("span");
    author.className = "author";
    author.textContent = `${name}:`;

    const text = document.createElement("span");
    text.textContent = ` ${message}`;

    line.appendChild(author);
    line.appendChild(text);
    return line;
  }
}

function renderPlayerList(
  container,
  players,
  selfPlayerId = null,
  canRemove = false,
  onRemove = null
) {
  container.innerHTML = "";
  for (const p of players || []) {
    const li = document.createElement("li");

    const lead = !!p.isLead;
    const ready = p.isReady === true; // may be undefined in legacy mode
    const isSelf = !!selfPlayerId && p.id === selfPlayerId;
    let label = p.name;
    if (isSelf) label += " (you)";
    if (lead) label += " (lead)";
    if (p.isBot) label += " (bot)";
    if (p.isDisconnected) label += " (reconnecting)";
    if (p.isReady !== undefined) label += ready ? " ✅" : " ⏳";

    const text = document.createElement("span");
    text.textContent = label;
    li.appendChild(text);

    if (canRemove && !isSelf) {
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "remove-player-btn";
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", () => onRemove?.(p.id));
      li.appendChild(removeBtn);
    }

    if (lead) li.classList.add("lead");
    container.appendChild(li);
  }
}
