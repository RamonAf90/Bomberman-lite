export function updateTimer(state, dt) {
    if (state.phase !== "running") return;

    // decrease time remaining
    state.timeLimit -= dt;

    if (state.timeLimit <= 0) {
        state.timeLimit = 0;
        state.phase = "ended";
    }
}