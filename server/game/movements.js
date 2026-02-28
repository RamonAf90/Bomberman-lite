import { CELL } from "../../shared/constants.js";
import { getCell } from "./grid.js";

/* ---------------- Direction map ---------------- */

const DIRS = {
    up: { dx: 0, dy: -1 },
    down: { dx: 0, dy: 1 },
    left: { dx: -1, dy: 0},
    right: { dx: 1, dy: 0}
};

/* --------------- Movement ---------------- */

/**
 * Attempt to move a player one grid cell
 */
export function movePlayer(state, player, direction) {
    const dir = DIRS[direction];
    if (!dir) return;

    const nx = player.x + dir.dx;
    const ny = player.y + dir.dy;

    // Blocked by grid
    if (getCell(state.grid.cells, nx, ny) !== CELL.EMPTY) return;

    // Blocked by bomb
    const bombThere = state.bombs.some(
        b => b.x === nx && b.y === ny
    );
    if (bombThere) return;

    // Blocked by another player
    const playerThere = state.players.some(
        p => p.alive && p.x === nx && p.y === ny
    );
    if (playerThere) return;

    // Move is valid
    player.x = nx;
    player.y = ny;
}
