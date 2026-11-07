import Phaser from 'phaser';
import { BATTLE_TOP, BATTLE_BOTTOM, WORLD_WIDTH, RENDER_SCALE, DEPTH } from '../game/constants';
import { LEVEL_ONE, gridToPixel, pathToPixels } from '../data/level01';
import { buildPath, samplePath } from '../domain/path';

/** Static authored-looking deck, baked once at render resolution. */
export function drawStarport(scene: Phaser.Scene): void {
  const key = 'starport-industrial-deck';
  if (!scene.textures.exists(`${key}-0`)) {
    const canvas = document.createElement('canvas');
    const height = BATTLE_BOTTOM - BATTLE_TOP;
    canvas.width = WORLD_WIDTH * RENDER_SCALE;
    canvas.height = height * RENDER_SCALE;
    const c = canvas.getContext('2d')!;
    c.scale(RENDER_SCALE, RENDER_SCALE);
    c.translate(0, -BATTLE_TOP);
    const fill = c.createLinearGradient(0, BATTLE_TOP, 0, BATTLE_BOTTOM);
    fill.addColorStop(0, '#253038'); fill.addColorStop(0.5, '#333c40'); fill.addColorStop(1, '#1c272e');
    c.fillStyle = fill; c.fillRect(0, BATTLE_TOP, WORLD_WIDTH, height);
    let seed = 92;
    const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0xffffffff; };
    // Large armour panels, bevels, rivets, and subtle wear.
    for (let y = BATTLE_TOP + 14; y < BATTLE_BOTTOM; y += 72) {
      for (let x = -30; x < WORLD_WIDTH; x += 144) {
        c.fillStyle = `rgba(150,166,174,${0.025 + rand() * 0.045})`;
        c.fillRect(x + 2, y + 2, 140, 68);
        c.strokeStyle = '#172128'; c.lineWidth = 2; c.strokeRect(x, y, 144, 72);
        c.strokeStyle = '#465057'; c.lineWidth = 0.65; c.strokeRect(x + 2, y + 2, 140, 68);
        for (const bx of [x + 7, x + 136]) for (const by of [y + 7, y + 64]) {
          c.fillStyle = '#121c23'; c.fillRect(bx, by, 3, 3);
          c.fillStyle = '#657079'; c.fillRect(bx, by, 2, 1);
        }
        for (let i = 0; i < 7; i++) {
          c.strokeStyle = 'rgba(180,190,190,0.035)'; c.beginPath();
          const xx = x + rand() * 135, yy = y + rand() * 65;
          c.moveTo(xx, yy); c.lineTo(xx + 4 + rand() * 22, yy - 2); c.stroke();
        }
      }
    }
    const route = pathToPixels(LEVEL_ONE);
    const path = buildPath(route);
    const strokeRoute = (width: number, color: string) => {
      c.strokeStyle = color; c.lineWidth = width; c.lineJoin = 'round'; c.lineCap = 'round';
      c.beginPath(); c.moveTo(route[0]!.x, route[0]!.y);
      for (const p of route.slice(1)) c.lineTo(p.x, p.y);
      c.stroke();
    };
    strokeRoute(70, '#111b21'); strokeRoute(64, '#596166');
    strokeRoute(58, '#253238'); strokeRoute(51, '#202c32');
    strokeRoute(48, '#303b40');
    // Edge lights, safety paint and interrupted centre markings.
    for (let d = 8; d < path.totalLength; d += 24) {
      const p = samplePath(path, d);
      c.save(); c.translate(p.x, p.y); c.rotate(p.angle);
      for (const side of [-1, 1]) {
        c.fillStyle = '#111b20'; c.fillRect(-5, side * 29 - 3, 10, 6);
        c.fillStyle = Math.floor(d / 24) % 4 === 0 ? '#efba62' : '#8badb0';
        c.globalAlpha = 0.75; c.fillRect(-3, side * 29 - 1, 6, 2); c.globalAlpha = 1;
        c.fillStyle = '#b2a878'; c.globalAlpha = 0.36; c.fillRect(-7, side * 23 - 1, 14, 1); c.globalAlpha = 1;
      }
      if (Math.floor(d / 24) % 3 === 0) {
        c.strokeStyle = '#859393'; c.globalAlpha = 0.4; c.lineWidth = 1;
        c.beginPath(); c.moveTo(-7, -4); c.lineTo(-2, 0); c.lineTo(-7, 4); c.stroke(); c.globalAlpha = 1;
      }
      c.restore();
    }
    // Only decorate clear areas, preserving deployment silhouettes and lanes.
    const pads = LEVEL_ONE.pads.map(p => gridToPixel(p));
    const clear = (x: number, y: number) => {
      if (pads.some(p => Math.hypot(p.x - x, p.y - y) < 84)) return false;
      for (let d = 0; d < path.totalLength; d += 22) {
        const p = samplePath(path, d); if (Math.hypot(p.x - x, p.y - y) < 90) return false;
      }
      return true;
    };
    for (let x = 65; x < WORLD_WIDTH - 70; x += 112) for (let y = BATTLE_TOP + 65; y < BATTLE_BOTTOM - 45; y += 105) {
      if (!clear(x, y) || rand() < 0.15) continue;
      c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(x - 32, y - 17, 76, 46);
      const color = rand() > 0.55 ? '#46504c' : '#34444c';
      c.fillStyle = '#111c23'; c.fillRect(x - 36, y - 25, 72, 44);
      c.fillStyle = color; c.fillRect(x - 33, y - 28, 66, 41);
      c.strokeStyle = '#707973'; c.lineWidth = 1; c.strokeRect(x - 33, y - 28, 66, 41);
      for (let n = -25; n < 30; n += 9) {
        c.fillStyle = '#223139'; c.fillRect(x + n, y - 23, 3, 31);
        c.fillStyle = '#5b6565'; c.fillRect(x + n + 3, y - 23, 1, 31);
      }
      // Distinct utilities break up the regular cargo silhouette.
      const utility = rand();
      if (utility > 0.7) {
        c.fillStyle = '#263239'; c.fillRect(x - 29, y - 24, 58, 33);
        for (const fx of [-15, 15]) {
          c.fillStyle = '#101b21'; c.beginPath(); c.arc(x + fx, y - 7, 12, 0, Math.PI * 2); c.fill();
          c.strokeStyle = '#8a9695'; c.lineWidth = 1; c.stroke();
          c.strokeStyle = '#526268';
          for (let fan = 0; fan < 4; fan++) { const a = fan * Math.PI / 2; c.beginPath(); c.moveTo(x + fx, y - 7); c.lineTo(x + fx + Math.cos(a) * 9, y - 7 + Math.sin(a) * 9); c.stroke(); }
        }
      } else if (utility > 0.4) {
        for (let line = -12; line <= 12; line += 12) {
          c.fillStyle = '#202d35'; c.fillRect(x - 28, y + line - 14, 56, 9);
          c.fillStyle = '#69777a'; c.fillRect(x - 28, y + line - 14, 56, 3);
          c.fillStyle = '#a89763'; c.fillRect(x - 14, y + line - 14, 4, 9); c.fillRect(x + 13, y + line - 14, 4, 9);
        }
      }
      c.fillStyle = '#d4b76a'; c.fillRect(x - 29, y + 6, 9, 3);
      c.font = '7px Consolas, monospace'; c.fillStyle = '#a2aea9'; c.fillText(`C-${Math.floor(x / 10)}`, x - 19, y - 31);
    }
    // Painted service markings and industrial abrasion around the roadway.
    for (let d = 160; d < path.totalLength - 60; d += 260) {
      const p = samplePath(path, d);
      c.save(); c.translate(p.x, p.y); c.rotate(p.angle);
      c.font = 'bold 11px Consolas, monospace'; c.fillStyle = 'rgba(208,213,192,.22)';
      c.fillText('KEEP CLEAR', -35, -7);
      c.fillStyle = 'rgba(10,19,24,.22)'; c.fillRect(-50, 10, 100, 2); c.fillRect(-40, 14, 80, 2);
      c.restore();
    }
    // Recessed service rails frame the playable deck.
    for (const y of [BATTLE_TOP + 4, BATTLE_BOTTOM - 8]) {
      c.fillStyle = '#0d171f'; c.fillRect(0, y, WORLD_WIDTH, 6);
      c.fillStyle = '#5d6e72'; c.fillRect(0, y, WORLD_WIDTH, 1);
      for (let x = 14; x < WORLD_WIDTH; x += 58) {
        c.fillStyle = '#d1b56a'; c.globalAlpha = 0.55; c.fillRect(x, y + 2, 16, 2); c.globalAlpha = 1;
      }
    }
    const zones = [[235, 148, '01', 'ARRIVAL / 进场区'], [1000, 200, '02', 'TRANSFER / 转运区'], [1790, 452, '03', 'REACTOR / 核心区']] as const;
    for (const [x, y, number, label] of zones) {
      c.font = 'bold 48px Consolas, monospace'; c.fillStyle = 'rgba(185,200,199,.10)'; c.fillText(number, x, y);
      c.font = '9px "Segoe UI", "Microsoft YaHei", sans-serif'; c.fillStyle = '#839b9e'; c.fillText(label, x + 65, y - 12);
      c.fillStyle = '#718184'; c.fillRect(x + 65, y - 3, 104, 1);
    }
    // Runway threshold and worn white bars at entry.
    const entry = samplePath(path, 170);
    c.save(); c.translate(entry.x, entry.y); c.rotate(entry.angle);
    c.fillStyle = 'rgba(188,194,176,.5)';
    for (let i = -2; i <= 2; i++) c.fillRect(-12, i * 8 - 2, 24, 4);
    c.restore();
    // Two modest textures also fit devices with a 4096px texture limit.
    for (let i = 0; i < 2; i++) {
      const chunk = document.createElement('canvas');
      chunk.width = canvas.width / 2; chunk.height = canvas.height;
      chunk.getContext('2d')!.drawImage(canvas, i * chunk.width, 0, chunk.width, chunk.height, 0, 0, chunk.width, chunk.height);
      scene.textures.addCanvas(`${key}-${i}`, chunk);
    }
  }
  for (let i = 0; i < 2; i++) {
    scene.add.image(WORLD_WIDTH * (i + 0.5) / 2, (BATTLE_TOP + BATTLE_BOTTOM) / 2, `${key}-${i}`)
      .setScale(1 / RENDER_SCALE).setDepth(DEPTH.path - 2);
  }
}
