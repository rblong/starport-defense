import Phaser from 'phaser';
import { COLORS } from '../game/constants';
import type { EnemyId, TowerId } from '../types';

type Draw = (graphics: Phaser.GameObjects.Graphics) => void;

function makeTexture(scene: Phaser.Scene, key: string, width: number, height: number, draw: Draw): void {
  if (scene.textures.exists(key)) return;
  const graphics = scene.add.graphics();
  graphics.setPosition(0, 0);
  draw(graphics);
  graphics.generateTexture(key, width, height);
  graphics.destroy();
}

function polygonPoints(cx: number, cy: number, radius: number, sides: number, rotation = -Math.PI / 2) {
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < sides; i++) {
    const angle = rotation + (Math.PI * 2 * i) / sides;
    points.push({ x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius });
  }
  return points;
}

function fillPolygon(graphics: Phaser.GameObjects.Graphics, points: Array<{ x: number; y: number }>, color: number, alpha = 1) {
  graphics.fillStyle(color, alpha);
  graphics.beginPath();
  graphics.moveTo(points[0]!.x, points[0]!.y);
  for (let i = 1; i < points.length; i++) {
    graphics.lineTo(points[i]!.x, points[i]!.y);
  }
  graphics.closePath();
  graphics.fillPath();
}

function strokePolygon(
  graphics: Phaser.GameObjects.Graphics,
  points: Array<{ x: number; y: number }>,
  color: number,
  lineWidth: number,
  alpha = 1,
) {
  graphics.lineStyle(lineWidth, color, alpha);
  graphics.beginPath();
  graphics.moveTo(points[0]!.x, points[0]!.y);
  for (let i = 1; i < points.length; i++) {
    graphics.lineTo(points[i]!.x, points[i]!.y);
  }
  graphics.closePath();
  graphics.strokePath();
}

function makeSoftDot(scene: Phaser.Scene, key: string, size: number, color: number): void {
  makeTexture(scene, key, size, size, (g) => {
    const c = size / 2;
    for (let i = 12; i >= 1; i--) {
      const t = i / 12;
      g.fillStyle(color, 0.035 * (1 - t) + 0.012);
      g.fillCircle(c, c, (size / 2 - 1) * t);
    }
    g.fillStyle(color, 0.9);
    g.fillCircle(c, c, Math.max(1, size * 0.1));
  });
}

function drawTowerBase(graphics: Phaser.GameObjects.Graphics, id: TowerId, accent: number): void {
  const cx = 32;
  const cy = 32;
  graphics.fillStyle(0x050a16, 0.9);
  graphics.fillCircle(cx, cy, 22);
  graphics.lineStyle(2, COLORS.line, 0.9);
  graphics.strokeCircle(cx, cy, 22);
  graphics.lineStyle(1, accent, 0.55);
  graphics.strokeCircle(cx, cy, 18);

  if (id === 'pulse') {
    graphics.fillStyle(accent, 0.9);
    graphics.fillCircle(cx, cy, 7);
    graphics.fillStyle(0x07101d, 1);
    graphics.fillCircle(cx, cy, 3.5);
  } else if (id === 'mortar') {
    fillPolygon(graphics, polygonPoints(cx, cy, 13, 6), 0x07101d, 1);
    strokePolygon(graphics, polygonPoints(cx, cy, 13, 6), accent, 1.5, 0.75);
    graphics.fillStyle(accent, 0.8);
    graphics.fillCircle(cx, cy, 5);
  } else if (id === 'cryo') {
    graphics.lineStyle(2, accent, 0.85);
    graphics.strokeCircle(cx, cy, 12);
    graphics.strokeCircle(cx, cy, 7);
    graphics.fillStyle(accent, 0.8);
    graphics.fillCircle(cx, cy, 3);
  } else if (id === 'arc') {
    fillPolygon(graphics, polygonPoints(cx, cy, 11, 4, Math.PI / 4), 0x07101d, 1);
    strokePolygon(graphics, polygonPoints(cx, cy, 11, 4, Math.PI / 4), accent, 1.5, 0.9);
    graphics.fillStyle(accent, 0.85);
    graphics.fillCircle(cx, cy, 4);
  }
}

