import Phaser from 'phaser';
import type { BackgroundLayers } from './background';

/** Animated 2D sphere projection: real map samples, moving sun and cloud field. */
class OrbitalEarth {
  readonly image: Phaser.GameObjects.Image;
  private readonly texture: Phaser.Textures.CanvasTexture;
  private readonly context: CanvasRenderingContext2D;
  private readonly pixels: ImageData;
  private readonly map: Uint8ClampedArray;
  private readonly mapWidth: number;
  private readonly mapHeight: number;
  private readonly clouds = new Float32Array(512 * 256);
  private readonly points: Array<{ index: number; u: number; row: number; cloudRow: number; x: number; y: number; z: number; rim: number; alpha: number }> = [];
  private phase = 0;
  private pending = 0;
  private dirty = true;

  constructor(scene: Phaser.Scene) {
    const size = 512;
    const key = 'orbital-earth-live';
    if (scene.textures.exists(key)) scene.textures.remove(key);
    this.texture = scene.textures.createCanvas(key, size, size)!;
    this.context = this.texture.context;
    this.pixels = this.context.createImageData(size, size);
    const source = scene.textures.get('earth-map').getSourceImage() as HTMLImageElement;
    const mapCanvas = document.createElement('canvas');
    this.mapWidth = mapCanvas.width = source.width;
    this.mapHeight = mapCanvas.height = source.height;
    const c = mapCanvas.getContext('2d', { willReadFrequently: true })!;
    c.drawImage(source, 0, 0);
    this.map = c.getImageData(0, 0, this.mapWidth, this.mapHeight).data;
    if (scene.textures.exists('earth-clouds')) {
      const cc = document.createElement('canvas'); cc.width = 512; cc.height = 256;
      const cx = cc.getContext('2d', {willReadFrequently:true})!;
      cx.drawImage(scene.textures.get('earth-clouds').getSourceImage() as HTMLImageElement,0,0,512,256);
      const data = cx.getImageData(0,0,512,256).data;
      for(let i=0;i<this.clouds.length;i++) this.clouds[i] = (data[i*4]! / 255) ** 1.25 * 0.85;
    }
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const nx = (x + 0.5 - size / 2) / (size / 2 - 3), ny = (y + 0.5 - size / 2) / (size / 2 - 3);
      const r2 = nx * nx + ny * ny;
      if (r2 >= 1) continue;
      const z = Math.sqrt(1 - r2);
      this.points.push({ index: (y * size + x) * 4, u: (Math.atan2(nx, z) / (Math.PI * 2) + 0.5) * this.mapWidth,
        row: Math.min(this.mapHeight - 1, Math.floor((Math.asin(ny) / Math.PI + 0.5) * this.mapHeight)) * this.mapWidth,
        cloudRow: Math.min(255, Math.floor((Math.asin(ny) / Math.PI + 0.5) * 256)) * 512,
        x: nx, y: ny, z, rim: (1 - z) ** 3, alpha: Math.min(255, (1 - Math.sqrt(r2)) * (size / 2 - 3) * 255) });
    }
    this.image = scene.add.image(785, 580, key).setDisplaySize(650, 650).setDepth(-16).setAngle(-12);
    this.draw();
  }

  private draw(): void {
    const dst = this.pixels.data, src = this.map;
    const rotation = this.phase * this.mapWidth * 0.009;
    const sunX = -0.65 + Math.sin(this.phase * 0.13) * 0.1;
    const sunY = -0.40, sunZ = 0.67;
    for (const p of this.points) {
      const col = ((Math.floor(p.u + rotation + this.mapWidth * 0.12) % this.mapWidth) + this.mapWidth) % this.mapWidth;
      const i = (p.row + col) * 4;
      const sun = p.x * sunX + p.y * sunY + p.z * sunZ;
      const light = Math.max(0.025, Math.min(1, sun * 0.93 + 0.08));
      const cloudCol = Math.floor((p.u / this.mapWidth + this.phase * 0.0105 + 0.12) * 512) % 512;
      const cloud = this.clouds[p.cloudRow + cloudCol]!;
      const rim = p.rim * Math.max(0.15, sun + 0.3);
      dst[p.index] = Math.min(255, (src[i]! * (1 - cloud) + 220 * cloud) * light + rim * 25);
      dst[p.index + 1] = Math.min(255, (src[i + 1]! * (1 - cloud) + 230 * cloud) * light + rim * 100);
      dst[p.index + 2] = Math.min(255, (src[i + 2]! * (1 - cloud) + 245 * cloud) * light + rim * 175);
      dst[p.index + 3] = p.alpha;
    }
    this.context.putImageData(this.pixels, 0, 0);
    this.texture.refresh();
  }

  update(delta: number, reducedMotion: boolean): void {
    if (reducedMotion) { if (this.dirty) { this.draw(); this.dirty = false; } return; }
    this.phase += Math.min(delta, 100) / 1000;
    this.pending += delta;
    if (this.pending >= 83) { this.pending = 0; this.draw(); }
  }
  destroy(): void { this.image.destroy(); this.texture.destroy(); }
}

