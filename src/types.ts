export type TowerId = 'pulse' | 'mortar' | 'cryo' | 'arc';
export type EnemyId = 'scout' | 'runner' | 'brute' | 'splitter' | 'shard' | 'elite' | 'boss';
export type TargetMode = 'first' | 'strongest' | 'nearest';
export type RunPhase = 'prepare' | 'wave' | 'victory' | 'defeat';
export type TowerAttackKind = 'projectile' | 'splash' | 'aura' | 'chain';
export type Speed = 1 | 2 | 3 | 4 | 5;
export type TowerLevel = 1 | 2 | 3;

export interface Vec2 {
  x: number;
  y: number;
}

export interface GridPos {
  col: number;
  row: number;
}

export interface TowerLevelStats {
  damage: number;
  cooldown: number;
  range: number;
  projectileSpeed?: number;
  splashRadius?: number;
  chainCount?: number;
  chainRadius?: number;
  chainFalloff?: number;
  slowFactor?: number;
  slowDuration?: number;
}

export interface TowerConfig {
  id: TowerId;
  name: string;
  hotkey: string;
  cost: number;
  attackKind: TowerAttackKind;
  accent: number;
  description: string;
  levels: [TowerLevelStats, TowerLevelStats, TowerLevelStats];
  upgradeCosts: [number, number];
}

export interface EnemyConfig {
  id: EnemyId;
  name: string;
  maxHp: number;
  speed: number;
  armor: number;
  reward: number;
  leakDamage: number;
  slowResist: number;
  size: number;
  color: number;
  showHealthBar: boolean;
  isElite?: boolean;
  isBoss?: boolean;
  splitInto?: {
    enemyId: EnemyId;
    count: number;
  };
}

export interface WaveGroup {
  enemyId: EnemyId;
  count: number;
  interval: number;
  delay: number;
}

export interface WaveConfig {
  index: number;
  hpScale: number;
  groups: WaveGroup[];
}

export interface LevelConfig {
  id: string;
  name: string;
  cols: number;
  rows: number;
  tileSize: number;
  origin: Vec2;
  path: GridPos[];
  pads: GridPos[];
  core: GridPos;
}

export interface SettingsData {
  version: 1;
  soundEnabled: boolean;
  reducedMotion: boolean;
  defaultSpeed: Speed;
  volume: number;
  autoNextWave: boolean;
}

export interface ProgressData {
  version: 1;
  bestScore: number;
  cleared: boolean;
  bestWave: number;
  totalKills: number;
}

export interface HudSnapshot {
  integrity: number;
  maxIntegrity: number;
  credits: number;
  wave: number;
  totalWaves: number;
  endless: boolean;
  kills: number;
  enemiesRemaining: number;
  speed: Speed;
  paused: boolean;
  phase: RunPhase;
}

export interface TowerSelection {
  towerId: number;
  typeId: TowerId;
  level: TowerLevel;
  targetMode: TargetMode;
  upgradeCost: number | null;
  sellValue: number;
  totalInvested: number;
}

export interface SkillStatus {
  ratio: number;
  ready: boolean;
  aiming: boolean;
}

export interface WaveBannerPayload {
  title: string;
  subtitle: string;
  tone: 'wave' | 'boss' | 'victory' | 'defeat';
}

export interface ToastPayload {
  message: string;
  tone: 'info' | 'error' | 'success';
}

export interface ResultPayload {
  victory: boolean;
  endless: boolean;
  waveReached: number;
  wavesCleared: number;
  kills: number;
  integrity: number;
  credits: number;
  score: number;
  bestScore: number;
  isNewBest: boolean;
}

export interface ModeSnapshot {
  phase: RunPhase;
  paused: boolean;
  speed: Speed;
  buildTowerId: TowerId | null;
  skillAiming: boolean;
  selectedTowerId: number | null;
}