function drawTowerHead(graphics: Phaser.GameObjects.Graphics, id: TowerId, accent: number): void {
  const cx = 22;
  const cy = 22;
  if (id === 'pulse') {
    graphics.fillStyle(0x0b182b, 1);
    graphics.fillRoundedRect(cx - 11, cy - 13, 22, 18, 4);
    graphics.lineStyle(1.5, accent, 0.9);
    graphics.strokeRoundedRect(cx - 11, cy - 13, 22, 18, 4);
    graphics.fillStyle(accent, 1);
    graphics.fillRect(cx - 8, cy - 22, 4, 14);
    graphics.fillRect(cx + 4, cy - 22, 4, 14);
    graphics.fillStyle(COLORS.white, 0.85);
    graphics.fillCircle(cx, cy - 4, 2.5);
  } else if (id === 'mortar') {
    graphics.fillStyle(0x0b182b, 1);
    graphics.fillRoundedRect(cx - 9, cy - 8, 18, 16, 3);
    graphics.lineStyle(1.5, accent, 0.85);
    graphics.strokeRoundedRect(cx - 9, cy - 8, 18, 16, 3);
    graphics.fillStyle(accent, 1);
    graphics.fillRoundedRect(cx - 7, cy - 20, 14, 17, 4);
    graphics.fillStyle(0x07101d, 1);
    graphics.fillCircle(cx, cy - 20, 4.5);
    graphics.lineStyle(1, COLORS.white, 0.7);
    graphics.strokeCircle(cx, cy - 20, 3);
  } else if (id === 'cryo') {
    fillPolygon(graphics, polygonPoints(cx, cy - 4, 15, 3, -Math.PI / 2), accent, 0.28);
    strokePolygon(graphics, polygonPoints(cx, cy - 4, 15, 3, -Math.PI / 2), accent, 1.5, 0.95);
    graphics.lineStyle(1.5, COLORS.white, 0.7);
    graphics.beginPath();
    graphics.moveTo(cx, cy - 15);
    graphics.lineTo(cx, cy + 4);
    graphics.moveTo(cx - 8, cy - 8);
    graphics.lineTo(cx + 8, cy - 8);
    graphics.strokePath();
    graphics.fillStyle(COLORS.white, 0.9);
    graphics.fillCircle(cx, cy - 15, 2.5);
  } else if (id === 'arc') {
    graphics.lineStyle(2, accent, 0.95);
    graphics.beginPath();
    graphics.arc(cx, cy - 4, 10, -Math.PI * 0.8, Math.PI * 0.8);
    graphics.arc(cx, cy - 4, 6, Math.PI * 0.2, Math.PI * 1.8);
    graphics.strokePath();
    graphics.lineStyle(2, COLORS.white, 0.75);
    graphics.beginPath();
    graphics.moveTo(cx, cy - 19);
    graphics.lineTo(cx, cy + 5);
    graphics.strokePath();
    graphics.fillStyle(accent, 0.9);
    graphics.fillCircle(cx, cy - 19, 3);
  }
}

