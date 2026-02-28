
import { CELL, GRID_SIZE, CELL_SIZE } from "../../shared/constants.js";
import { setLives, setScore, setTimer } from "./hud.js";
import { playSound } from "./sound.js";

let gameRoot;
let gridEl;
let leaderboardListEl = null;

// map: "x,y" -> block element
const blockElements = new Map();

// map: playerId -> player element
const playerElements = new Map();
const previousPlayerAlive = new Map();
const previousPlayerPosition = new Map();

// map: "x,y" -> bomb element
const bombElements = new Map();

/* ---------------- Init ---------------- */

export function initDOMRenderer() {
  gameRoot = document.getElementById("game-root");
  if (!gameRoot) throw new Error("game-root not found");

  leaderboardListEl = document.getElementById("game-player-list") || null;

  gameRoot.innerHTML = "";
  blockElements.clear();

  gridEl = document.createElement("div");
  gridEl.id = "game-grid";
  gridEl.style.width = `${GRID_SIZE * CELL_SIZE}px`;
  gridEl.style.height = `${GRID_SIZE * CELL_SIZE}px`;

  gameRoot.appendChild(gridEl);

  createGridCells();
}

/* ---------------- Grid ---------------- */
// creates empty DOM cells for visual grid
function createGridCells() {
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const cell = document.createElement("div");
      cell.className = "grid-cell";
      cell.style.left = `${x * CELL_SIZE}px`;
      cell.style.top = `${y * CELL_SIZE}px`;
      gridEl.appendChild(cell);
    }
  }
}

/* ---------------- Blocks ---------------- */

function renderBlocks(grid) {
  if (blockElements.size > 0) return; // already rendered

  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const type = grid[y][x];
      if (type === CELL.EMPTY) continue;

      const block = document.createElement("div");
      block.classList.add("block");

      if (type === CELL.SOLID) block.classList.add("solid");
      if (type === CELL.DESTRUCTIBLE) block.classList.add("destructible");

      block.style.transform = `translate(${x * CELL_SIZE}px, ${y * CELL_SIZE}px)`;

      gridEl.appendChild(block);
      blockElements.set(`${x},${y}`, block);
    }
  }
}

/**
 * Remove a destructible block from DOM (after explosion)
 */
export function removeBlock(x, y) {
  const key = `${x},${y}`;
  const el = blockElements.get(key);
  if (!el) return;

  el.remove();
  blockElements.delete(key);
}

/* ---------------- Player ---------------- */
function renderPlayers(players) {
  const colors = ["red", "blue", "green", "yellow"];

  // Track used colors
  const usedColors = new Set();

  // Mark used colors from existing alive players
  players.forEach(p => {
    const el = playerElements.get(p.id)
      if (el) {
        const colorClass = colors.find(c => el.classList.contains(c));
        if (colorClass) usedColors.add(colorClass);
      }
  });

  players.forEach(p => {
    // Handle dead players
    if (!p.alive) {
      const el = playerElements.get(p.id);
      if (el) {
        handlePlayerDeathVisual(p, el);
        el.remove();
        playerElements.delete(p.id);
        previousPlayerAlive.delete(p.id);
      }
      return; // skip further updater for death players
    }

    // Handle alive players
    let el = playerElements.get(p.id);

    if (!el) {
      // create player element once
      el = document.createElement("div");
      el.className = "player";
      el.style.position = "absolute";
      el.style.width = `${CELL_SIZE}px`;
      el.style.height = `${CELL_SIZE}px`;

      // Assign first available color
      const color = colors.find(c => !usedColors.has(c)) || "red";
      el.classList.add(color);
      usedColors.add(color);

      gridEl.appendChild(el);
      playerElements.set(p.id, el);

      // fetch SVG once and insert it
      fetch("./assets/player/player.svg")
        .then(res => res.text())
        .then(svg => {
          el.innerHTML = svg;
        })
        .catch(err => {
          console.error("Failed to load player SVG:", err);
        });
    } else {
      // If element already exists, mark it's color as used
      const colorClass = colors.find(c => el.classList.contains(c));
      if (colorClass) usedColors.add(colorClass);
    }

    // movement detection
    const prev = previousPlayerPosition.get(p.id);
    if (prev && (prev.x !== p.x || prev.y !== p.y)) {
      el.classList.add("moving");

      setTimeout(() => {
        el.classList.remove("moving");
      }, 160); // slightly above 150ms server step
    }

    previousPlayerPosition.set(p.id, { x: p.x, y: p.y });

    // update player position
    el.style.transform = `translate(${p.x * CELL_SIZE}px, ${p.y * CELL_SIZE}px)`;

    // Track current alive status
    previousPlayerAlive.set(p.id, p.alive);
  });

  // remove players no longer present in snapshot
  for (const [id, el] of playerElements.entries()) {
    if (!players.some(p => p.id === id)) {
      el.remove();
      playerElements.delete(id);
      previousPlayerAlive.delete(id);
    }
  }
}

function handlePlayerDeathVisual(player, el) {
  playSound("player_die");

  // Optional: death animation
  el.classList.add("dead");
}


