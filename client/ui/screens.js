 
const SCREENS = ["join", "lobby", "game", "pause"];

let currentScreen = null;

injectLobbyStyles();

function injectLobbyStyles() {
  if (document.getElementById("lobby-styles")) return;
  const style = document.createElement("style");
  style.id = "lobby-styles";
  style.textContent = `
    #screen-lobby h1 {
      color: #b39a74;
      text-shadow: 0 0 8px rgba(150, 116, 74, 0.8), 0 0 16px rgba(136, 93, 42, 0.8);
    }
    #screen-lobby .lobby-content {
      min-width: 400px;
      max-width: 420px;
      padding: 24px;
      border-radius: 12px;
      background: linear-gradient(180deg, #1f1f1f, #151515);
      border: 1px solid #333;
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), 0 6px 20px rgba(0,0,0,0.6);
    }
    #screen-lobby #player-list,
    #screen-lobby #lobby-player-list {
      list-style: none;
      margin: 0 0 20px 0;
      padding: 0;
    }
    #screen-lobby #player-list li,
    #screen-lobby #lobby-player-list li {
      padding: 12px 16px;
      margin-bottom: 8px;
      border-radius: 8px;
      background: rgba(255,255,255,0.05);
      border: 1px solid #333;
      font-size: 16px;
    }
    #screen-lobby #player-list li.lead,
    #screen-lobby #lobby-player-list li.lead {
      border-color: #ff9800;
      box-shadow: 0 0 8px rgba(255, 152, 0, 0.2);
    }
    #screen-lobby #ready-button {
      width: 100%;
      padding: 14px 18px;
      font-size: 18px;
      border-radius: 10px;
      font-family: "Bangers", cursive;
      letter-spacing: 1.5px;
      background: linear-gradient(180deg, #ff9800, #e68900);
      color: #111;
      border: none;
      box-shadow: 0 8px 24px rgba(255, 152, 0, 0.35), inset 0 1px 0 rgba(255,255,255,0.35);
      transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
    }
    #screen-lobby #ready-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 32px rgba(255, 152, 0, 0.45), inset 0 1px 0 rgba(255,255,255,0.4);
      filter: brightness(1.05);
    }
  `;
  document.head.appendChild(style);
}

function ensureLobbyWrapper() {
  const playerList = document.getElementById("player-list");
  const readyButton = document.getElementById("ready-button");
  if (!playerList || !readyButton || playerList.closest(".lobby-content")) return;
  const wrapper = document.createElement("div");
  wrapper.className = "lobby-content";
  const parent = playerList.parentElement;
  parent.insertBefore(wrapper, playerList);
  wrapper.appendChild(playerList);
  if (readyButton.parentElement === parent) wrapper.appendChild(readyButton);
}

/**
 * Show a screen by name
 * @param {"join" | "lobby" | "game" | "pause"} name
 */
export function showScreen(name) {
  if (!SCREENS.includes(name)) {
    throw new Error(`Unknown screen: ${name}`);
  }

  if (name === "lobby") ensureLobbyWrapper();

  SCREENS.forEach((screen) => {
    const el = document.getElementById(`screen-${screen}`);
    if (!el) return;

    if (screen === name) {
      el.classList.remove("hidden");
      el.classList.add("active");
    } else {
      el.classList.add("hidden");
      el.classList.remove("active");
    }
  });

  currentScreen = name;
}

/**
 * Get current active screen
 */
export function getCurrentScreen() {
  return currentScreen;
}
