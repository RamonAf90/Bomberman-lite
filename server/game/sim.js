import { createGameState } from "./state.js";
import { generateGrid } from "./grid.js"
import { updateBombs, tryPlaceBomb } from "./bombs.js";
import { updateWinCondition } from "./win.js";
import { movePlayer } from "./movements.js";
import { updateTimer } from "./timer.js";

export function createGame(players) {
    const state = createGameState(players);

    state.grid.cells = generateGrid(state.grid.width, state.grid.height);
    return state;
}

export function updateGame(state, dt) {
    if (state.phase !== "running") return;

    for (const player of state.players) {
        if (!player.alive) continue;

        // cooldown handling
        if (player.moveCooldown > 0) {
            player.moveCooldown -= dt;
        }

        //movement
        if (player.moveCooldown <= 0 && player.input.move) {
            movePlayer(state, player, player.input.move);
            player.moveCooldown = 0.15; // 150 ms per step
        }

        // bomb placement
        if (player.input.placeBomb) {
            tryPlaceBomb(state, player);
            player.input.placeBomb = false;
        }
    }

    updateBombs(state, dt);
    updateTimer(state, dt);
    updateWinCondition(state);
}

export function getSnapshot(state, viewerId) {
    return {
        phase: state.phase,
        timeRemaining: Math.max(
            0,
            state.timeLimit - (Date.now() - state.startedAt) / 1000
        ),

        players: state.players.map(p => ({
            id: p.id,
            name: p.name,
            x: p.x,
            y: p.y,
            lives: p.lives,
            score: p.score,
            alive: p.alive
        })),

        bombs: state.bombs.map(b => ({ ...b })),
        explosions: state.explosions.flatMap(e => e.cells),
        grid: state.grid.cells,
        winner: state.winner,
        you: viewerId ?? null
    };
}

export function applyPlayerInput(state, input) {
    if (state.phase !== "running") return;
    
    const playerId = input.playerId;
    
    const player = state.players.find(p => p.id === playerId);
    if (!player) return;
    if (!player.alive) return;

    player.input.move = input.move;
    player.input.placeBomb = input.placeBomb
}