function drawEnemy(
  graphics: Phaser.GameObjects.Graphics,
  id: EnemyId,
  color: number,
  center = 64,
): void {
  const cx = center;
  const cy = center;

  if (id === 'scout') {
    fillPolygon(graphics, [
      { x: cx + 38, y: cy },
      { x: cx - 26, y: cy - 25 },
      { x: cx - 12, y: cy },
      { x: cx - 26, y: cy + 25 },
    ], color, 0.95);
    graphics.lineStyle(2, COLORS.white, 0.6);
    graphics.beginPath();
    graphics.moveTo(cx + 22, cy);
    graphics.lineTo(cx - 8, cy);
    graphics.strokePath();
    graphics.fillStyle(COLORS.white, 0.9);
    graphics.fillCircle(cx + 15, cy, 4);
  } else if (id === 'runner') {
    fillPolygon(graphics, [
      { x: cx + 45, y: cy },
      { x: cx - 30, y: cy - 17 },
      { x: cx - 14, y: cy },
      { x: cx - 30, y: cy + 17 },
    ], color, 0.95);
    graphics.fillStyle(COLORS.white, 0.85);
    graphics.fillCircle(cx + 20, cy, 4);
    graphics.lineStyle(1.5, COLORS.white, 0.45);
    graphics.beginPath();
    graphics.moveTo(cx - 18, cy - 12);
    graphics.lineTo(cx + 8, cy);
    graphics.lineTo(cx - 18, cy + 12);
    graphics.strokePath();
  } else if (id === 'brute') {
    fillPolygon(graphics, polygonPoints(cx, cy, 42, 6, Math.PI / 6), color, 0.9);
    fillPolygon(graphics, polygonPoints(cx, cy, 30, 6, Math.PI / 6), 0x2a0b18, 1);
    strokePolygon(graphics, polygonPoints(cx, cy, 42, 6, Math.PI / 6), COLORS.amber, 2, 0.65);
    graphics.fillStyle(COLORS.amber, 0.9);
    graphics.fillCircle(cx, cy, 9);
    graphics.fillStyle(0x1b0810, 1);
    graphics.fillCircle(cx, cy, 4);
  } else if (id === 'splitter') {
    graphics.fillStyle(color, 0.88);
    graphics.fillCircle(cx - 12, cy - 8, 25);
    graphics.fillCircle(cx + 14, cy + 9, 21);
    graphics.lineStyle(2, COLORS.white, 0.55);
    graphics.strokeCircle(cx - 12, cy - 8, 25);
    graphics.fillStyle(0x2a0c37, 1);
    graphics.fillCircle(cx - 12, cy - 8, 10);
    graphics.lineStyle(2, COLORS.white, 0.45);
    graphics.beginPath();
    graphics.moveTo(cx + 7, cy + 1);
    graphics.lineTo(cx + 25, cy + 15);
    graphics.strokePath();
  } else if (id === 'shard') {
    fillPolygon(graphics, [
      { x: cx + 30, y: cy },
      { x: cx - 18, y: cy - 18 },
      { x: cx - 8, y: cy },
      { x: cx - 18, y: cy + 18 },
    ], color, 0.95);
    graphics.fillStyle(COLORS.white, 0.85);
    graphics.fillCircle(cx + 12, cy, 4);
  } else if (id === 'elite') {
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      fillPolygon(graphics, [
        { x: cx + Math.cos(angle) * 58, y: cy + Math.sin(angle) * 58 },
        { x: cx + Math.cos(angle + 0.18) * 33, y: cy + Math.sin(angle + 0.18) * 33 },
        { x: cx + Math.cos(angle - 0.18) * 33, y: cy + Math.sin(angle - 0.18) * 33 },
      ], color, 0.62);
    }
    fillPolygon(graphics, polygonPoints(cx, cy, 40, 6, Math.PI / 6), 0x24111a, 1);
    strokePolygon(graphics, polygonPoints(cx, cy, 40, 6, Math.PI / 6), color, 3, 0.9);
    graphics.fillStyle(color, 0.9);
    graphics.fillCircle(cx, cy, 13);
    graphics.fillStyle(COLORS.void, 1);
    graphics.fillCircle(cx, cy, 6);
  } else if (id === 'boss') {
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12;
      fillPolygon(graphics, [
        { x: cx + Math.cos(angle) * 120, y: cy + Math.sin(angle) * 120 },
        { x: cx + Math.cos(angle + 0.12) * 66, y: cy + Math.sin(angle + 0.12) * 66 },
        { x: cx + Math.cos(angle - 0.12) * 66, y: cy + Math.sin(angle - 0.12) * 66 },
      ], color, 0.52);
    }
    graphics.fillStyle(0x1a0714, 1);
    graphics.fillCircle(cx, cy, 76);
    graphics.lineStyle(3, color, 0.9);
    graphics.strokeCircle(cx, cy, 76);
    graphics.lineStyle(1.5, COLORS.cyan, 0.55);
    graphics.strokeCircle(cx, cy, 58);
    fillPolygon(graphics, polygonPoints(cx, cy, 42, 6, Math.PI / 6), 0x3a0a26, 1);
    graphics.fillStyle(color, 0.95);
    graphics.fillCircle(cx, cy, 22);
    graphics.fillStyle(COLORS.white, 0.9);
    graphics.fillCircle(cx - 5, cy - 4, 6);
    graphics.fillStyle(COLORS.void, 1);
    graphics.fillCircle(cx + 6, cy + 3, 5);
  }

  // Ensure the texture has no unintended bounding artifacts.
  graphics.lineStyle(0, 0, 0);
  void center;
}

