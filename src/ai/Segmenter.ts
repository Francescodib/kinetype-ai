import {
  ImageSegmenter,
  FilesetResolver,
} from '@mediapipe/tasks-vision';
import type { SegmentationMask } from '../types/index.js';

type WasmFileset = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';

export const VISION_WASM_PATH =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm';

export class Segmenter {
  private segmenter: ImageSegmenter | null = null;
  private _lastMask: SegmentationMask | null = null;
  private _isRunning = false;
  private _fps = 0;
  private _frameCount = 0;
  private _lastFpsTime = 0;
  private _lastInferenceTime = 0;
  private readonly minIntervalMs = 1000 / 15; // cap at 15fps to free main thread

  async load(fileset?: WasmFileset): Promise<void> {
    const vision = fileset ?? await FilesetResolver.forVisionTasks(VISION_WASM_PATH);

    const opts = {
      outputCategoryMask: true,
      outputConfidenceMasks: false,
      runningMode: 'VIDEO' as const,
    };

    // Try GPU delegate first — falls back to CPU if WebGL is unavailable.
    try {
      this.segmenter = await ImageSegmenter.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
        ...opts,
      });
    } catch {
      this.segmenter = await ImageSegmenter.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
        ...opts,
      });
    }
  }

  segmentFrame(videoElement: HTMLVideoElement): void {
    if (!this.segmenter || !this._isRunning) return;
    const now = performance.now();
    if (now - this._lastInferenceTime < this.minIntervalMs) return;
    this._lastInferenceTime = now;

    const result = this.segmenter.segmentForVideo(videoElement, now);
    const mask = result.categoryMask;
    if (!mask) {
      result.close();
      return;
    }

    const w = mask.width;
    const h = mask.height;
    const raw = mask.getAsUint8Array();
    const smoothed = this._blurMask(raw, w, h);

    this._lastMask = { data: smoothed, width: w, height: h };

    result.close();

    this._frameCount++;
    if (now - this._lastFpsTime >= 1000) {
      this._fps = this._frameCount;
      this._frameCount = 0;
      this._lastFpsTime = now;
    }
  }

  /** Simple 3×3 box blur (weights center pixel ×4) to smooth mask edges. */
  private _blurMask(src: Uint8Array, w: number, h: number): Uint8Array {
    const dst = new Uint8Array(w * h);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const sum =
          src[(y - 1) * w + (x - 1)] +
          src[(y - 1) * w + x] +
          src[(y - 1) * w + (x + 1)] +
          src[y * w + (x - 1)] +
          src[y * w + x] * 4 +
          src[y * w + (x + 1)] +
          src[(y + 1) * w + (x - 1)] +
          src[(y + 1) * w + x] +
          src[(y + 1) * w + (x + 1)];
        dst[y * w + x] = sum >> 3;
      }
    }
    return dst;
  }

  get lastMask(): SegmentationMask | null {
    return this._lastMask;
  }

  get fps(): number {
    return this._fps;
  }

  start(): void {
    this._isRunning = true;
    this._lastFpsTime = performance.now();
  }

  stop(): void {
    this._isRunning = false;
  }
}
