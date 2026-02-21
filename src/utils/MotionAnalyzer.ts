import type { SegmentationMask } from '../types/index.js';

export interface MotionResult {
  motionIntensity: number; // 0–1
  deltaPixels: number;     // raw count of changed pixels
}

export class MotionAnalyzer {
  private prevData: Uint8Array | null = null;

  /**
   * Compare current mask to previous frame.
   * Slow movement → low intensity; fast/large movement → up to 1.0.
   */
  analyze(mask: SegmentationMask): MotionResult {
    if (!this.prevData || this.prevData.length !== mask.data.length) {
      this.prevData = mask.data.slice();
      return { motionIntensity: 0, deltaPixels: 0 };
    }

    let changed = 0;
    const total = mask.data.length;
    for (let i = 0; i < total; i++) {
      if (mask.data[i] !== this.prevData[i]) changed++;
    }

    this.prevData = mask.data.slice();

    // ~12.5% pixel change = full intensity (scale factor 8)
    const motionIntensity = Math.min(1, (changed / total) * 8);
    return { motionIntensity, deltaPixels: changed };
  }

  reset(): void {
    this.prevData = null;
  }
}
