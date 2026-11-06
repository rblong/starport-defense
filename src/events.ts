import Phaser from 'phaser';
import type {
  HudSnapshot,
  ModeSnapshot,
  ResultPayload,
  SkillStatus,
  ToastPayload,
  TowerId,
  TowerSelection,
  TargetMode,
  WaveBannerPayload,
  Speed,
} from './types';

export type EmptyPayload = Record<string, never>;

export interface GameEventMap {
  'ui:requestState': EmptyPayload;
  'ui:startWave': EmptyPayload;
  'ui:selectBuild': { towerId: TowerId };
  'ui:cancelBuild': EmptyPayload;
  'ui:selectTower': { towerId: number | null };
  'ui:upgradeTower': EmptyPayload;
  'ui:sellTower': EmptyPayload;
  'ui:setTargetMode': { mode: TargetMode };
  'ui:toggleSkillAim': EmptyPayload;
  'ui:cancelSkillAim': EmptyPayload;
  'ui:togglePause': EmptyPayload;
  'ui:setSpeed': { speed: Speed };
  'ui:setAutoNextWave': { enabled: boolean };
  'ui:restart': EmptyPayload;
  'ui:quitMenu': EmptyPayload;

  'game:hud': HudSnapshot;
  'game:mode': ModeSnapshot;
  'game:selection': TowerSelection | null;
  'game:skill': SkillStatus;
  'game:autoNext': { active: boolean; remaining: number };
  'game:waveBanner': WaveBannerPayload;
  'game:toast': ToastPayload;
  'game:result': ResultPayload;
  'game:runReset': EmptyPayload;
  'game:damageFlash': { damage: number };
  'game:boss': { visible: boolean; name: string; ratio: number } | null;
}

type Handler<T> = (payload: T) => void;

class TypedEventBus {
  private readonly emitter = new Phaser.Events.EventEmitter();
  private readonly registrations: Array<{
    event: keyof GameEventMap;
    handler: (payload: never) => void;
    context: unknown;
  }> = [];

  on<K extends keyof GameEventMap>(event: K, handler: Handler<GameEventMap[K]>, context?: unknown): this {
    this.emitter.on(event, handler as (...args: unknown[]) => void, context);
    this.registrations.push({
      event,
      handler: handler as (payload: never) => void,
      context,
    });
    return this;
  }

  off<K extends keyof GameEventMap>(event: K, handler: Handler<GameEventMap[K]>, context?: unknown): this {
    this.emitter.off(event, handler as (...args: unknown[]) => void, context);
    const index = this.registrations.findIndex(
      (entry) => entry.event === event && entry.handler === handler && entry.context === context,
    );
    if (index >= 0) this.registrations.splice(index, 1);
    return this;
  }

  emit<K extends keyof GameEventMap>(event: K, payload: GameEventMap[K]): this {
    this.emitter.emit(event, payload);
    return this;
  }

  offContext(context: unknown): this {
    for (let i = this.registrations.length - 1; i >= 0; i--) {
      const entry = this.registrations[i]!;
      if (entry.context !== context) continue;
      this.emitter.off(entry.event, entry.handler as (...args: unknown[]) => void, context);
      this.registrations.splice(i, 1);
    }
    return this;
  }
}

export const gameBus = new TypedEventBus();
