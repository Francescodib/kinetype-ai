import {
  Application,
  ParticleContainer,
  Particle as PixiParticle,
  Sprite,
  Texture,
  Graphics,
  BlurFilter,
  Container,
} from 'pixi.js';
import { FPSMonitor } from '../utils/FPSMonitor.js';
import type { Particle } from '../physics/Particle.js';
import type { ParticleSystem } from '../physics/ParticleSystem.js';

/** Pre-converted canvas-space data for one hand. */
export interface HandDrawData {
  /** Canvas-space positions of all 21 landmarks. */
  landmarks: Array<{ x: number; y: number }>;
  connections: [number, number][];
  fingertipIndices: readonly number[];
}

export interface RendererOptions {
  particleSystem: ParticleSystem;
  onUpdate: (dt: number, now: number) => void;
  onLodReduce: () => void;
  onLodRestore: () => void;
}

export class Renderer {
  private app!: Application;
  // ParticleContainer uses the lightweight Pixi Particle class (not Sprite)
  private particleContainer!: ParticleContainer;
  private pixiParticles: PixiParticle[] = [];
  // Glow layer uses a regular Container + Sprite (supports addChild)
  private glowContainer!: Container;
  private glowSprites: Sprite[] = [];
  private circleTexture!: Texture;
  private readonly fpsMonitor = new FPSMonitor(60);
  private readonly opts: RendererOptions;
  private handGraphics!: Graphics;
  /** Timestamp of first tick — LOD is suppressed for the first 12s (model warmup). */
  private startTime = 0;

  constructor(opts: RendererOptions) {
    this.opts = opts;
  }

  async init(): Promise<void> {
    this.app = new Application();
    await this.app.init({
      backgroundAlpha: 0,        // transparent so webcam video shows through
      resizeTo: window,
      antialias: false,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    document.body.appendChild(this.app.canvas as HTMLCanvasElement);
    (this.app.canvas as HTMLCanvasElement).style.cssText =
      'position:fixed;top:0;left:0;width:100%;height:100%;z-index:2;background:transparent;';

    this.circleTexture = this._makeCircleTexture(2);

    // Glow layer: blurred Container with Sprites, drawn under main particles
    this.glowContainer = new Container();
    const blur = new BlurFilter({ strength: 8, quality: 2 });
    this.glowContainer.filters = [blur];
    this.glowContainer.alpha = 0.25;
    this.app.stage.addChild(this.glowContainer);

    // Main ParticleContainer: uses Pixi Particle objects, color updates every frame
    this.particleContainer = new ParticleContainer({
      texture: this.circleTexture,
      dynamicProperties: {
        position: true,
        color: true,    // needed to update tint each frame
        rotation: false,
        uvs: false,
        vertex: false,
      },
    });
    this.app.stage.addChild(this.particleContainer);

    // Hand skeleton overlay — drawn on top of everything
    this.handGraphics = new Graphics();
    this.app.stage.addChild(this.handGraphics);

    this._syncParticles();
    this.app.ticker.add(this._tick.bind(this));
  }

  private _makeCircleTexture(radius: number): Texture {
    const g = new Graphics();
    g.circle(radius, radius, radius);
    g.fill({ color: 0xffffff });
    return this.app.renderer.generateTexture(g);
  }

  private _syncParticles(): void {
    const particles = this.opts.particleSystem.activeParticles;
    const needed = particles.length;

    // Grow
    while (this.pixiParticles.length < needed) {
      const pp = new PixiParticle({
        texture: this.circleTexture,
        anchorX: 0.5,
        anchorY: 0.5,
      });
      this.particleContainer.addParticle(pp);
      this.pixiParticles.push(pp);

      const gs = new Sprite(this.circleTexture);
      gs.anchor.set(0.5);
      this.glowContainer.addChild(gs);
      this.glowSprites.push(gs);
    }

    // Shrink
    while (this.pixiParticles.length > needed) {
      this.particleContainer.removeParticle(this.pixiParticles.pop()!);
      this.glowContainer.removeChild(this.glowSprites.pop()!);
    }
  }

  get fps(): number {
    return Math.round(this.fpsMonitor.fps);
  }

  get canvasWidth(): number {
    return this.app.screen.width;
  }

  get canvasHeight(): number {
    return this.app.screen.height;
  }

  private _tick(ticker: { deltaMS: number }): void {
    const now = performance.now();
    if (this.startTime === 0) this.startTime = now;
    this.fpsMonitor.tick(now);

    const dtSec = ticker.deltaMS / 1000;
    this.opts.onUpdate(dtSec, now);

    // Suppress LOD adjustments for the first 12s to let WASM models warm up.
    if (now - this.startTime > 12000) {
      const action = this.fpsMonitor.lodAction(now);
      if (action === 'reduce') this.opts.onLodReduce();
      else if (action === 'restore') this.opts.onLodRestore();
    }

    this._syncParticles();
    this._drawParticles(this.opts.particleSystem.activeParticles);
  }

  private _drawParticles(particles: Particle[]): void {
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const color = p.displayColor;

      const pp = this.pixiParticles[i];
      pp.x = p.x;
      pp.y = p.y;
      pp.tint = color;

      const gs = this.glowSprites[i];
      gs.x = p.x;
      gs.y = p.y;
      gs.tint = color;
    }
  }

  /**
   * Draw hand skeletons over the particle layer.
   * Call this each frame from onUpdate with canvas-space landmark data.
   */
  renderHands(hands: HandDrawData[]): void {
    const g = this.handGraphics;
    g.clear();

    for (const hand of hands) {
      const lms = hand.landmarks;

      // Skeleton lines
      for (const [a, b] of hand.connections) {
        const la = lms[a];
        const lb = lms[b];
        if (!la || !lb) continue;
        g.moveTo(la.x, la.y).lineTo(lb.x, lb.y);
      }
      g.stroke({ color: 0x39ff14, width: 2, alpha: 0.85 });

      // Regular joints (white dots)
      for (let i = 0; i < lms.length; i++) {
        if ((hand.fingertipIndices as readonly number[]).includes(i)) continue;
        g.circle(lms[i].x, lms[i].y, 4);
      }
      g.fill({ color: 0xffffff, alpha: 0.75 });

      // Fingertip dots (larger, accent color)
      for (const ti of hand.fingertipIndices) {
        g.circle(lms[ti].x, lms[ti].y, 8);
      }
      g.fill({ color: 0xff4455, alpha: 1.0 });
    }
  }

  destroy(): void {
    this.app.destroy(true);
  }
}
