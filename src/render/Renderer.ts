import {
  Application,
  ParticleContainer,
  Sprite,
  Texture,
  Graphics,
  BlurFilter,
  Container,
} from 'pixi.js';
import { FPSMonitor } from '../utils/FPSMonitor.js';
import type { Particle } from '../physics/Particle.js';
import type { ParticleSystem } from '../physics/ParticleSystem.js';
import type { SegmentationMask } from '../types/index.js';

export interface RendererOptions {
  particleSystem: ParticleSystem;
  onUpdate: (dt: number, mask: SegmentationMask | null, now: number) => void;
  onLodReduce: () => void;
  onLodRestore: () => void;
}

export class Renderer {
  private app!: Application;
  private particleContainer!: ParticleContainer;
  private glowContainer!: Container;
  private sprites: Sprite[] = [];
  private glowSprites: Sprite[] = [];
  private circleTexture!: Texture;
  private readonly fpsMonitor = new FPSMonitor(60);
  private readonly opts: RendererOptions;
  private mask: SegmentationMask | null = null;

  constructor(opts: RendererOptions) {
    this.opts = opts;
  }

  async init(): Promise<void> {
    this.app = new Application();
    await this.app.init({
      background: 0x0a0a0f,
      resizeTo: window,
      antialias: false,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    document.body.appendChild(this.app.canvas as HTMLCanvasElement);
    (this.app.canvas as HTMLCanvasElement).style.cssText =
      'position:fixed;top:0;left:0;width:100%;height:100%;z-index:2;';

    this.circleTexture = this._makeCircleTexture(3);

    // Glow layer (blurred copy, drawn under)
    this.glowContainer = new Container();
    const blur = new BlurFilter({ strength: 8, quality: 2 });
    this.glowContainer.filters = [blur];
    this.glowContainer.alpha = 0.25;
    this.app.stage.addChild(this.glowContainer);

    // Main particle container
    this.particleContainer = new ParticleContainer({
      dynamicProperties: {
        position: true,
        tint: true,
        alpha: false,
        scale: false,
      },
    });
    this.app.stage.addChild(this.particleContainer);

    this._syncSprites();
    this.app.ticker.add(this._tick.bind(this));
  }

  private _makeCircleTexture(radius: number): Texture {
    const g = new Graphics();
    g.circle(radius, radius, radius);
    g.fill({ color: 0xffffff });
    return this.app.renderer.generateTexture(g);
  }

  private _syncSprites(): void {
    const particles = this.opts.particleSystem.activeParticles;
    const needed = particles.length;

    // Grow
    while (this.sprites.length < needed) {
      const s = new Sprite(this.circleTexture);
      s.anchor.set(0.5);
      this.particleContainer.addChild(s);
      this.sprites.push(s);

      const gs = new Sprite(this.circleTexture);
      gs.anchor.set(0.5);
      this.glowContainer.addChild(gs);
      this.glowSprites.push(gs);
    }

    // Shrink
    while (this.sprites.length > needed) {
      this.particleContainer.removeChild(this.sprites.pop()!);
      this.glowContainer.removeChild(this.glowSprites.pop()!);
    }
  }

  setMask(mask: SegmentationMask | null): void {
    this.mask = mask;
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

  private _tick(ticker: { deltaMS: number; lastTime: number }): void {
    const now = performance.now();
    this.fpsMonitor.tick(now);

    const dtSec = ticker.deltaMS / 1000;
    this.opts.onUpdate(dtSec, this.mask, now);

    // LOD check
    const action = this.fpsMonitor.lodAction(now);
    if (action === 'reduce') this.opts.onLodReduce();
    else if (action === 'restore') this.opts.onLodRestore();

    this._syncSprites();
    this._drawParticles(this.opts.particleSystem.activeParticles);
  }

  private _drawParticles(particles: Particle[]): void {
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const color = p.displayColor;

      const s = this.sprites[i];
      s.x = p.x;
      s.y = p.y;
      s.tint = color;

      const gs = this.glowSprites[i];
      gs.x = p.x;
      gs.y = p.y;
      gs.tint = color;
    }
  }

  destroy(): void {
    this.app.destroy(true);
  }
}
