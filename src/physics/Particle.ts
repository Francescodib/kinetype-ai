import type { ParticleState } from '../types/index.js';

export class Particle implements ParticleState {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  homeX = 0;
  homeY = 0;
  color = 0x39ff14;
  hitColor = 0xff4444;
  alpha = 1;
  radius = 1.5;

  /** True while the particle is frozen by freeze-mode body contact. */
  frozen = false;

  /** Blend factor toward hitColor (0 = base color, 1 = hit color). */
  private colorBlend = 0;

  update(dt: number, forceX: number, forceY: number, friction: number, ease: number): void {
    if (this.frozen) {
      // Frozen: very slow drift back home, no velocity accumulation
      const dx = this.homeX - this.x;
      const dy = this.homeY - this.y;
      this.x += dx * 0.005;
      this.y += dy * 0.005;
      this.colorBlend *= 0.98;
      return;
    }

    // Apply external force
    this.vx += forceX;
    this.vy += forceY;

    // Spring toward home
    const dx = this.homeX - this.x;
    const dy = this.homeY - this.y;
    this.vx += dx * ease;
    this.vy += dy * ease;

    // Friction
    this.vx *= friction;
    this.vy *= friction;

    // Euler integration
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Color blend proportional to force magnitude, decays per frame
    const forceMag = Math.sqrt(forceX * forceX + forceY * forceY);
    this.colorBlend = Math.min(1, this.colorBlend + forceMag * 0.12);
    this.colorBlend *= 0.92;
  }

  /** Interpolated display color between base and hit color. */
  get displayColor(): number {
    if (this.colorBlend < 0.01) return this.color;
    const t = this.colorBlend;
    const r = lerpChannel(this.color >> 16, this.hitColor >> 16, t);
    const g = lerpChannel((this.color >> 8) & 0xff, (this.hitColor >> 8) & 0xff, t);
    const b = lerpChannel(this.color & 0xff, this.hitColor & 0xff, t);
    return (r << 16) | (g << 8) | b;
  }

  reset(): void {
    this.x = this.homeX;
    this.y = this.homeY;
    this.vx = 0;
    this.vy = 0;
    this.colorBlend = 0;
    this.frozen = false;
    this.alpha = 1;
  }
}

function lerpChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}
