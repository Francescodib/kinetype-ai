import { Particle } from './Particle.js';
import { TextSampler } from './TextSampler.js';
import type { SamplePoint } from './TextSampler.js';
import type { Vec2, SegmentationMask, SimConfig } from '../types/index.js';

export class ParticleSystem {
  private particles: Particle[] = [];
  private targetCount: number;
  private readonly maxParticles: number;
  private readonly sampler = new TextSampler();
  private homePositions: SamplePoint[] = [];

  // Config
  config: SimConfig;

  // Mouse interaction
  private mousePos: Vec2 | null = null;
  private readonly mouseRadius = 80;

  constructor(config: SimConfig) {
    this.config = config;
    this.maxParticles = config.particleCount;
    this.targetCount = config.particleCount;
  }

  /** Sample text and (re)initialize all particles at home positions. */
  init(text: string, canvasWidth: number, canvasHeight: number): void {
    this.homePositions = this.sampler.sample({
      text,
      canvasWidth,
      canvasHeight,
      maxParticles: this.maxParticles,
    });

    this._rebuildParticles(this.homePositions);
  }

  /** Transition particles to new text home positions (smooth morph). */
  transitionTo(text: string, canvasWidth: number, canvasHeight: number): void {
    const newHomes = this.sampler.sample({
      text,
      canvasWidth,
      canvasHeight,
      maxParticles: this.maxParticles,
    });

    this.homePositions = newHomes;

    // Remap existing particles to new homes
    const count = Math.min(this.particles.length, newHomes.length);
    for (let i = 0; i < count; i++) {
      this.particles[i].homeX = newHomes[i].homeX;
      this.particles[i].homeY = newHomes[i].homeY;
    }

    // If new word needs more particles, add them
    for (let i = count; i < newHomes.length && i < this.targetCount; i++) {
      const p = new Particle();
      // Scatter from random existing position before settling
      const src = this.particles[Math.floor(Math.random() * this.particles.length)];
      p.x = src ? src.x : Math.random() * canvasWidth;
      p.y = src ? src.y : Math.random() * canvasHeight;
      p.homeX = newHomes[i].homeX;
      p.homeY = newHomes[i].homeY;
      this.particles.push(p);
    }

    // Trim excess
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
      // Start scattered randomly for entrance animation
      p.x = homes[i].homeX + (Math.random() - 0.5) * 400;
      p.y = homes[i].homeY + (Math.random() - 0.5) * 400;
      this.particles.push(p);
    }
  }

  setMousePos(pos: Vec2 | null): void {
    this.mousePos = pos;
  }

  /** Reduce active particle count by 25% for dynamic LOD. */
  reduceLOD(): void {
    this.targetCount = Math.max(500, Math.floor(this.targetCount * 0.75));
    if (this.particles.length > this.targetCount) {
      this.particles.length = this.targetCount;
    }
  }

  /** Restore particle count toward max for dynamic LOD. */
  restoreLOD(canvasWidth: number, canvasHeight: number): void {
    if (this.targetCount >= this.maxParticles) return;
    this.targetCount = Math.min(this.maxParticles, Math.floor(this.targetCount * 1.33));

    // Re-init to get proper homes for the restored count
    const newHomes = this.sampler.sample({
      text: '', // will use cached home positions
      canvasWidth,
      canvasHeight,
      maxParticles: this.targetCount,
    });

    // Add new particles from existing home positions
    const homes = this.homePositions.slice(this.particles.length, this.targetCount);
    for (const home of homes) {
      const p = new Particle();
      p.homeX = home.homeX;
      p.homeY = home.homeY;
      p.x = home.homeX + (Math.random() - 0.5) * 200;
      p.y = home.homeY + (Math.random() - 0.5) * 200;
      this.particles.push(p);
    }

    void newHomes; // only used for length reference above
  }

  /**
   * Update all particles.
   * @param dt  Delta time in seconds (from Pixi ticker)
   * @param mask  Latest segmentation mask (may be null)
   * @param maskMotionScale  0–1 scale from MotionAnalyzer (1 = full force)
   */
  updateAll(
    dt: number,
    mask: SegmentationMask | null,
    maskMotionScale: number,
    canvasWidth: number,
    canvasHeight: number
  ): void {
    const { friction, ease, repulsionForce, mode } = this.config;
    const dtCapped = Math.min(dt, 0.05); // cap at 50ms to avoid tunneling

    for (const p of this.particles) {
      let fx = 0;
      let fy = 0;

      // Mouse interaction (always active for testing)
      if (this.mousePos) {
        const mdx = p.x - this.mousePos.x;
        const mdy = p.y - this.mousePos.y;
        const mdist2 = mdx * mdx + mdy * mdy;
        const mr2 = this.mouseRadius * this.mouseRadius;
        if (mdist2 < mr2 && mdist2 > 0) {
          const mdist = Math.sqrt(mdist2);
          const strength = (1 - mdist / this.mouseRadius) * repulsionForce * 2;
          fx += (mdx / mdist) * strength;
          fy += (mdy / mdist) * strength;
        }
      }

      // Mask-based interaction
      if (mask && maskMotionScale > 0.02) {
        const mx = Math.floor((p.x / canvasWidth) * mask.width);
        const my = Math.floor((p.y / canvasHeight) * mask.height);

        if (mx >= 0 && mx < mask.width && my >= 0 && my < mask.height) {
          const maskVal = mask.data[my * mask.width + mx];
          const isPerson = maskVal > 0;

          if (isPerson) {
            const scale = repulsionForce * maskMotionScale;
            const dx = p.x - canvasWidth / 2;
            const dy = p.y - canvasHeight / 2;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;

            switch (mode) {
              case 'repulse': {
                fx += (dx / dist) * scale;
                fy += (dy / dist) * scale;
                break;
              }
              case 'attract': {
                fx -= (dx / dist) * scale * 0.5;
                fy -= (dy / dist) * scale * 0.5;
                break;
              }
              case 'vortex': {
                // Tangential (perpendicular) force
                fx += (-dy / dist) * scale;
                fy += (dx / dist) * scale;
                break;
              }
              case 'freeze': {
                // Damp velocity to stop the particle
                p.vx *= 0.85;
                p.vy *= 0.85;
                break;
              }
            }
          }
        }
      }

      p.update(dtCapped, fx, fy, friction, ease);
    }
  }

  get activeParticles(): Particle[] {
    return this.particles;
  }

  get count(): number {
    return this.particles.length;
  }
}
