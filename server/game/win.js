export function updateWinCondition(state) {
    if (state.phase !== "running") return;

    const alive = state.players.filter(p => p.alive);

    // One survivor -> winner
    if (alive.length === 1) {
        state.phase = "ended";
        state.winner = alive[0].name;
        return;
    }

    // No survivors -> draw
    if (alive.length === 0) {
        state.phase = "ended";
        state.winner = null;
    }

    // Time limit reached 
    const elapsed = (Date.now() - state.startedAt) / 1000;
    if (elapsed >= state.timeLimit) {
        state.phase = "ended";

        // Sort alive players by score descending, then lives descending
        const sorted = [...alive].sort((a, b) => {
            const scoreDiff = (b.score ?? 0) - (a.score ?? 0);
            if (scoreDiff !== 0) return scoreDiff;

            const livesDiff = (b.lives ?? 0) - (a.lives ?? 0);
            if (livesDiff !== 0) return livesDiff;

            return 0; //exact tie
        });

        // check if top 2 are tied
        if (sorted.length > 1 &&
            sorted[0].score === sorted[1].score &&
            sorted[0].lives === sorted[1].lives) {
            
            const topScore = sorted[0].score;
            const topLives = sorted[0].lives
            
            const tiedPlayers = sorted.filter(
                (p) => p.score === topScore && p.lives === topLives
            );

            // Store tied players names as string
            state.winner = tiedPlayers.map((p) => p.name).join(" & ");

        } else {
            state.winner = sorted[0].name;
        }
        return;
    }
}