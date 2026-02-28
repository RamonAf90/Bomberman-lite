 
let lastTime = 0;
let rafId = null;
let running = false;
let paused = false;

/**
 * Start the render loop
 * @param {(dt: number) => void} update
 */
export function startRenderer(update) {
  if (running) return;

  running = true;
  paused = false;
  lastTime = performance.now();

  function loop(time) {
    if (!running) return;

    rafId = requestAnimationFrame(loop);

    if (paused) {
      lastTime = time;
      return;
    }

    const deltaTime = (time - lastTime) / 1000;
    lastTime = time;

    update(deltaTime);
  }

  rafId = requestAnimationFrame(loop);
}

/**
 * Pause the render loop without killing RAF
 */
export function pauseRenderer() {
  paused = true;
}

/**
 * Resume the render loop safely
 */
export function resumeRenderer() {
  paused = false;
  lastTime = performance.now();
}

/**
 * Stop renderer completely
 */
export function stopRenderer() {
  running = false;
  paused = false;

  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}
