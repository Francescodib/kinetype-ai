import { Particle } from './Particle.js';
import { TextSampler } from './TextSampler.js';
import type { SamplePoint } from './TextSampler.js';
import type { Vec2, SegmentationMask, SimConfig } from '../types/index.js';

/** Canvas-space AABB of the last known silhouette. */
interface SilhouetteBBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private targetCount: number;
  private readonly maxParticles: number;
  private readonly sampler = new TextSampler();
  private homePositions: SamplePoint[] = [];
  private lastBBox: SilhouetteBBox | null = null;

  config: SimConfig;

  private mousePos: Vec2 | null = null;
  private readonly mouseRadius = 80;

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
      this.particles[i].frozen = false;
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
      p.x = homes[i].homeX + (Math.random() - 0.5) * 400;
      p.y = homes[i].homeY + (Math.random() - 0.5) * 400;
      this.particles.push(p);
    }
  }

  setMousePos(pos: Vec2 | null): void {
    this.mousePos = pos;
  }

  reduceLOD(): void {
    this.targetCount = Math.max(500, Math.floor(this.targetCount * 0.75));
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
      p.x = home.homeX + (Math.random() - 0.5) * 200;
      p.y = home.homeY + (Math.random() - 0.5) * 200;
      this.particles.push(p);
    }
    void canvasWidth;
    void canvasHeight;
  }

  /**
   * Update all particles for one frame.
   * @param dt               Delta-time in seconds (from Pixi ticker)
   * @param mask             Latest segmentation mask (null = no camera)
   * @param motionIntensity  0–1 from MotionAnalyzer
   * @param canvasWidth      Pixi canvas width in CSS pixels
   * @param canvasHeight     Pixi canvas height in CSS pixels
   */
  updateAll(
    dt: number,
    mask: SegmentationMask | null,
    motionIntensity: number,
    canvasWidth: number,
    canvasHeight: number
  ): void {
    const { friction, ease, repulsionForce, mode } = this.config;
    const dtCapped = Math.min(dt, 0.05);

    // Recompute silhouette bounding box once per frame
    if (mask) {
      this.lastBBox = this._computeBBox(mask, canvasWidth, canvasHeight);
    }

    // Body center from bbox (used by repulse/attract/vortex)
    const bodyX = this.lastBBox
      ? (this.lastBBox.minX + this.lastBBox.maxX) / 2
      : canvasWidth / 2;
    const bodyY = this.lastBBox
      ? (this.lastBBox.minY + this.lastBBox.maxY) / 2
      : canvasHeight / 2;

    for (const p of this.particles) {
      let fx = 0;
      let fy = 0;

      // ── Mouse repulsion ─────────────────────────────────────────────────
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

      // ── Body segmentation interaction ────────────────────────────────────
      if (mask && motionIntensity > 0.01) {
        // Bounding-box early rejection: 40px margin around silhouette
        const inBBox =
          !this.lastBBox ||
          (p.x >= this.lastBBox.minX - 40 &&
            p.x <= this.lastBBox.maxX + 40 &&
            p.y >= this.lastBBox.minY - 40 &&
            p.y <= this.lastBBox.maxY + 40);

        if (inBBox) {
          // Scale canvas coords → mask coords
          const mx = Math.floor((p.x / canvasWidth) * mask.width);
          const my = Math.floor((p.y / canvasHeight) * mask.height);

          if (mx >= 0 && mx < mask.width && my >= 0 && my < mask.height) {
            const isPerson = mask.data[my * mask.width + mx] > 0;

            if (isPerson) {
              const scale = repulsionForce * motionIntensity;
              // Radial direction from body center to particle
              const dx = p.x - bodyX;
              const dy = p.y - bodyY;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;

              switch (mode) {
                case 'repulse': {
                  fx += (dx / dist) * scale;
                  fy += (dy / dist) * scale;
                  break;
                }
                case 'attract': {
                  // Pull inward toward body center
                  fx -= (dx / dist) * scale * 0.6;
                  fy -= (dy / dist) * scale * 0.6;
                  break;
                }
                case 'vortex': {
                  // Tangential (perpendicular) → orbital motion
                  fx += (-dy / dist) * scale;
                  fy += (dx / dist) * scale;
                  break;
                }
                case 'freeze': {
                  p.vx *= 0.75;
                  p.vy *= 0.75;
                  p.frozen = true;
                  break;
                }
              }
            } else {
              // Particle outside body → unfreeze
              if (p.frozen) p.frozen = false;
            }
          }
        }
      } else {
        // No mask / zero motion → thaw
        if (p.frozen) p.frozen = false;
      }

      p.update(dtCapped, fx, fy, friction, ease);
    }
  }

  /** Compute silhouette AABB in canvas-space, scanning the full mask. */
  private _computeBBox(
    mask: SegmentationMask,
    canvasWidth: number,
    canvasHeight: number
  ): SilhouetteBBox | null {
    let minMX = mask.width;
    let maxMX = 0;
    let minMY = mask.height;
    let maxMY = 0;
    let found = false;

    for (let my = 0; my < mask.height; my++) {
      for (let mx = 0; mx < mask.width; mx++) {
        if (mask.data[my * mask.width + mx] > 0) {
          if (mx < minMX) minMX = mx;
          if (mx > maxMX) maxMX = mx;
          if (my < minMY) minMY = my;
          if (my > maxMY) maxMY = my;
          found = true;
        }
      }
    }

    if (!found) return null;

    const scaleX = canvasWidth / mask.width;
    const scaleY = canvasHeight / mask.height;
    return {
      minX: minMX * scaleX,
      maxX: maxMX * scaleX,
      minY: minMY * scaleY,
      maxY: maxMY * scaleY,
    };
  }

  get activeParticles(): Particle[] {
    return this.particles;
  }

  get count(): number {
    return this.particles.length;
  }

  get silhouetteBBox(): SilhouetteBBox | null {
    return this.lastBBox;
  }
}
