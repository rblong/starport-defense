import type { GridPos, LevelConfig } from '../types';
import { GRID_COLS, GRID_ORIGIN_X, GRID_ORIGIN_Y, GRID_ROWS, TILE_SIZE } from '../game/constants';

const PATH: GridPos[] = [
  { col: -5, row: 3 },
  { col: 8, row: 3 },
  { col: 8, row: 6 },
  { col: 17, row: 6 },
  { col: 17, row: 1 },
  { col: 26, row: 1 },
  { col: 26, row: 4 },
  { col: 35, row: 4 },
];

const PADS: GridPos[] = [
  // Left lane
  { col: 1, row: 2 },
  { col: 2, row: 2 },
  { col: 4, row: 2 },
  { col: 6, row: 2 },
  { col: 1, row: 4 },
  { col: 3, row: 4 },
  { col: 5, row: 4 },
  { col: 7, row: 4 },
  { col: 7, row: 5 },
  // First switchback
  { col: 9, row: 5 },
  { col: 10, row: 4 },
  { col: 10, row: 7 },
  { col: 12, row: 5 },
  { col: 12, row: 7 },
  { col: 14, row: 5 },
  { col: 14, row: 7 },
  { col: 16, row: 5 },
  { col: 16, row: 3 },
  { col: 18, row: 5 },
  { col: 18, row: 2 },
  // Upper lane
  { col: 19, row: 0 },
  { col: 21, row: 0 },
  { col: 23, row: 0 },
  { col: 25, row: 0 },
  { col: 19, row: 2 },
  { col: 21, row: 2 },
  { col: 23, row: 2 },
  { col: 25, row: 2 },
  // Final switchback and right lane
  { col: 27, row: 3 },
  { col: 27, row: 5 },
  { col: 31, row: 5 },
  { col: 33, row: 3 },
];

export const LEVEL_ONE: LevelConfig = {
  id: 'nexus-7',
  name: 'NEXUS-7 星港',
  cols: GRID_COLS,
  rows: GRID_ROWS,
  tileSize: TILE_SIZE,
  origin: { x: GRID_ORIGIN_X, y: GRID_ORIGIN_Y },
  path: PATH,
  pads: PADS,
  core: { col: 35, row: 4 },
};

export function gridToPixel(pos: GridPos, level: LevelConfig = LEVEL_ONE) {
  return {
    x: level.origin.x + pos.col * level.tileSize + level.tileSize / 2,
    y: level.origin.y + pos.row * level.tileSize + level.tileSize / 2,
  };
}

export function pathToPixels(level: LevelConfig = LEVEL_ONE) {
  return level.path.map((pos) => gridToPixel(pos, level));
}

export function isOnPath(pos: GridPos, level: LevelConfig = LEVEL_ONE): boolean {
  return level.path.some((point) => point.col === pos.col && point.row === pos.row);
}

/** Distance from a grid point to the polyline route, in pixels. */
export function distanceToPath(pos: GridPos, level: LevelConfig = LEVEL_ONE): number {
  const point = gridToPixel(pos, level);
  let best = Number.POSITIVE_INFINITY;
  for (let i = 1; i < level.path.length; i++) {
    const from = gridToPixel(level.path[i - 1]!, level);
    const to = gridToPixel(level.path[i]!, level);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const lengthSq = dx * dx + dy * dy;
    const t =
      lengthSq === 0
        ? 0
        : Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSq));
    const closestX = from.x + dx * t;
    const closestY = from.y + dy * t;
    best = Math.min(best, Math.hypot(point.x - closestX, point.y - closestY));
  }
  return best;
}
