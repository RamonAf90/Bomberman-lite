/* --------------------------------------------------
   Sound Manager
   --------------------------------------------------
   - Centralized sound handling
   - Preloads all sounds
   - Simple API: playSound(key)
   -------------------------------------------------- */

const SOUND_PATH = "/assets/sounds/";

const soundFiles = {
  bomb_place: "bomb_place.wav",
  bomb_explode: "bomb_explode.wav",
  player_die: "player_die.wav",
  bonus: "bonus.wav",
};

const sounds = {};
let enabled = true;
let unlocked = false;

/* ---------------- Init ---------------- */

/**
 * Preload all sounds
 * Should be called once on game start
 */
export function initSounds() {
  for (const key in soundFiles) {
    const audio = new Audio(SOUND_PATH + soundFiles[key]);
    audio.preload = "auto";
    audio.volume = 0.7;
    sounds[key] = audio;
  }
}

/**
 * Unlock audio after first user interaction
 * (required by browser autoplay policy)
 */
export function unlockSounds() {
  if (unlocked) return;

  unlocked = true;

  // play & immediately pause to unlock
  Object.values(sounds).forEach((audio) => {
    audio.play().then(() => {
      audio.pause();
      audio.currentTime = 0;
    }).catch(() => {
      /* ignore */
    });
  });
}

/* ---------------- API ---------------- */

/**
 * Play a sound by key
 * @param {string} key
 */
export function playSound(key) {
  if (!enabled || !unlocked) return;

  const audio = sounds[key];
  if (!audio) return;

  audio.currentTime = 0;
  audio.play().catch(() => {
    /* ignore play errors */
  });
}

/**
 * Enable / disable all sounds
 */
export function setSoundEnabled(value) {
  enabled = value;
}