export function createOrbitalMenu(scene: Phaser.Scene): BackgroundLayers {
  const sky = scene.add.rectangle(640, 360, 1280, 720, 0x030913).setDepth(-20);
  const nebula = scene.add.image(930, 390, 'nebula').setDepth(-19).setAlpha(0.42);
  const stars = scene.add.tileSprite(640, 360, 1280, 720, 'starfield').setDepth(-18).setAlpha(0.47);
  // Independent blue atmospheric halo behind the projected planet.
  const halo = scene.add.image(785, 580, 'glow').setDepth(-17).setTint(0x287ee8).setScale(7.3).setAlpha(0.24).setBlendMode(Phaser.BlendModes.ADD);
  const earth = scene.textures.exists('earth-map') ? new OrbitalEarth(scene) : null;
  const ship = scene.add.container(870, 235).setDepth(-12);
  const body = scene.add.image(0, 0, 'battlecruiser-hero').setDisplaySize(660, 440);
  // Coordinates belong to the hero cutout; emitter and hull share one transform.
  const emitters = [{x: 272, y: 43}, {x: 240, y: 103}];
  if (!scene.textures.exists('orbital-engine-jet')) {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 96;
    const c = canvas.getContext('2d')!;
    for (let i = 0; i < 4; i++) {
      const gradient = c.createRadialGradient(20,48,0,100,48,135-i*18);
      gradient.addColorStop(0, i === 3 ? 'rgba(245,255,255,.95)' : 'rgba(100,210,255,.5)');
      gradient.addColorStop(.3, 'rgba(74,166,255,.35)'); gradient.addColorStop(1,'rgba(8,40,180,0)');
      c.fillStyle = gradient; c.beginPath(); c.ellipse(100-i*18,48,130-i*20,32-i*7,0,0,Math.PI*2); c.fill();
    }
    scene.textures.addCanvas('orbital-engine-jet',canvas);
  }
  const jets = emitters.map(p => scene.add.image(p.x-4,p.y,'orbital-engine-jet').setOrigin(0,.5).setRotation(.24).setBlendMode(Phaser.BlendModes.ADD));
  const exhaust = scene.add.graphics(); ship.add(jets); ship.add(exhaust); ship.add(body);
  const glass = scene.add.graphics().setDepth(-8);
  glass.fillStyle(0x03080c, 0.25); glass.fillRect(0, 0, 505, 720);
  glass.fillStyle(0x202b31, 0.88); glass.fillRect(60, 78, 400, 574);
  glass.fillStyle(0x080f15, 0.94); glass.fillRect(64, 82, 392, 566);
  glass.lineStyle(1, 0x6f8490, 0.65); glass.strokeRect(60, 78, 400, 574);
  for (const x of [69, 450]) for (const y of [88, 642]) {
    glass.fillStyle(0x91a4ab); glass.fillCircle(x, y, 2.5);
    glass.lineStyle(1, 0x101c24); glass.lineBetween(x - 2, y, x + 2, y);
  }
  let time = 0;
  const plumes = (reduced: boolean) => {
    exhaust.clear();
    for (let n = 0; n < emitters.length; n++) {
      const p = emitters[n]!;
      const pulse = reduced ? 0.55 : 0.95 + Math.sin(time * 17 + n * 2) * 0.14 + Math.sin(time * 31) * 0.09;
      const angle = 0.24, dx = Math.cos(angle), dy = Math.sin(angle);
      jets[n]!.setDisplaySize((reduced ? 66 : 160) * pulse, 50 + pulse * 5).setAlpha(reduced ? 0.5 : 0.85);
      if (!reduced) for (let j = 0; j < 5; j++) {
        const distance = ((time * 95 + j * 23 + n * 17) % 135);
        exhaust.fillStyle(0x72c7ff, Math.max(0, 0.6 - distance / 220));
        exhaust.fillCircle(p.x + dx * distance, p.y + dy * distance + Math.sin(time * 8 + j) * 3, 1.8 - distance / 120);
      }
    }
  };
  plumes(false);
  return {
    update(delta, reducedMotion) {
      earth?.update(delta, reducedMotion);
      if (!reducedMotion) {
        time += Math.min(delta, 100) / 1000;
        ship.setPosition(870 + Math.sin(time * 0.17) * 13, 235 + Math.sin(time * 0.65) * 5);
        ship.setRotation(Math.sin(time * 0.28) * 0.009);
        stars.tilePositionX = time * 0.6;
        halo.setAlpha(0.23 + Math.sin(time * 0.3) * 0.035);
      }
      plumes(reducedMotion);
    },
    destroy() { earth?.destroy(); for (const item of [sky, nebula, stars, halo, ship, glass]) item.destroy(); },
  };
}
