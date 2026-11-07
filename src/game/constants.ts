import type { Speed } from '../types';

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;
/** Playable world is two screens wide; the camera pans horizontally. */
export const WORLD_WIDTH = GAME_WIDTH * 2;

/**
 * Logical-to-render pixel factor. The scenes keep designing in 1280x720, but
 * the WebGL canvas is rendered at 2x and downscaled by the browser. This keeps
 * text and vector lines crisp on 1080p/1440p/high-DPI displays.
 */
export const RENDER_SCALE = 2;

export const HUD_HEIGHT = 64;
export const BUILD_BAR_HEIGHT = 150;
export const BUILD_BAR_Y = GAME_HEIGHT - BUILD_BAR_HEIGHT;
export const BATTLE_TOP = HUD_HEIGHT;
export const BATTLE_BOTTOM = BUILD_BAR_Y;

export const GRID_COLS = 36;
export const GRID_ROWS = 8;
export const TILE_SIZE = 60;
export const GRID_ORIGIN_X = (WORLD_WIDTH - GRID_COLS * TILE_SIZE) / 2;
export const GRID_ORIGIN_Y = BATTLE_TOP + (BATTLE_BOTTOM - BATTLE_TOP - GRID_ROWS * TILE_SIZE) / 2;

export const TOTAL_WAVES = 12;
export const START_CRYSTALS = 220;
/** @deprecated use START_CRYSTALS */
export const START_CREDITS = START_CRYSTALS;
export const START_INTEGRITY = 20;
export const SELL_REFUND_RATE = 0.6;
export const PRODUCTION_QUEUE_LIMIT = 3;
export const READY_UNIT_LIMIT = 3;
export const SKILL_DAMAGE = 200;
export const SKILL_RADIUS = 90;
export const SKILL_COOLDOWN = 30;
export const SKILL_TELEGRAPH = 0.4;
export const STEP_SEC = 1 / 60;
export const MAX_STEPS_PER_FRAME = 12;
export const MAX_FRAME_DELTA = 0.1;
export const AUTO_NEXT_DELAY = 3;
export const SPEED_LEVELS: readonly Speed[] = [1, 2, 3, 4, 5];
export const ONE_SHOT_CHAIN_FALLOFF = 0.65;
export const CHAIN_RADIUS = 110;

export function waveClearBonus(wave: number): number {
  return 20 + 5 * wave;
}

export const COLORS = {
  void: 0x050814,
  void2: 0x080d1d,
  panel: 0x161f24,
  panelLight: 0x263139,
  panelHover: 0x34444a,
  line: 0x44555b,
  lineBright: 0x718581,
  cyan: 0x91c6c1,
  cyanDim: 0x5c8f91,
  cyanDark: 0x0e3f52,
  magenta: 0xb67b65,
  magentaDim: 0x9e2a86,
  amber: 0xd2b36e,
  amberDim: 0x9c7420,
  red: 0xff5a6a,
  redDark: 0x5c1d2a,
  green: 0x66ffb2,
  text: 0xe3e3d0,
  muted: 0x9fafa8,
  dim: 0x687b77,
  white: 0xffffff,
  black: 0x000000,
} as const;

export const CSS_COLORS = {
  void: '#050814',
  panel: '#161f24',
  panelLight: '#263139',
  cyan: '#91c6c1',
  cyanDim: '#5c8f91',
  magenta: '#b67b65',
  amber: '#d2b36e',
  red: '#ff5a6a',
  green: '#66ffb2',
  text: '#e3e3d0',
  muted: '#9fafa8',
  dim: '#687b77',
  white: '#ffffff',
} as const;

export const FONT_FAMILY =
  '"Inter", "Segoe UI", "Microsoft YaHei", "PingFang SC", sans-serif';
export const FONT_MONO = '"Cascadia Mono", "Consolas", "Courier New", monospace';

export const DEPTH = {
  background: 0,
  backgroundFx: 2,
  path: 10,
  pads: 14,
  core: 18,
  towers: 24,
  units: 24,
  enemies: 30,
  projectiles: 40,
  effects: 50,
  ghost: 55,
  hud: 100,
  ui: 120,
  modal: 200,
  toast: 220,
} as const;