/* ---------------- Bombs ---------------- */

function renderBombs(bombs) {
  const currentBombKeys = new Set();

  bombs.forEach(b => {
    const key = `${b.x},${b.y}`;
    currentBombKeys.add(key);

    if (!bombElements.has(key)) {
      // create bomb
      const el = document.createElement("div");
      el.id = "bomb";
      el.textContent = "💣";
      el.style.position = "absolute";
      el.style.width = `${CELL_SIZE}px`;
      el.style.height = `${CELL_SIZE}px`;
      el.style.transform = `translate(${b.x * CELL_SIZE}px, ${b.y * CELL_SIZE}px)`;

      gridEl.appendChild(el);
      bombElements.set(key, el);

      playSound("bomb_place");
    }
  });

  // remove bombs that no longer exist
  for (const [key, el] of bombElements.entries()) {
    if (!currentBombKeys.has(key)) {
      el.remove();
      bombElements.delete(key);
    }
  }
}

/* ---------------- Explosions ---------------- */

const explosionElements = new Map();

export function renderExplosions(cells, durationMs = 300) {
  for (const { x, y } of cells) {
    const key = `${x},${y}`;

    // prevent duplicate rendering during same snapshot window
    if (explosionElements.has(key)) continue;

    const wrapper = document.createElement("div");
    wrapper.style.position = "absolute";
    wrapper.style.transform = `translate(${x * CELL_SIZE}px, ${y * CELL_SIZE}px)`;

    const el = document.createElement("div");
    el.className = "explosion";

    wrapper.appendChild(el);
    gridEl.appendChild(wrapper);
    explosionElements.set(key, wrapper);

    // Auto-cleanup (server will stop sendind these cells next snapshot)
    setTimeout(() => {
      wrapper.remove();
      explosionElements.delete(key);
    }, durationMs);
  }
}

  /** ---------------- HUD ---------------- **/

export function renderHUDFromSnapshot(snapshot) {
  // Player-specific info
  if (snapshot.players) {
    const me = snapshot.players.find(p => p.id === snapshot.you);
    if (me) {
      setLives(me.lives);
      setScore(me.score);
    }
  }

  // Timer
  if (snapshot.timeRemaining !== undefined) {
    setTimer(snapshot.timeRemaining);
  }
}

/** ---------------- Leaderboard ---------------- **/

function renderLeaderboardFromSnapshot(snapshot) {
  if (!leaderboardListEl) return;

  const players = Array.isArray(snapshot?.players) ? snapshot.players : [];
  const youId = snapshot?.you || null;
  const winnerIdOrName = snapshot?.winner || null;

  // Sort: score desc, then lives desc, then name asc (stable enough)
  const sorted = [...players].sort((a, b) => {
    const s = (b.score ?? 0) - (a.score ?? 0);
    if (s !== 0) return s;
    const l = (b.lives ?? 0) - (a.lives ?? 0);
    if (l !== 0) return l;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });

  leaderboardListEl.innerHTML = "";

  sorted.forEach((p, idx) => {
    const li = document.createElement("li");

    // class hooks for CSS later (optional)
    li.classList.add("game-player-row");
    if (p.id === youId) li.classList.add("is-you");
    if (p.alive === false) li.classList.add("is-dead");

    // winner: server winner might be id OR name depending on implementation.
    if (winnerIdOrName && (p.id === winnerIdOrName || p.name === winnerIdOrName)) {
      li.classList.add("is-winner");
    }

    const rank = document.createElement("span");
    rank.className = "rank";
    rank.textContent = `#${idx + 1}`;

    const name = document.createElement("span");
    name.className = "name";
    name.textContent = `${p.name || "Unknown"}${p.id === youId ? " (you)" : ""}`;

    const stats = document.createElement("span");
    stats.className = "stats";
    stats.textContent = `♥ ${p.lives ?? 0} | ★ ${p.score ?? 0}`;

    li.appendChild(rank);
    li.appendChild(name);
    li.appendChild(stats);

    leaderboardListEl.appendChild(li);
  });
}

/**
 * Render the full game snapshot from the server
 * @param {Object} snapshot - from sim.getSnapshot()
 */
export function renderSnapshot(snapshot) {
  if (!gridEl) return;

  if (snapshot.grid) renderBlocks(snapshot.grid);
  if (snapshot.players) renderPlayers(snapshot.players);
  if (snapshot.bombs) renderBombs(snapshot.bombs);

  
  if (snapshot.explosions && snapshot.explosions.length > 0) {
    playSound("bomb_explode");
    renderExplosions(snapshot.explosions);

    // visual block removal
    snapshot.explosions.forEach(({ x, y }) => {
      removeBlock(x, y);
    });
  }

  renderHUDFromSnapshot(snapshot);
  renderLeaderboardFromSnapshot(snapshot);
}

export function resetRenderer() {
  // remove all player elements
  playerElements.forEach(el => el.remove());
  playerElements.clear();
  previousPlayerPosition.clear();


  // remove all bombs
  bombElements.forEach(el => el.remove());
  bombElements.clear();
}

