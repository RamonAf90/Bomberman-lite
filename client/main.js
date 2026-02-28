import { showScreen } from "./ui/screens.js";
import { initInput, destroyInput, isKeyPressed } from "./game/input.js";
import {
  startRenderer,
  pauseRenderer,
  resumeRenderer,
  stopRenderer,
} from "./game/renderer.js";
import { initHUD, resetHUD } from "./game/hud.js";
import { initDOMRenderer, renderSnapshot, resetRenderer } from "./game/domRenderer.js";
import { initSounds, unlockSounds, playSound } from "./game/sound.js";
import { initJoinForm } from "./ui/join.js";
import { initLobby } from "./ui/lobby.js";
import { SERVER_EVENTS } from "/shared/protocol.js";

/* ---------------- Game State ---------------- */

let gameRunning = false;
let paused = false;
let gameSocket = null;
let gameStateHandler = null;
let gameEndHandler = null;
let systemMessageHandler = null;
let winOverlayEl = null;
let winOverlayTitleEl = null;
let winOverlayTextEl = null;

/* ---------------- Bootstrap ---------------- */

document.addEventListener("DOMContentLoaded", () => {
  showScreen("join");
  winOverlayEl = document.getElementById("win-overlay");
  winOverlayTitleEl = document.getElementById("win-overlay-title");
  winOverlayTextEl = document.getElementById("win-overlay-text");
  hideWinOverlay();

  // Server-backed join + lobby flow
  initJoinForm({
    onJoined: (socket) => {
      // join.js already does showScreen("lobby");
      initLobby(socket);
    },
  });

  // When server starts game, lobby dispatches this event
  window.addEventListener("game:start", (e) => {
    const { socket, snapshot, playerId } = e.detail;
    startGame(socket, snapshot, playerId);
  });

  // Copy room code button
  const roomCodeEl = document.getElementById("room-code");
  const copyBtn = document.getElementById("copy-room-code");

  if (copyBtn && roomCodeEl) {
    copyBtn.addEventListener("click", async () => {
      const code = roomCodeEl.textContent?.trim();
      if (!code || code === ".....") return;

      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(code);
        } else {
          // Fallback for older browsers
          const tmp = document.createElement("textarea");
          tmp.value = code;
          tmp.style.position = "fixed";
          tmp.style.left = "-9999px";
          document.body.appendChild(tmp);
          tmp.focus();
          tmp.select();
          document.execCommand("copy");
          document.body.removeChild(tmp);
        }

        const original = copyBtn.textContent;
        copyBtn.textContent = "Copied!";
        setTimeout(() => {
          copyBtn.textContent = original || "Copy";
        }, 1500);
      } catch (err) {
        console.error("Failed to copy room code", err);
      }
    });
  }
});

/* ---------------- Game Lifecycle ---------------- */

function startGame(socket, snapshot, playerId) {
  if (gameRunning) return;

  gameRunning = true;
  paused = false;
  gameSocket = socket;
  gameSocket.playerId = playerId;
  hideWinOverlay();

  showScreen("game");

  // reset renderer state

  resetRenderer();
  //initBlocks();
  initInput();
  initSounds();
  initHUD();
  resetHUD();
  //setLives(lives); server handles lives
  initDOMRenderer();

  // Avoid accumulating duplicate listeners across rematches.
  clearGameSocketListeners(socket);
  gameStateHandler = ({ snapshot }) => {
    renderSnapshot(snapshot);
  };
  gameEndHandler = ({ snapshot }) => {
    onGameEnd(snapshot?.winner ?? null);
  };
  socket.on(SERVER_EVENTS.GAME_STATE, gameStateHandler);
  socket.on(SERVER_EVENTS.GAME_END, gameEndHandler);

  systemMessageHandler = (payload) => {
    if (!payload || !payload.action) return;

    if (payload.action === "pause") {
      paused = true;
      pauseRenderer();
      showScreen("pause");

      console.log("Paused by:", payload.actor?.name);
    }

    if (payload.action === "resume") {
      paused = false;
      resumeRenderer();
      initInput();
      showScreen("game");
    }

    if (payload.action === "quit") {
      stopGame();
      showScreen("lobby");
    }
  };
  socket.on(SERVER_EVENTS.SYSTEM_MESSAGE, systemMessageHandler);

  const pauseBtn = document.getElementById("pause-btn");
  if (pauseBtn) {
    pauseBtn.onclick = () => {
      if (!paused && gameSocket) {
        gameSocket.emit("pause");
      }
    };
  }


  //setPlayerPosition(cx, cy);

  // Render initial state immidiately
  renderSnapshot(snapshot);
  startRenderer(gameLoop);
}

function stopGame() {
  if (!gameRunning) return;

  gameRunning = false;
  paused = false;

  stopRenderer();
  destroyInput();
  hideWinOverlay();
  if (gameSocket) clearGameSocketListeners(gameSocket);
  gameSocket = null;
  // clearExplosion(); -> no need anymore, snapshot driven
}

/* -------------- Game End ----------------- */

function onGameEnd(winner) {
  paused = true;
  pauseRenderer();
  destroyInput();
  console.log("Game ended:. Winner:", winner);
  showWinOverlay(winner);
    // 5 seconds stay on game screen
  setTimeout(() => {
    stopGame();
    showScreen("lobby");
  }, 5000);
}

function showWinOverlay(winner) {
  if (!winOverlayEl || !winOverlayTitleEl || !winOverlayTextEl) return;
  const winnerName = String(winner || "").trim();
  winOverlayTitleEl.textContent = "Game Over";
  if (winnerName) {
    winOverlayTextEl.textContent = `${winnerName} wins!`;
  } else {
    winOverlayTextEl.textContent = "Draw!";
  }
  winOverlayEl.classList.remove("hidden");
}

function hideWinOverlay() {
  if (!winOverlayEl) return;
  winOverlayEl.classList.add("hidden");
}

function clearGameSocketListeners(socket) {
  if (!socket) return;
  if (gameStateHandler) socket.off(SERVER_EVENTS.GAME_STATE, gameStateHandler);
  if (gameEndHandler) socket.off(SERVER_EVENTS.GAME_END, gameEndHandler);
  if (systemMessageHandler) socket.off(SERVER_EVENTS.SYSTEM_MESSAGE, systemMessageHandler);
  gameStateHandler = null;
  gameEndHandler = null;
  systemMessageHandler = null;
}

/* ---------------- Game Loop ---------------- */

function gameLoop(dt) {
  if (!gameSocket || paused) return;

  // collect input
  const inputPayload = {
    playerId: gameSocket.playerId,
    move: null,
    placeBomb: false,
  };

  if (isKeyPressed("ArrowUp")) inputPayload.move = "up";
  else if (isKeyPressed("ArrowDown")) inputPayload.move = "down";
  else if (isKeyPressed("ArrowLeft")) inputPayload.move = "left";
  else if (isKeyPressed("ArrowRight")) inputPayload.move = "right";

  if (isKeyPressed("Space")) inputPayload.placeBomb = true;

  // Send input to server
  gameSocket.emit("input", inputPayload);

  // Handle pause
  if (!paused && isKeyPressed("Escape")) {
    gameSocket.emit("pause");
  }

}
