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

  /** Blend factor toward hitColor (0 = base color, 1 = hit color). */
  private colorBlend = 0;

  update(dt: number, forceX: number, forceY: number, friction: number, ease: number): void {
    // Normalize to 60fps so spring/friction behave consistently at any frame rate.
    // Clamp to 3× to prevent explosion at very low FPS (< 20fps).
    const dtN = Math.min(dt * 60, 3);

    // Apply external force (intentionally not dt-scaled: force is a per-frame impulse)
    this.vx += forceX;
    this.vy += forceY;

    // Spring toward home (dt-normalized so convergence rate is FPS-independent)
    const dx = this.homeX - this.x;
    const dy = this.homeY - this.y;
    this.vx += dx * ease * dtN;
    this.vy += dy * ease * dtN;

    // Friction (dt-normalized so damping is FPS-independent)
    const fric = Math.pow(friction, dtN);
    this.vx *= fric;
    this.vy *= fric;

    // Euler integration
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Color blend proportional to force magnitude, decays per frame
    const forceMag = Math.sqrt(forceX * forceX + forceY * forceY);
    this.colorBlend = Math.min(1, this.colorBlend + forceMag * 0.12);
    this.colorBlend *= Math.pow(0.92, dtN);
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
    this.alpha = 1;
  }
}

function lerpChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}
