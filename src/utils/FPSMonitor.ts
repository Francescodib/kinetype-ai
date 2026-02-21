export class FPSMonitor {
  private readonly samples: number[];
  private readonly sampleCount: number;
  private index = 0;
  private lastTime = 0;
  private _fps = 60;

  // LOD state
  private lowFpsStart = 0;
  private highFpsStart = 0;
  private readonly lowThreshold = 15;   // only reduce below 15fps
  private readonly highThreshold = 50;
  private readonly lowDuration = 5000;  // must sustain low FPS for 5s before reducing
  private readonly highDuration = 8000; // ms before restoring particles

  constructor(sampleCount = 60) {
    this.sampleCount = sampleCount;
    this.samples = new Array<number>(sampleCount).fill(60);
  }

  /** Call once per frame with the current timestamp (from rAF or Pixi ticker). */
  tick(now: number): void {
    if (this.lastTime === 0) {
      this.lastTime = now;
      return;
    }
    const dt = now - this.lastTime;
    this.lastTime = now;
    if (dt <= 0) return;
    this.samples[this.index % this.sampleCount] = 1000 / dt;
    this.index++;
    let sum = 0;
    for (const s of this.samples) sum += s;
    this._fps = sum / this.sampleCount;
  }

  get fps(): number {
    return this._fps;
  }

  /**
   * Returns a LOD action based on sustained FPS readings.
   * 'reduce'  → FPS has been low for >2s
   * 'restore' → FPS has been high for >5s
   * null      → no action needed
   */
  lodAction(now: number): 'reduce' | 'restore' | null {
    if (this._fps < this.lowThreshold) {
      if (this.lowFpsStart === 0) this.lowFpsStart = now;
      this.highFpsStart = 0;
      if (now - this.lowFpsStart > this.lowDuration) {
        this.lowFpsStart = now; // reset so it doesn't fire every frame
        return 'reduce';
      }
    } else if (this._fps > this.highThreshold) {
      if (this.highFpsStart === 0) this.highFpsStart = now;
      this.lowFpsStart = 0;
      if (now - this.highFpsStart > this.highDuration) {
        this.highFpsStart = now;
        return 'restore';
      }
    } else {
      this.lowFpsStart = 0;
      this.highFpsStart = 0;
    }
    return null;
  }
}
