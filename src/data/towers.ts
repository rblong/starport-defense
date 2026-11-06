import type { TowerConfig, TowerId } from '../types';
import { COLORS } from '../game/constants';

export const TOWERS: TowerConfig[] = [
  {
    id: 'pulse',
    name: '脉冲炮塔',
    hotkey: '1',
    cost: 60,
    attackKind: 'projectile',
    accent: COLORS.cyan,
    description: '追踪能量弹，稳定单体输出。前期主力，对高速目标可靠。',
    levels: [
      { damage: 12, cooldown: 0.45, range: 160, projectileSpeed: 900 },
      { damage: 18, cooldown: 0.42, range: 165, projectileSpeed: 960 },
      { damage: 26, cooldown: 0.36, range: 175, projectileSpeed: 1040 },
    ],
    upgradeCosts: [55, 85],
  },
  {
    id: 'mortar',
    name: '榴弹迫击炮',
    hotkey: '2',
    cost: 100,
    attackKind: 'splash',
    accent: COLORS.amber,
    description: '抛射榴弹，落点范围伤害。适合清理密集虫群与破甲。',
    levels: [
      { damage: 32, cooldown: 1.8, range: 210, projectileSpeed: 380, splashRadius: 60 },
      { damage: 50, cooldown: 1.7, range: 220, projectileSpeed: 420, splashRadius: 68 },
      { damage: 75, cooldown: 1.55, range: 235, projectileSpeed: 460, splashRadius: 78 },
    ],
    upgradeCosts: [80, 120],
  },
  {
    id: 'cryo',
    name: '霜冻发生器',
    hotkey: '3',
    cost: 80,
    attackKind: 'aura',
    accent: COLORS.green,
    description: '范围脉冲，伤害并减速所有命中目标。与高伤害塔形成配合。',
    levels: [
      { damage: 5, cooldown: 1.0, range: 140, slowFactor: 0.3, slowDuration: 1.6 },
      { damage: 8, cooldown: 0.95, range: 150, slowFactor: 0.35, slowDuration: 1.7 },
      { damage: 12, cooldown: 0.9, range: 165, slowFactor: 0.45, slowDuration: 2.0 },
    ],
    upgradeCosts: [65, 95],
  },
  {
    id: 'arc',
    name: '电弧线圈',
    hotkey: '4',
    cost: 120,
    attackKind: 'chain',
    accent: COLORS.magenta,
    description: '瞬发连锁闪电，最多命中多个目标。单体偏弱，清群强势。',
    levels: [
      { damage: 22, cooldown: 1.3, range: 165, chainCount: 3, chainRadius: 110, chainFalloff: 0.65 },
      { damage: 32, cooldown: 1.25, range: 175, chainCount: 4, chainRadius: 120, chainFalloff: 0.65 },
      { damage: 45, cooldown: 1.15, range: 190, chainCount: 5, chainRadius: 130, chainFalloff: 0.65 },
    ],
    upgradeCosts: [90, 130],
  },
];

export const TOWER_MAP = Object.fromEntries(
  TOWERS.map((tower) => [tower.id, tower]),
) as Record<TowerId, TowerConfig>;

export function getTowerStats(towerId: TowerId, level: 1 | 2 | 3) {
  return TOWER_MAP[towerId].levels[level - 1];
}
