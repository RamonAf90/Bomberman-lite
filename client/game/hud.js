 
let scoreEl;
let livesEl;
let timerEl;

let timeAccumulator = 0;

/**
 * Initialize HUD elements
 */
export function initHUD() {
  scoreEl = document.getElementById("hud-score");
  livesEl = document.getElementById("hud-lives");
  timerEl = document.getElementById("hud-timer");

  if (!scoreEl || !livesEl || !timerEl) {
    throw new Error("HUD elements not found in DOM");
  }

  setScore(0);
  setLives(3);
  setTimer(0);
}

/* --------- Setters --------- */

export function setScore(value) {
  scoreEl.textContent = value;
}

export function setLives(value) {
  livesEl.textContent = value;
}

export function setTimer(value) {
  timeAccumulator = value;
  timerEl.textContent = Math.floor(value);
}

/**
 * Reset HUD state
 */
export function resetHUD() {
  timeAccumulator = 0;
  setScore(0);
  setLives(3);
  setTimer(0);
}

