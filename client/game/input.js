 
const keyState = Object.create(null);

// Keys we care about
const VALID_KEYS = [
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "Space",
  "Escape",
];

/**
 * Initialize keyboard input listeners
 */
export function initInput() {
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
}

/**
 * Cleanup listeners (optional, but civilized)
 */
export function destroyInput() {
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("keyup", onKeyUp);
}

/**
 * Check if a key is currently pressed
 * @param {string} code
 */
export function isKeyPressed(code) {
  return keyState[code] === true;
}

/**
 * Get a snapshot of current input state
 * Safe to read inside render loop
 */
export function getInputState() {
  return { ...keyState };
}

/* ------------------ Internal ------------------ */

function onKeyDown(event) {
  if (!VALID_KEYS.includes(event.code)) return;

  // Prevent browser doing dumb things
  event.preventDefault();

  keyState[event.code] = true;
}

function onKeyUp(event) {
  if (!VALID_KEYS.includes(event.code)) return;

  event.preventDefault();
  keyState[event.code] = false;
}
