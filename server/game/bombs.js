import { CELL, BOMB_DELAY, EXPLOSION_DURATION, EXPLOSION_RANGE } from "../../shared/constants.js"
import { destroyBlock, getCell } from "./grid.js";

/* -------------- Bomb placement ------------- */

/**
 * Attempt to place a bomb for a player
 */
export function tryPlaceBomb(state, player) {
    if (!player.alive) return;

    // Bomb limit check
    if (player.activeBombs >= player.maxBombs) return;

    // Only one bomb per cell
    const occupied = state.bombs.some(
        (b) => b.x === player.x && b.y === player.y
    );
    if (occupied) return;

    state.bombs.push({
        x: player.x,
        y: player.y,
        ownerId: player.id,
        timer: 0
    });

    player.activeBombs++;
}

/* --------------- Update loop --------------- */

/**
 * Update bombs & explosions
 */
export function updateBombs(state, dt) {
    updateBombsTimers(state, dt);
    updateExplosions(state, dt);
}

function updateBombsTimers(state, dt) {
    for (let i = state.bombs.length -1; i>= 0; i--) {
        const bomb = state.bombs[i];
        bomb.timer += dt;

        if (bomb.timer >= BOMB_DELAY) {
            triggerExplosion(state, bomb);

            // refund bomb slots
            const owner = state.players.find(p => p.id === bomb.ownerId);
            if (owner) {
                owner.activeBombs = Math.max(0, owner.activeBombs - 1);
            }

            state.bombs.splice(i, 1);
        }
    }
}

function triggerExplosion(state, bomb) {
    const cells = calculateExplosionCells(state, bomb.x, bomb.y);

    state.explosions.push({
        cells,
        timer: 0,
    });
    damagePlayers(state, cells, bomb.ownerId);
}

function updateExplosions(state, dt) {
    for (let i = state.explosions.length - 1; i >= 0; i--){
        const explosion = state.explosions[i];
        explosion.timer += dt;

        if (explosion.timer >= EXPLOSION_DURATION) {
            state.explosions.splice(i, 1);
        }
    }
}

function calculateExplosionCells(state, cx, cy) {
    const cells = [{ x: cx, y: cy }];

    const directions = [
        { dx: 1, dy: 0 },
        { dx: -1, dy: 0},
        { dx: 0, dy: 1 },
        { dx: 0, dy: -1 }
    ];

    for (const { dx, dy } of directions) {
        for (let i = 1; i <= EXPLOSION_RANGE; i++) {
            const x = cx + dx * i;
            const y = cy + dy * i;

            const cell = getCell(state.grid.cells, x, y);

            if (cell === CELL.SOLID) break;

            cells.push( { x, y });

            if (cell === CELL.DESTRUCTIBLE) {
                destroyBlock(state, x, y);
                break;
            }
        }
    }
    return cells;
}

function damagePlayers(state, explosionCells, ownerId) {
    for (const player of state.players) {
        if (!player.alive) continue;

        const hit = explosionCells.some(
            (c) => c.x === player.x && c.y === player.y
        );

        if (hit) {
            player.lives--;

            // Award point to bomb owner (not self)
            if (player.id !== ownerId) {
                const owner = state.players.find(p => p.id === ownerId);
                if (owner) {
                    owner.score++
                }
            }

            if (player.lives <= 0){
                player.alive = false;
            }
        }
    }
}