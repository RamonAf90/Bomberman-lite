import { CELL } from "../../shared/constants.js";

/**
 * Generate a bomberman-style grid
 */
export function generateGrid(width, height) {
    const grid = Array.from({ length: height }, () => 
        Array(width).fill(CELL.EMPTY)
    );

    generateSolidBlocks(grid);
    generateDestructiveBlocks(grid);
    ensureSpawnIsPlayable(grid);

    return grid;
}

/* ----------- Generators ----------- */

function generateSolidBlocks(grid) {
    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[y].length; x++) {
            if (x % 2 === 1 && y % 2 === 1) {
                grid[y][x] = CELL.SOLID;
            }
        }
    }
}

function generateDestructiveBlocks(grid) {
    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[y].length; x++) {
            if (grid[y][x] !== CELL.EMPTY) continue;

            if (Math.random() < 0.4) {
                grid[y][x] = CELL.DESTRUCTIBLE;
            }
        }
    } 
}

/**
 * Clears a safe zone around spawn points
 * For now, assumes classic spawns at corners
 */
function ensureSpawnIsPlayable(grid) {
    const width = grid[0].length;
    const height = grid.length;

    const spawnPoints = [
        { x: 1, y: 1 },
        { x: width - 2, y: 1},
        { x: 1, y: height - 2 },
        { x: width - 2, y: height - 2},
    ];

    for (const spawn of spawnPoints) {
        clearSpawnArea(grid, spawn.x, spawn.y);
        ensureAtLeastOneExit(grid, spawn.x, spawn.y);
    }
}

/* -------------- Helpers -------------- */

export function getCell(grid, x, y) {
    if (!isInside(grid, x, y)) return CELL.SOLID;
    return grid[y][x];
}

export function destroyBlock(state, x, y) {
    const grid = state.grid.cells;
    if (!isInside(grid, x, y)) {
        return false;
    }

    if (grid[y][x] === CELL.DESTRUCTIBLE) {
        grid[y][x] = CELL.EMPTY;
        return true;
    }
    return false;
}

function isInside(grid, x, y) {
    return (
        x >= 0 && y >= 0 &&
        y < grid.length && x < grid[y].length
    );
}

function clearSpawnArea(grid, sx, sy) {
    const safeCells = [
        [sx, sy],
        [sx + 1, sy],
        [sx-1, sy],
        [sx, sy+1],
        [sx, sy-1],
    ];

    for (const [x, y] of safeCells) {
        if (!isInside(grid, x, y)) continue;

        grid[y][x] = CELL.EMPTY;

    }
}

function ensureAtLeastOneExit(grid, sx, sy) {
    const exits = [
        [sx + 1, sy],
        [sx - 1, sy],
        [sx, sy + 1],
        [sx, sy - 1],
    ];

    const hasExit = exits.some(([x, y]) => 
        isInside(grid, x, y) && grid[y][x] === CELL.EMPTY
    );

    if (!hasExit) {
        for (const [x, y] of exits) {
            if (!isInside(grid, x, y)) continue;

            if (grid[y][x] === CELL.DESTRUCTIBLE) {
                grid[y][x] = CELL.EMPTY;
                break;
            }
        }
    }
}
