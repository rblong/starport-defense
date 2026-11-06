import type { GridPos, LevelConfig } from '../types';
import { GRID_COLS, GRID_ORIGIN_X, GRID_ORIGIN_Y, GRID_ROWS, TILE_SIZE } from '../game/constants';

const PATH: GridPos[] = [
  { col: -2, row: 3 },
  { col: 3, row: 3 },
  { col: 3, row: 6 },
  { col: 8, row: 6 },
  { col: 8, row: 1 },
  { col: 13, row: 1 },
  { col: 13, row: 4 },
  { col: 17, row: 4 },
];

const PADS: GridPos[] = [
  { col: 1, row: 2 },
  { col: 2, row: 2 },
  { col: 4, row: 3 },
  { col: 1, row: 5 },
  { col: 2, row: 5 },
  { col: 4, row: 5 },
  { col: 6, row: 5 },
  { col: 7, row: 7 },
  { col: 9, row: 5 },
  { col: 9, row: 2 },
  { col: 7, row: 2 },
  { col: 11, row: 2 },
  { col: 12, row: 3 },
  { col: 14, row: 5 },
  { col: 15, row: 3 },
  { col: 16, row: 5 },
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
  core: { col: 17, row: 4 },
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
