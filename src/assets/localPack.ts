import Phaser from 'phaser';
import { audio } from '../systems/audio';

interface LocalPackManifest {
  available?: boolean;
  images?: Record<string, string>;
  spritesheets?: Record<string, {
    path: string;
    frameWidth: number;
    frameHeight: number;
    endFrame?: number;
  }>;
  audio?: string[];
}

function baseUrl(): string {
  return `${import.meta.env.BASE_URL}assets/sc-local/`;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`asset load failed: ${url}`));
    image.src = url;
  });
}

/**
 * Optional local-only StarCraft reference pack. The pack is ignored by git
 * because its art/audio is externally owned; the game must remain fully
 * playable with procedural fallback when it is absent.
 */
export async function loadLocalAssetPack(scene: Phaser.Scene): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl()}manifest.json`, { cache: 'no-store' });
    if (!response.ok) return false;
    const manifest = (await response.json()) as LocalPackManifest;
    if (!manifest.available) return false;

    for (const [key, relative] of Object.entries(manifest.images ?? {})) {
      const image = await loadImage(`${baseUrl()}${relative}`);
      scene.textures.addImage(key, image);
      scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }

    for (const [key, sheet] of Object.entries(manifest.spritesheets ?? {})) {
      const image = await loadImage(`${baseUrl()}${sheet.path}`);
      const texture = scene.textures.addSpriteSheet(key, image, {
        frameWidth: sheet.frameWidth,
        frameHeight: sheet.frameHeight,
        endFrame: sheet.endFrame,
      });
      texture?.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }

    if (scene.textures.exists('sc-explosion') && !scene.anims.exists('sc-explode')) {
      scene.anims.create({
        key: 'sc-explode',
        frames: scene.anims.generateFrameNumbers('sc-explosion', { start: 0, end: 8 }),
        frameRate: 16,
        repeat: 0,
      });
    }

    audio.setStarCraftPack(true, manifest.audio ?? []);
    return true;
  } catch (error) {
    console.info('[Starport] local StarCraft pack not loaded; using procedural fallback', error);
    audio.setStarCraftPack(false, []);
    return false;
  }
}
