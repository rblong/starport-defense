interface AmbientStar {
  x: number;
  y: number;
  radius: number;
  speed: number;
  alpha: number;
  phase: number;
  color: string;
}

function shouldReduceMotion(): boolean {
  try {
    const raw = localStorage.getItem('starport-defense:v1:settings');
    if (raw) {
      const settings = JSON.parse(raw) as { reducedMotion?: boolean };
      if (settings.reducedMotion === true) return true;
    }
  } catch {
    // Ignore malformed / unavailable storage.
  }
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/**
 * Full-viewport ambient space backdrop. The Phaser canvas keeps its 16:9
 * aspect ratio; this layer fills the letterboxed areas with the same visual
 * language so the page reads as a single full-bleed scene.
 */
export function startAmbientBackdrop(): void {
  if ((window as unknown as { __starportAmbient?: boolean }).__starportAmbient) return;
  (window as unknown as { __starportAmbient?: boolean }).__starportAmbient = true;

  const canvas = document.getElementById('ambient') as HTMLCanvasElement | null;
  if (!canvas) return;
  const context = canvas.getContext('2d');
  if (!context) return;

  const reducedMotion = shouldReduceMotion();
  const stars: AmbientStar[] = [];
  const palette = ['#eaf6ff', '#39e7ff', '#ff4fd8', '#7f9cc0'];
  let width = 0;
  let height = 0;
  let dpr = 1;
  let glowLayer: HTMLCanvasElement | null = null;
  let lastTime = 0;
  let lastDraw = 0;
  let started = performance.now();

  const rebuildGlow = (): void => {
    const layer = document.createElement('canvas');
    layer.width = Math.max(1, Math.floor(width * 0.75));
    layer.height = Math.max(1, Math.floor(height * 0.75));
    const ctx = layer.getContext('2d');
    if (!ctx) return;
    ctx.scale(0.75, 0.75);

    const clouds = [
      { x: width * 0.16, y: height * 0.23, r: Math.min(width, height) * 0.34, color: [29, 70, 130] as const, alpha: 0.07 },
      { x: width * 0.84, y: height * 0.18, r: Math.min(width, height) * 0.32, color: [100, 36, 120] as const, alpha: 0.06 },
      { x: width * 0.76, y: height * 0.82, r: Math.min(width, height) * 0.36, color: [14, 76, 96] as const, alpha: 0.055 },
      { x: width * 0.3, y: height * 0.9, r: Math.min(width, height) * 0.28, color: [72, 28, 88] as const, alpha: 0.045 },
    ];

    for (const cloud of clouds) {
      const gradient = ctx.createRadialGradient(cloud.x, cloud.y, 0, cloud.x, cloud.y, cloud.r);
      const [r, g, b] = cloud.color;
      gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${cloud.alpha})`);
      gradient.addColorStop(0.55, `rgba(${r}, ${g}, ${b}, ${cloud.alpha * 0.42})`);
      gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    }
    glowLayer = layer;
  };

  const seedStars = (): void => {
    stars.length = 0;
    const count = Math.max(70, Math.min(190, Math.round((width * height) / 11000)));
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: 0.35 + Math.random() * 1.25,
        speed: 0.12 + Math.random() * 0.55,
        alpha: 0.16 + Math.random() * 0.64,
        phase: Math.random() * Math.PI * 2,
        color: palette[Math.floor(Math.random() * palette.length)] ?? '#eaf6ff',
      });
    }
  };

  const resize = (): void => {
    width = Math.max(1, window.innerWidth);
    height = Math.max(1, window.innerHeight);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    rebuildGlow();
    seedStars();
    if (reducedMotion) {
      draw(performance.now(), 0);
    }
  };

  const draw = (now: number, deltaSeconds: number): void => {
    const elapsed = (now - started) / 1000;
    context.clearRect(0, 0, width, height);

    if (glowLayer) {
      context.globalAlpha = 0.72;
      context.drawImage(glowLayer, 0, 0, width, height);
      context.globalAlpha = 1;
    }

    for (const star of stars) {
      if (!reducedMotion) {
        star.x += star.speed * deltaSeconds;
        if (star.x > width + 2) star.x = -2;
      }
      const twinkle = reducedMotion ? 1 : 0.72 + Math.sin(elapsed * 0.9 + star.phase) * 0.28;
      context.globalAlpha = Math.max(0.04, star.alpha * twinkle);
      context.fillStyle = star.color;
      context.beginPath();
      context.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  };

  const tick = (now: number): void => {
    requestAnimationFrame(tick);
    // The backdrop is intentionally slow; 30 fps is enough and keeps the
    // full-viewport canvas cheap on low-end machines.
    if (now - lastDraw < 33) return;
    const delta = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;
    lastDraw = now;
    draw(now, reducedMotion ? 0 : delta);
  };

  resize();
  window.addEventListener('resize', resize, { passive: true });
  if (!reducedMotion) {
    lastTime = performance.now();
    lastDraw = 0;
    started = lastTime;
    requestAnimationFrame(tick);
  }
}
