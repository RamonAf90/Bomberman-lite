/**
 * Join screen logic: connect to server, register session with name.
 * After successful JOIN, switches to lobby screen.
 */

// leads to server error. import in index.html instead. import { io } from "https://cdn.socket.io/4.7.5/socket.io.esm.min.js";
import { EVENTS, SERVER_EVENTS } from "/shared/protocol.js";
import { showScreen } from "./screens.js";
import { io } from "https://cdn.socket.io/4.7.5/socket.io.esm.min.js";
import { unlockSounds } from "../game/sound.js";


const SESSION_KEY_STORAGE = "mp.sessionKey";
const AUTO_RECONNECT_STORAGE = "mp.autoReconnect";
const AUTO_RECONNECT_NAME_STORAGE = "mp.autoReconnectName";

export function initJoinForm({ onJoined }) {
  const nameInput = document.getElementById("player-name-input");
  const joinButton = document.getElementById("join-button");
  const logoWrapper = document.querySelector(".logo-wrapper");

  if (!nameInput || !joinButton) return;

  const defaultLabel = joinButton.textContent || "start";
  let connecting = false;

  joinButton.addEventListener("click", handleJoin);
  nameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleJoin();
  });

  // Only auto-reconnect on same-tab refresh after in-room unload.
  const shouldAutoReconnect = sessionStorage.getItem(AUTO_RECONNECT_STORAGE) === "1";
  const reconnectName = String(sessionStorage.getItem(AUTO_RECONNECT_NAME_STORAGE) || "").trim();
  if (shouldAutoReconnect && reconnectName) {
    sessionStorage.removeItem(AUTO_RECONNECT_STORAGE);
    connectToServer(reconnectName, { silentRestore: true });
  }

  function handleJoin() {
    if (connecting) return;
    unlockSounds();
    const name = nameInput.value.trim();
    if (!name) {
      showError("Please enter your name");
      return;
    }

    // --- Trigger animation ---
    if (logoWrapper) {
      logoWrapper.classList.add("fast");

      setTimeout(() => {
        logoWrapper.classList.add("fade-out");
      }, 1400);
    }

    // Delay connection until animation finishes
    setTimeout(() => {
      connectToServer(name);
    }, 1990);
  }

  function connectToServer(name, options = {}) {
    if (connecting) return;
    connecting = true;
    setBusy(true);
    showError("");

    if (options.silentRestore) {
      resetLogo();
    }

    const serverUrl = getServerUrl();
    const socket = io(serverUrl, { autoConnect: true });
    const sessionKey = getOrCreateSessionKey();

    socket.on("connect", () => {
      socket.emit(EVENTS.JOIN, { name, sessionKey });
    });

    socket.on(SERVER_EVENTS.JOIN_OK, (payload) => {
      socket.__sessionName = String(payload?.name || "").trim();
      if (payload?.sessionKey) {
        setSessionKey(payload.sessionKey);
      }
      connecting = false;
      resetLogo();
      setBusy(false);
      sessionStorage.removeItem(AUTO_RECONNECT_NAME_STORAGE);
      // Only session registration happened here.
      // Room create/join happens in lobby screen.
      showScreen("lobby");
      onJoined(socket, payload);
    });

    socket.on(SERVER_EVENTS.JOIN_ERR, (payload) => {
      connecting = false;
      resetLogo();
      setBusy(false);
      socket.disconnect();
      //gameSocket = null; // reset global socket on  failure
      showError(payload?.message || "Join failed");
    });

    socket.on("connect_error", () => {
      connecting = false;
      resetLogo();
      setBusy(false);
      socket.disconnect();

      if (!options.silentRestore) {
        showError("Could not connect to server");
      }
    });
  }

  function resetLogo() {
    if (!logoWrapper) return;
    logoWrapper.classList.remove("fast");
    logoWrapper.classList.remove("fade-out");
  }

  function setBusy(busy) {
    joinButton.disabled = busy;
    joinButton.textContent = busy ? "Connecting…" : defaultLabel;
  }
}

function getServerUrl() {
  const { protocol, hostname, port } = window.location;
  return `${protocol}//${hostname}:${port || (protocol === "https:" ? 443 : 80)}`;
}

function showError(message) {
  let el = document.getElementById("join-error");
  if (!el) {
    el = document.createElement("p");
    el.id = "join-error";
    el.className = "error";
    const panel = document.querySelector("#screen-join .panel");
    panel?.appendChild(el);
  }
  el.textContent = message;
}

function getOrCreateSessionKey() {
  const existing = localStorage.getItem(SESSION_KEY_STORAGE);
  if (existing && existing.length >= 8) return existing;
  const created = crypto.randomUUID();
  localStorage.setItem(SESSION_KEY_STORAGE, created);
  return created;
}

function setSessionKey(value) {
  const key = String(value || "").trim();
  if (key.length >= 8) localStorage.setItem(SESSION_KEY_STORAGE, key);
}

