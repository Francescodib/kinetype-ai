import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { VISION_WASM_PATH } from './Segmenter.js';

type WasmFileset = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task';

/** Hand landmark indices used for interaction and drawing. */
export const FINGERTIP_INDICES = [4, 8, 12, 16, 20] as const;
export const KNUCKLE_INDICES = [1, 5, 9, 13, 17] as const;

/** Connections for drawing the hand skeleton (pairs of landmark indices). */
export const HAND_CONNECTIONS: [number, number][] = [
  // Palm
  [0, 1], [1, 5], [5, 9], [9, 13], [13, 17], [17, 0],
  // Thumb
  [1, 2], [2, 3], [3, 4],
  // Index
  [5, 6], [6, 7], [7, 8],
  // Middle
  [9, 10], [10, 11], [11, 12],
  // Ring
  [13, 14], [14, 15], [15, 16],
  // Pinky
  [17, 18], [18, 19], [19, 20],
];

export interface TrackedHand {
  /** All 21 normalized landmarks [0,1]. */
  landmarks: NormalizedLandmark[];
}

export class HandTracker {
  private landmarker: HandLandmarker | null = null;
  private _hands: TrackedHand[] = [];
  private _isRunning = false;
  private _lastTime = 0;
  private readonly minIntervalMs = 1000 / 20; // cap at 20fps for responsive hand tracking

  /**
   * Per-hand palm speed in normalized units/second, updated on each detection.
   * Normalized coords are in [0,1] × [0,1], so 1 unit/s = crossing the full
   * webcam frame in 1 second. Typical fast swipe ≈ 1.5–3 units/s.
   */
  private _palmSpeeds: number[] = [];
  /** Previous wrist positions (landmark 0) per hand slot, in normalized coords. */
  private _prevWrist: Array<{ x: number; y: number } | undefined> = [];

  async load(fileset?: WasmFileset): Promise<void> {
    const vision = fileset ?? await FilesetResolver.forVisionTasks(VISION_WASM_PATH);

    const opts = {
      runningMode: 'VIDEO' as const,
      numHands: 2,
    };

    // Try GPU delegate first — falls back to CPU if WebGL is unavailable.
    try {
      this.landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
        ...opts,
      });
    } catch {
      this.landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
        ...opts,
      });
    }
  }

  /** Run hand detection on the current video frame (timestamp-gated to 20fps). */
  detect(video: HTMLVideoElement): void {
    if (!this.landmarker || !this._isRunning) return;
    const now = performance.now();
    const elapsed = now - this._lastTime;
    if (elapsed < this.minIntervalMs) return;

    // Capture elapsed before updating _lastTime so we have the true detection interval.
    const detDtSec = Math.max(elapsed / 1000, 0.016);
    this._lastTime = now;

    const result = this.landmarker.detectForVideo(video, now);
    this._hands = result.landmarks.map(lms => ({ landmarks: lms }));

    // Compute per-hand palm speed from wrist (landmark 0) displacement.
    this._palmSpeeds = this._hands.map((hand, i) => {
      const wrist = hand.landmarks[0]; // most stable point for translation
      const prev = this._prevWrist[i];
      this._prevWrist[i] = { x: wrist.x, y: wrist.y };
      if (!prev) return 0;
      const dx = wrist.x - prev.x;
      const dy = wrist.y - prev.y;
      return Math.sqrt(dx * dx + dy * dy) / detDtSec;
    });

    // Clear stale entries for hands that are no longer tracked.
    for (let i = this._hands.length; i < this._prevWrist.length; i++) {
      this._prevWrist[i] = undefined;
    }
    this._palmSpeeds.length = this._hands.length;
  }

  /**
   * Convert a normalized landmark to canvas coordinates.
   * X is flipped because the webcam video is mirrored via CSS but
   * MediaPipe processes the raw (unmirrored) frame.
   */
  toCanvas(lm: NormalizedLandmark, canvasW: number, canvasH: number): { x: number; y: number } {
    return {
      x: (1 - lm.x) * canvasW,
      y: lm.y * canvasH,
    };
  }

  get hands(): TrackedHand[] {
    return this._hands;
  }

  get isTracking(): boolean {
    return this._hands.length > 0;
  }

  /**
   * Per-hand palm speed in normalized units/second (index matches `hands`).
   * 0 = stationary, ~0.5 = gentle move, ~2+ = fast swipe.
   */
  get palmSpeeds(): number[] {
    return this._palmSpeeds;
  }

  start(): void {
    this._isRunning = true;
  }

  stop(): void {
    this._isRunning = false;
    this._hands = [];
    this._palmSpeeds = [];
    this._prevWrist = [];
  }
}
