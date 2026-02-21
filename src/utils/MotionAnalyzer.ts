import type { SegmentationMask } from '../types/index.js';

export class MotionAnalyzer {
  private prevData: Uint8Array | null = null;

  /** Returns motion intensity in [0, 1] comparing current mask to previous. */
  analyze(mask: SegmentationMask): number {
    if (!this.prevData || this.prevData.length !== mask.data.length) {
      this.prevData = mask.data.slice();
      return 0;
    }

    let changed = 0;
    const total = mask.data.length;
    for (let i = 0; i < total; i++) {
      if (Math.abs(mask.data[i] - this.prevData[i]) > 0) changed++;
    }

    this.prevData = mask.data.slice();

    return Math.min(1, (changed / total) * 8); // scale factor so subtle movement reads clearly
  }
}