function drawIconShield(graphics: Phaser.GameObjects.Graphics): void {
  graphics.lineStyle(2, COLORS.cyan, 0.95);
  graphics.beginPath();
  graphics.moveTo(16, 4);
  graphics.lineTo(27, 9);
  graphics.lineTo(25, 19);
  graphics.lineTo(16, 28);
  graphics.lineTo(7, 19);
  graphics.lineTo(5, 9);
  graphics.closePath();
  graphics.strokePath();
  graphics.fillStyle(COLORS.cyan, 0.2);
  graphics.fillPath();
  graphics.lineStyle(1.5, COLORS.white, 0.9);
  graphics.beginPath();
  graphics.moveTo(16, 10);
  graphics.lineTo(16, 22);
  graphics.strokePath();
}

function drawIconCredit(graphics: Phaser.GameObjects.Graphics): void {
  fillPolygon(graphics, [
    { x: 16, y: 3 },
    { x: 28, y: 16 },
    { x: 16, y: 29 },
    { x: 4, y: 16 },
  ], COLORS.amber, 0.95);
  fillPolygon(graphics, [
    { x: 16, y: 8 },
    { x: 23, y: 16 },
    { x: 16, y: 24 },
    { x: 9, y: 16 },
  ], COLORS.void, 1);
  graphics.fillStyle(COLORS.amber, 1);
  graphics.fillCircle(16, 16, 3);
}

function drawIconWave(graphics: Phaser.GameObjects.Graphics): void {
  graphics.lineStyle(2, COLORS.magenta, 0.95);
  graphics.beginPath();
  graphics.moveTo(4, 24);
  graphics.lineTo(12, 12);
  graphics.lineTo(17, 19);
  graphics.lineTo(24, 7);
  graphics.lineTo(28, 11);
  graphics.strokePath();
  graphics.strokeCircle(24, 7, 3);
}

function drawIconSkill(graphics: Phaser.GameObjects.Graphics): void {
  graphics.lineStyle(2, COLORS.amber, 0.95);
  graphics.strokeCircle(16, 16, 10);
  graphics.strokeCircle(16, 16, 4);
  graphics.beginPath();
  graphics.moveTo(16, 1);
  graphics.lineTo(16, 7);
  graphics.moveTo(16, 25);
  graphics.lineTo(16, 31);
  graphics.moveTo(1, 16);
  graphics.lineTo(7, 16);
  graphics.moveTo(25, 16);
  graphics.lineTo(31, 16);
  graphics.strokePath();
}

function drawTowerGhost(graphics: Phaser.GameObjects.Graphics, color: number): void {
  graphics.lineStyle(2, color, 0.9);
  graphics.strokeCircle(32, 32, 24);
  graphics.lineStyle(1, color, 0.5);
  graphics.strokeCircle(32, 32, 30);
  graphics.fillStyle(color, 0.12);
  graphics.fillCircle(32, 32, 24);
}

