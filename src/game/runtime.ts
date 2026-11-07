import type Phaser from 'phaser';
import type { PathSample } from '../domain/path';
import type { TargetCandidate } from '../domain/targeting';
import type { EnemyView } from '../entities/EnemyView';
import type { TowerView } from '../entities/TowerView';
import type {
  EnemyConfig,
  EnemyId,
  TargetMode,
  TowerConfig,
  TowerId,
  TowerLevel,
} from '../types';

export interface EnemyRuntime {
  id: number;
  config: EnemyConfig;
  hp: number;
  maxHp: number;
  distance: number;
  speed: number;
  slowFactor: number;
  slowUntil: number;
  burnDps: number;
  burnUntil: number;
  alive: boolean;
  deathQueued: boolean;
  leaked: boolean;
  enraged: boolean;
  x: number;
  y: number;
  angle: number;
  sample: PathSample;
  candidate: TargetCandidate;
  view: EnemyView;
}

export interface TowerRuntime {
  id: number;
  typeId: TowerId;
  config: TowerConfig;
  level: TowerLevel;
  padIndex: number;
  x: number;
  y: number;
  cooldown: number;
  targetId: number | null;
  totalInvested: number;
  targetMode: TargetMode;
  view: TowerView;
}

export interface ProjectileBase {
  id: number;
  x: number;
  y: number;
  damage: number;
  color: number;
}

export interface BoltProjectile extends ProjectileBase {
  kind: 'bolt';
  targetId: number;
  speed: number;
  view: Phaser.GameObjects.Image;
}

export interface ShellProjectile extends ProjectileBase {
  kind: 'shell';
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  elapsed: number;
  duration: number;
  splashRadius: number;
  view: Phaser.GameObjects.Image;
}

export type ProjectileRuntime = BoltProjectile | ShellProjectile;

export interface PendingImpact {
  at: number;
  x: number;
  y: number;
  damage: number;
  radius: number;
  ignoreArmor: boolean;
  source: 'orbital';
}

export interface SpawnSpec {
  enemyId: EnemyId;
  hpScale: number;
  distance?: number;
}
