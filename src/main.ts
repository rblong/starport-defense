import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, RENDER_SCALE } from './game/constants';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';
import { audio } from './systems/audio';
import { startAmbientBackdrop } from './render/ambient';

startAmbientBackdrop();

function supportsWebGL2(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2');
    if (!context) return false;
    // Release the probe context immediately.
    const lose = context.getExtension('WEBGL_lose_context');
    lose?.loseContext();
    return true;
  } catch {
    return false;
  }
}

function showFatal(): void {
  const boot = document.getElementById('boot-message');
  if (boot) boot.style.display = 'none';
  const fatal = document.getElementById('fatal-message');
  if (fatal) fatal.style.display = 'flex';
}

if (!supportsWebGL2()) {
  showFatal();
} else {
  try {
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.WEBGL,
      width: GAME_WIDTH * RENDER_SCALE,
      height: GAME_HEIGHT * RENDER_SCALE,
      parent: 'game',
      backgroundColor: '#050814',
      render: {
        antialias: true,
        roundPixels: false,
        powerPreference: 'high-performance',
      },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      fps: {
        target: 60,
        forceSetTimeOut: false,
      },
      scene: [BootScene, MenuScene, GameScene, UIScene],
    };

    const game = new Phaser.Game(config);

    const unlockAudio = (): void => {
      audio.unlock();
    };
    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    window.addEventListener('keydown', unlockAudio);
    window.addEventListener(
      'contextmenu',
      (event) => {
        event.preventDefault();
      },
      { capture: true },
    );

    if (import.meta.env.DEV) {
      (window as unknown as { __starportGame?: Phaser.Game }).__starportGame = game;
      (window as unknown as { __starportAudio?: typeof audio }).__starportAudio = audio;
    }

    if (import.meta.hot) {
      import.meta.hot.dispose(() => {
        window.removeEventListener('pointerdown', unlockAudio);
        window.removeEventListener('keydown', unlockAudio);
        game.destroy(true);
      });
    }
  } catch (error) {
    console.error('[Starport] failed to initialize Phaser', error);
    showFatal();
  }
}
