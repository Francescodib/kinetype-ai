import { TextSampler } from './TextSampler.js';
import type { SamplePoint } from './TextSampler.js';

export type CycleCallback = (phrase: string, homes: SamplePoint[]) => void;

export interface TextCyclerOptions {
  phrases: string[];
  intervalMs?: number; // default 8000
  canvasWidth: number;
  canvasHeight: number;
  maxParticles: number;
}

export class TextCycler {
  private readonly sampler = new TextSampler();
  private readonly phrases: string[];
  private readonly intervalMs: number;
  private idx = 0;
  private lastCycleTime = 0;
  private cycleCallbacks: CycleCallback[] = [];
  private canvasWidth: number;
  private canvasHeight: number;
  private readonly maxParticles: number;

  constructor(opts: TextCyclerOptions) {
    this.phrases = opts.phrases;
    this.intervalMs = opts.intervalMs ?? 8000;
    this.canvasWidth = opts.canvasWidth;
    this.canvasHeight = opts.canvasHeight;
    this.maxParticles = opts.maxParticles;
    this.lastCycleTime = performance.now();
  }

  /** Register a callback invoked whenever the phrase changes. */
  onCycleStart(cb: CycleCallback): void {
    this.cycleCallbacks.push(cb);
  }

  /** Returns the currently displayed phrase. */
  currentPhrase(): string {
    return this.phrases[this.idx];
  }

  /** Advance to the next phrase immediately and invoke callbacks. */
  next(): void {
    this.idx = (this.idx + 1) % this.phrases.length;
    this.lastCycleTime = performance.now();
    this._emit();
  }

  /**
   * Call once per frame with the current timestamp.
   * Fires next() automatically when the interval elapses.
   */
  tick(now: number): void {
    if (now - this.lastCycleTime >= this.intervalMs) {
      this.next();
    }
  }

  /** Update canvas dimensions (call after resize). */
  resize(canvasWidth: number, canvasHeight: number): void {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
  }

  /** Sample home positions for the current phrase. */
  sampleCurrent(): SamplePoint[] {
    return this.sampler.sample({
      text: this.currentPhrase(),
      canvasWidth: this.canvasWidth,
      canvasHeight: this.canvasHeight,
      maxParticles: this.maxParticles,
    });
  }

  private _emit(): void {
    const homes = this.sampleCurrent();
    const phrase = this.currentPhrase();
    for (const cb of this.cycleCallbacks) {
      cb(phrase, homes);
    }
  }
}
