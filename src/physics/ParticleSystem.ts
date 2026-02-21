import { Particle } from './Particle.js';
import { TextSampler } from './TextSampler.js';
import type { SamplePoint } from './TextSampler.js';
import type { Vec2, SimConfig, ForcePoint } from '../types/index.js';

export class ParticleSystem {
  private particles: Particle[] = [];
  private targetCount: number;
  private maxParticles: number;
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

  /** Update the configured maximum and re-initialise particles for the current phrase. */
  setParticleCount(count: number): void {
    this.maxParticles = count;
    this.targetCount = count;
    this._rebuildParticles(this.homePositions);
  }

  reduceLOD(): void {
    const floor = Math.max(Math.floor(this.maxParticles * 0.3), 500);
    this.targetCount = Math.max(floor, Math.floor(this.targetCount * 0.9));
    // Redistribute across all home positions (evenly subsampled) rather than
    // truncating from the end — homePositions is edges-first so lower counts
    // naturally favour outlines over interior fill.
    const newHomes = this._subsampleHomes(this.homePositions, this.targetCount);
    const keep = Math.min(this.particles.length, newHomes.length);
    for (let i = 0; i < keep; i++) {
      this.particles[i].homeX = newHomes[i].homeX;
      this.particles[i].homeY = newHomes[i].homeY;
    }
    this.particles.length = keep;
  }

  restoreLOD(canvasWidth: number, canvasHeight: number): void {
    if (this.targetCount >= this.maxParticles) return;
    this.targetCount = Math.min(this.maxParticles, Math.floor(this.targetCount * 1.33));
    const newHomes = this._subsampleHomes(this.homePositions, this.targetCount);
    // Update home positions of existing particles.
    for (let i = 0; i < Math.min(this.particles.length, newHomes.length); i++) {
      this.particles[i].homeX = newHomes[i].homeX;
      this.particles[i].homeY = newHomes[i].homeY;
    }
    // Spawn additional particles for the expanded count.
    for (let i = this.particles.length; i < newHomes.length; i++) {
      const p = new Particle();
      p.homeX = newHomes[i].homeX;
      p.homeY = newHomes[i].homeY;
      p.x = newHomes[i].homeX + (Math.random() - 0.5) * 60;
      p.y = newHomes[i].homeY + (Math.random() - 0.5) * 60;
      this.particles.push(p);
    }
    void canvasWidth;
    void canvasHeight;
  }

  private _subsampleHomes(homes: SamplePoint[], count: number): SamplePoint[] {
    if (homes.length <= count) return homes;
    const step = homes.length / count;
    const result: SamplePoint[] = [];
    for (let i = 0; i < count; i++) result.push(homes[Math.floor(i * step)]);
    return result;
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