export function generateTextures(scene: Phaser.Scene): void {
  // Background -----------------------------------------------------------------
  makeTexture(scene, 'starfield', 512, 512, (g) => {
    let seed = 1337;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0xffffffff;
    };
    for (let i = 0; i < 420; i++) {
      const x = rand() * 512;
      const y = rand() * 512;
      const size = rand() < 0.9 ? rand() * 1.3 + 0.4 : rand() * 2.2 + 0.8;
      const color = rand() < 0.18 ? COLORS.cyan : rand() < 0.2 ? COLORS.magenta : COLORS.text;
      g.fillStyle(color, rand() * 0.55 + 0.12);
      g.fillCircle(x, y, size);
    }
  });

  makeTexture(scene, 'nebula', 1280, 720, (g) => {
    const clouds = [
      { x: 260, y: 280, r: 330, color: 0x1a3b74, alpha: 0.075 },
      { x: 920, y: 250, r: 380, color: 0x3c1b64, alpha: 0.065 },
      { x: 880, y: 560, r: 300, color: 0x0e4e60, alpha: 0.06 },
      { x: 380, y: 590, r: 270, color: 0x411c4d, alpha: 0.045 },
    ];
    for (const cloud of clouds) {
      for (let i = 18; i >= 1; i--) {
        g.fillStyle(cloud.color, cloud.alpha / i + 0.004);
        g.fillCircle(cloud.x, cloud.y, (cloud.r * i) / 18);
      }
    }
    // A faint diagonal space-lane accent.
    g.lineStyle(1, COLORS.cyan, 0.025);
    for (let i = -200; i < 1500; i += 44) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i + 280, 720);
      g.strokePath();
    }
  });

  // Glow / particles / effects -------------------------------------------------
  makeTexture(scene, 'glow', 256, 256, (g) => {
    for (let i = 40; i >= 1; i--) {
      const t = i / 40;
      g.fillStyle(COLORS.white, 0.018 * (1 - t) + 0.006);
      g.fillCircle(128, 128, 124 * t);
    }
  });

  makeTexture(scene, 'spark', 12, 12, (g) => {
    g.fillStyle(COLORS.white, 0.25);
    g.fillCircle(6, 6, 5.5);
    g.fillStyle(COLORS.white, 1);
    g.fillCircle(6, 6, 2.2);
  });

  makeTexture(scene, 'ring', 128, 128, (g) => {
    g.lineStyle(5, COLORS.white, 0.95);
    g.strokeCircle(64, 64, 56);
    g.lineStyle(1.5, COLORS.white, 0.45);
    g.strokeCircle(64, 64, 64 - 5);
  });

  makeTexture(scene, 'core', 192, 192, (g) => {
    const c = 96;
    g.fillStyle(0x071426, 0.6);
    g.fillCircle(c, c, 64);
    g.lineStyle(2, COLORS.cyan, 0.3);
    g.strokeCircle(c, c, 72);
    g.lineStyle(2, COLORS.cyan, 0.7);
    g.strokeCircle(c, c, 51);
    strokePolygon(g, polygonPoints(c, c, 38, 6, Math.PI / 6), COLORS.cyan, 2, 0.9);
    fillPolygon(g, polygonPoints(c, c, 28, 6, Math.PI / 6), 0x0c2633, 1);
    g.fillStyle(COLORS.cyan, 0.65);
    g.fillCircle(c, c, 17);
    g.fillStyle(COLORS.white, 0.9);
    g.fillCircle(c, c, 9);
    g.fillStyle(COLORS.cyan, 0.35);
    g.fillCircle(c, c, 28);
    g.lineStyle(1.5, COLORS.white, 0.85);
    g.beginPath();
    g.moveTo(c - 16, c);
    g.lineTo(c + 16, c);
    g.moveTo(c, c - 16);
    g.lineTo(c, c + 16);
    g.strokePath();
  });

  // Build pads ----------------------------------------------------------------
  makeTexture(scene, 'pad', 64, 64, (g) => {
    strokePolygon(g, polygonPoints(32, 32, 24, 6, Math.PI / 6), COLORS.cyan, 1.2, 0.25);
    g.lineStyle(1, COLORS.cyan, 0.18);
    g.strokeCircle(32, 32, 16);
    g.fillStyle(COLORS.cyan, 0.15);
    g.fillCircle(32, 32, 2.5);
  });

  makeTexture(scene, 'pad-hover', 64, 64, (g) => {
    strokePolygon(g, polygonPoints(32, 32, 25, 6, Math.PI / 6), COLORS.cyan, 2, 0.9);
    g.lineStyle(1, COLORS.white, 0.45);
    g.strokeCircle(32, 32, 17);
    g.fillStyle(COLORS.cyan, 0.16);
    g.fillCircle(32, 32, 25);
  });

  // Towers --------------------------------------------------------------------
  const towerColors: Record<TowerId, number> = {
    pulse: COLORS.cyan,
    mortar: COLORS.amber,
    cryo: COLORS.green,
    arc: COLORS.magenta,
  };
  (Object.keys(towerColors) as TowerId[]).forEach((id) => {
    makeTexture(scene, `tower-${id}-base`, 64, 64, (g) => drawTowerBase(g, id, towerColors[id]));
    makeTexture(scene, `tower-${id}-head`, 44, 44, (g) => drawTowerHead(g, id, towerColors[id]));
  });
  makeTexture(scene, 'tower-ghost', 64, 64, (g) => drawTowerGhost(g, COLORS.cyan));

  // Enemies -------------------------------------------------------------------
  const enemyColors: Record<EnemyId, number> = {
    scout: 0xff4fd8,
    runner: 0xff7a9b,
    brute: 0xff5a6a,
    splitter: 0xd16bff,
    shard: 0xc58dff,
    elite: COLORS.amber,
    boss: 0xff3d9a,
  };
  (Object.keys(enemyColors) as EnemyId[]).forEach((id) => {
    const size = id === 'boss' ? 256 : 128;
    makeTexture(scene, `enemy-${id}`, size, size, (g) => drawEnemy(g, id, enemyColors[id], size / 2));
  });

  // Projectiles and skill ------------------------------------------------------
  makeTexture(scene, 'bolt', 22, 8, (g) => {
    g.fillStyle(COLORS.cyan, 0.22);
    g.fillCircle(11, 4, 4);
    g.fillStyle(COLORS.cyan, 0.95);
    g.fillRoundedRect(2, 2.5, 16, 3, 1.5);
    g.fillStyle(COLORS.white, 0.95);
    g.fillCircle(17, 4, 2);
  });

  makeTexture(scene, 'shell', 16, 16, (g) => {
    g.fillStyle(COLORS.amber, 0.2);
    g.fillCircle(8, 8, 7.5);
    g.fillStyle(COLORS.amber, 0.95);
    g.fillCircle(8, 8, 4.5);
    g.fillStyle(COLORS.white, 0.9);
    g.fillCircle(6.5, 6.5, 1.8);
  });

  makeTexture(scene, 'ice-ring', 128, 192, (g) => {
    g.lineStyle(2, COLORS.green, 0.4);
    g.strokeCircle(64, 96, 54);
    g.lineStyle(1, COLORS.white, 0.25);
    g.strokeCircle(64, 96, 66);
  });

  // HUD icons -----------------------------------------------------------------
  makeTexture(scene, 'icon-shield', 32, 32, drawIconShield);
  makeTexture(scene, 'icon-credit', 32, 32, drawIconCredit);
  makeTexture(scene, 'icon-wave', 32, 32, drawIconWave);
  makeTexture(scene, 'icon-skill', 32, 32, drawIconSkill);

  // Soft color dots for UI/particles.
  makeSoftDot(scene, 'dot-cyan', 32, COLORS.cyan);
  makeSoftDot(scene, 'dot-magenta', 32, COLORS.magenta);
  makeSoftDot(scene, 'dot-amber', 32, COLORS.amber);
  makeSoftDot(scene, 'dot-green', 32, COLORS.green);
  makeSoftDot(scene, 'dot-red', 32, COLORS.red);
}
