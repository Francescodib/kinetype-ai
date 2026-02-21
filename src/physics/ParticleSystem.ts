import { Particle } from './Particle.js';
import { TextSampler } from './TextSampler.js';
import type { SamplePoint } from './TextSampler.js';
import type { Vec2, SimConfig, ForcePoint } from '../types/index.js';

export class ParticleSystem {
  private particles: Particle[] = [];
  private targetCount: number;
  private readonly maxParticles: number;
  private readonly sampler = new TextSampler();
  private homePositions: SamplePoint[] = [];

  config: SimConfig;

  private mousePos: Vec2 | null = null;
  private readonly mouseRadius = 120;
  private forcePoints: ForcePoint[] = [];

  /** Average particle speed (px/s) from the last updateAll call — used for stats. */
  private _avgSpeed = 0;

  constructor(config: SimConfig) {
    this.config = config;
    this.maxParticles = config.particleCount;
    this.targetCount = config.particleCount;
  }

  init(text: string, canvasWidth: number, canvasHeight: number): void {
    this.homePositions = this.sampler.sample({
      text,
      canvasWidth,
      canvasHeight,
      maxParticles: this.maxParticles,
    });
    this._rebuildParticles(this.homePositions);
  }

  transitionTo(text: string, canvasWidth: number, canvasHeight: number): void {
    const newHomes = this.sampler.sample({
      text,
      canvasWidth,
      canvasHeight,
      maxParticles: this.maxParticles,
    });
    this.homePositions = newHomes;

    const count = Math.min(this.particles.length, newHomes.length);
    for (let i = 0; i < count; i++) {
      this.particles[i].homeX = newHomes[i].homeX;
      this.particles[i].homeY = newHomes[i].homeY;
    }

    for (let i = count; i < newHomes.length && i < this.targetCount; i++) {
      const p = new Particle();
      const src = this.particles[Math.floor(Math.random() * this.particles.length)];
      p.x = src ? src.x : Math.random() * canvasWidth;
      p.y = src ? src.y : Math.random() * canvasHeight;
      p.homeX = newHomes[i].homeX;
      p.homeY = newHomes[i].homeY;
      this.particles.push(p);
    }

    if (this.particles.length > newHomes.length) {
      this.particles.length = newHomes.length;
    }
  }

  private _rebuildParticles(homes: SamplePoint[]): void {
    const count = Math.min(homes.length, this.targetCount);
    this.particles = [];
    for (let i = 0; i < count; i++) {
      const p = new Particle();
      p.homeX = homes[i].homeX;
      p.homeY = homes[i].homeY;
      p.x = homes[i].homeX + (Math.random() - 0.5) * 80;
      p.y = homes[i].homeY + (Math.random() - 0.5) * 80;
      this.particles.push(p);
    }
  }

  setMousePos(pos: Vec2 | null): void {
    this.mousePos = pos;
  }

  /** Replace the current hand-landmark-derived force points (updated each frame). */
  setForcePoints(points: ForcePoint[]): void {
    this.forcePoints = points;
  }

  reduceLOD(): void {
    this.targetCount = Math.max(3000, Math.floor(this.targetCount * 0.9));
    if (this.particles.length > this.targetCount) {
      this.particles.length = this.targetCount;
    }
  }

  restoreLOD(canvasWidth: number, canvasHeight: number): void {
    if (this.targetCount >= this.maxParticles) return;
    this.targetCount = Math.min(this.maxParticles, Math.floor(this.targetCount * 1.33));
    const homes = this.homePositions.slice(this.particles.length, this.targetCount);
    for (const home of homes) {
      const p = new Particle();
      p.homeX = home.homeX;
      p.homeY = home.homeY;
      p.x = home.homeX + (Math.random() - 0.5) * 60;
      p.y = home.homeY + (Math.random() - 0.5) * 60;
      this.particles.push(p);
    }
    void canvasWidth;
    void canvasHeight;
  }

  updateAll(dt: number, canvasWidth: number, canvasHeight: number): void {
    void canvasWidth;
    void canvasHeight;

    const { friction, ease, repulsionForce, mode } = this.config;
    const dtCapped = Math.min(dt, 0.05);

    let speedSum = 0;

    for (const p of this.particles) {
      let fx = 0;
      let fy = 0;

      // ── Hand landmark force points ────────────────────────────────────────
      for (const fp of this.forcePoints) {
        const dx = p.x - fp.x;
        const dy = p.y - fp.y;
        const dist2 = dx * dx + dy * dy;
        const r2 = fp.radius * fp.radius;

        if (dist2 < r2 && dist2 > 0.1) {
          const dist = Math.sqrt(dist2);
          const falloff = 1 - dist / fp.radius;
          const scale = fp.strength * falloff;

          switch (mode) {
            case 'repulse': {
              fx += (dx / dist) * scale;
              fy += (dy / dist) * scale;
              break;
            }
            case 'attract': {
              fx -= (dx / dist) * scale * 0.7;
              fy -= (dy / dist) * scale * 0.7;
              break;
            }
            case 'vortex': {
              fx += (-dy / dist) * scale;
              fy += (dx / dist) * scale;
              break;
            }
          }
        }
      }

      // ── Mouse / touch fallback ────────────────────────────────────────────
      if (this.mousePos) {
        const mdx = p.x - this.mousePos.x;
        const mdy = p.y - this.mousePos.y;
        const mdist2 = mdx * mdx + mdy * mdy;
        const mr2 = this.mouseRadius * this.mouseRadius;
        if (mdist2 < mr2 && mdist2 > 0) {
          const mdist = Math.sqrt(mdist2);
          const strength = (1 - mdist / this.mouseRadius) * repulsionForce * 3;
          fx += (mdx / mdist) * strength;
          fy += (mdy / mdist) * strength;
        }
      }

      p.update(dtCapped, fx, fy, friction, ease);
      speedSum += Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    }

    this._avgSpeed = this.particles.length > 0 ? speedSum / this.particles.length : 0;
  }

  get activeParticles(): Particle[] {
    return this.particles;
  }

  get count(): number {
    return this.particles.length;
  }

  /** Average particle speed in canvas px/s from the last update. */
  get avgSpeed(): number {
    return this._avgSpeed;
  }
}
