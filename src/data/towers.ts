import type { UnitConfig, UnitId } from '../types';
import { COLORS } from '../game/constants';

/**
 * Four deployable Terran-style combat units. Costs are paid when the player
 * requests manufacturing; deployment itself is free.
 */
export const UNITS: UnitConfig[] = [
  {
    id: 'marine',
    name: 'Marine',
    hotkey: '1',
    cost: 60,
    buildTime: 2,
    attackKind: 'projectile',
    accent: COLORS.cyan,
    description: '轻装陆战人员，单发步枪持续点射。成本低，是前期最可靠的单体火力。',
    levels: [
      { damage: 12, cooldown: 0.45, range: 160, projectileSpeed: 900 },
      { damage: 18, cooldown: 0.45, range: 165, projectileSpeed: 960 },
      { damage: 26, cooldown: 0.42, range: 175, projectileSpeed: 1040 },
    ],
    upgradeCosts: [60, 90],
    voice: {
      select: '机枪兵，听候指令。',
      deploy: '机枪兵，部署完毕。',
      upgrade: '机枪兵，装备升级完成。',
      retreat: '机枪兵，撤离阵地。',
    },
  },
  {
    id: 'goliath',
    name: 'Goliath',
    hotkey: '2',
    cost: 120,
    buildTime: 3.5,
    attackKind: 'projectile',
    accent: COLORS.amber,
    description: '双足重型机甲，双管自动炮连续压制，适合对付装甲目标。',
    levels: [
      { damage: 26, cooldown: 0.75, range: 185, projectileSpeed: 780 },
      { damage: 39, cooldown: 0.70, range: 195, projectileSpeed: 840 },
      { damage: 57, cooldown: 0.65, range: 210, projectileSpeed: 900 },
    ],
    upgradeCosts: [100, 150],
    voice: {
      select: '歌利亚，火控就绪。',
      deploy: '歌利亚，阵地就绪。',
      upgrade: '歌利亚，双管火炮升级。',
      retreat: '歌利亚，撤离阵地。',
    },
  },
  {
    id: 'tank',
    name: '攻城坦克',
    hotkey: '3',
    cost: 180,
    buildTime: 5,
    attackKind: 'artillery',
    accent: COLORS.magenta,
    description: '远程攻城装甲单位，超远射程炮击并在落点造成范围伤害。适合处理成列虫群。',
    levels: [
      { damage: 55, cooldown: 2.8, range: 260, projectileSpeed: 400, splashRadius: 70 },
      { damage: 80, cooldown: 2.6, range: 275, projectileSpeed: 440, splashRadius: 80 },
      { damage: 115, cooldown: 2.4, range: 290, projectileSpeed: 480, splashRadius: 90 },
    ],
    upgradeCosts: [120, 180],
    voice: {
      select: '攻城坦克，火力待命。',
      deploy: '攻城坦克，部署完毕。',
      upgrade: '攻城坦克，主炮升级。',
      retreat: '攻城坦克，撤离阵地。',
    },
  },
  {
    id: 'battlecruiser', name: '战列巡航舰', hotkey: '4', cost: 260, buildTime: 7,
    attackKind: 'projectile', accent: COLORS.green,
    description: '大型空中支援舰，舰载激光炮进行远距离精确打击。',
    levels: [
      { damage: 34, cooldown: 0.9, range: 285, projectileSpeed: 440 },
      { damage: 51, cooldown: 0.82, range: 305, projectileSpeed: 490 },
      { damage: 74, cooldown: 0.75, range: 325, projectileSpeed: 540 },
    ],
    upgradeCosts: [160, 220],
    voice: {
      select: '战列巡航舰，舰队待命。', deploy: '战列巡航舰，进入防御轨道。',
      upgrade: '战列巡航舰，舰载激光炮升级。', retreat: '战列巡航舰，撤出战区。',
    },
  },
];

export const UNIT_MAP = Object.fromEntries(
  UNITS.map((unit) => [unit.id, unit]),
) as Record<UnitId, UnitConfig>;

export function getUnitStats(unitId: UnitId, level: 1 | 2 | 3) {
  return UNIT_MAP[unitId].levels[level - 1];
}

// Transitional aliases so older imports keep compiling during the rework.
export const TOWERS = UNITS;
export const TOWER_MAP = UNIT_MAP;
export const getTowerStats = getUnitStats;
