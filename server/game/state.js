export function createGameState(players) {
    const width = 11;
    const height = 11;

    // Define spawn points in corners
    const spawnPoints = [
        { x: 1, y: 1 },               // top-left
        { x: width - 2, y: 1 },       // top-right
        { x: 1, y: height - 2 },      // bottom-left
        { x: width - 2, y: height - 2 } // bottom-right
    ];

    return {
        phase: "running", // lobby | running | paused | ended
        startedAt: Date.now(),
        timeLimit: 180, // seconds

        grid: {
            width,
            height,
            cells: [] // filled later in createGame
        },

        players: players.map((p, index) => {
            const spawn = spawnPoints[index % spawnPoints.length]; 
            return {
                id: p.id,
                name: p.name,
                x: spawn.x,
                y: spawn.y,
                lives: 3,
                score: 0,
                alive: true,
                input: {move: null, placeBomb: false},
                moveCooldown: 0,
                maxBombs: 5,
                activeBombs: 0,
            };
        }),

        bombs: [],
        explosions: [],
        winner: null
    };
}