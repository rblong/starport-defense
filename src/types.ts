export type UnitId = 'marine' | 'goliath' | 'tank' | 'battlecruiser';
/** Kept as an alias while scenes migrate from tower terminology. */
export type TowerId = UnitId;
export type EnemyId = 'scout' | 'runner' | 'brute' | 'splitter' | 'shard' | 'elite' | 'boss';
export type TargetMode = 'first' | 'strongest' | 'nearest';
export type RunPhase = 'prepare' | 'wave' | 'victory' | 'defeat';
export type UnitAttackKind = 'projectile' | 'flame' | 'artillery';
export type Speed = 1 | 2 | 3 | 4 | 5;
export type UnitLevel = 1 | 2 | 3;
export type TowerLevel = UnitLevel;

export interface Vec2 {
  x: number;
  y: number;
}

export interface GridPos {
  col: number;
  row: number;
}

export interface UnitLevelStats {
  damage: number;
  cooldown: number;
  range: number;
  projectileSpeed?: number;
  coneAngle?: number;
  burnDps?: number;
  burnDuration?: number;
  splashRadius?: number;
}

export type TowerLevelStats = UnitLevelStats;

export interface UnitVoiceLines {
  select: string;
  deploy: string;
  upgrade: string;
  retreat: string;
}

export interface UnitConfig {
  id: UnitId;
  name: string;
  hotkey: string;
  cost: number;
  buildTime: number;
  attackKind: UnitAttackKind;
  accent: number;
  description: string;
  levels: [UnitLevelStats, UnitLevelStats, UnitLevelStats];
  upgradeCosts: [number, number];
  voice: UnitVoiceLines;
}

export type TowerConfig = UnitConfig;

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
  musicEnabled: boolean;
  reducedMotion: boolean;
  defaultSpeed: Speed;
  volume: number;
  musicVolume: number;
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
  crystals: number;
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
  typeId: UnitId;
  level: UnitLevel;
  targetMode: TargetMode;
  upgradeCost: number | null;
  sellValue: number;
  totalInvested: number;
}

export interface ProductionActive {
  typeId: UnitId;
  remaining: number;
  duration: number;
}

export interface ProductionSnapshot {
  active: ProductionActive | null;
  queue: UnitId[];
  ready: UnitId[];
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
  crystals: number;
  score: number;
  bestScore: number;
  isNewBest: boolean;
}

export interface ModeSnapshot {
  phase: RunPhase;
  paused: boolean;
  speed: Speed;
  deployTypeId: UnitId | null;
  skillAiming: boolean;
  selectedUnitId: number | null;
}
