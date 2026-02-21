import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task';

const WASM_PATH = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm';

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

  async load(): Promise<void> {
    const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
    this.landmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_URL },
      runningMode: 'VIDEO',
      numHands: 2,
    });
  }

  /** Run hand detection on the current video frame (timestamp-gated to 30fps). */
  detect(video: HTMLVideoElement): void {
    if (!this.landmarker || !this._isRunning) return;
    const now = performance.now();
    if (now - this._lastTime < this.minIntervalMs) return;
    this._lastTime = now;

    const result = this.landmarker.detectForVideo(video, now);
    this._hands = result.landmarks.map(lms => ({ landmarks: lms }));
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

  start(): void {
    this._isRunning = true;
  }

  stop(): void {
    this._isRunning = false;
    this._hands = [];
  }
}
