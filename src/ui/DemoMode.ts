import type { SegmentationMask } from '../types/index.js';

export type DemoMaskCallback = (mask: SegmentationMask) => void;

/**
 * Generates procedural silhouette masks at ~10fps to animate particles
 * without requiring webcam access. Simulates a person moving/waving.
 */
export class DemoMode {
  private _isRunning = false;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private frame = 0;
  private onMask: DemoMaskCallback | null = null;
  private overlay: HTMLElement | null = null;
  private onEnableCamera: (() => void) | null = null;

  // Mask resolution — kept small for perf (will be upscaled by ParticleSystem)
  private readonly W = 64;
  private readonly H = 48;

  constructor(onMask: DemoMaskCallback, onEnableCamera: () => void) {
    this.onMask = onMask;
    this.onEnableCamera = onEnableCamera;
  }

  start(): void {
    if (this._isRunning) return;
    this._isRunning = true;
    this.frame = 0;
    this._buildOverlay();
    // ~10fps
    this.intervalId = setInterval(() => this._tick(), 100);
  }

  stop(): void {
    if (!this._isRunning) return;
    this._isRunning = false;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this._removeOverlay();
  }

  isRunning(): boolean {
    return this._isRunning;
  }

  private _tick(): void {
    this.frame++;
    const mask = this._generateFrame(this.frame);
    this.onMask?.(mask);
  }

  /**
   * Procedurally generate a silhouette mask for the given frame index.
   * Simulates a person outline that sways and waves one arm.
   */
  private _generateFrame(f: number): SegmentationMask {
    const W = this.W;
    const H = this.H;
    const data = new Uint8Array(W * H);

    // Body sway: horizontal oscillation
    const sway = Math.sin(f * 0.08) * 4;

    // Body center
    const cx = W / 2 + sway;

    // Head: circle at top
    const headCX = cx;
    const headCY = H * 0.18;
    const headR = W * 0.09;

    // Torso: rectangle in middle
    const torsoX1 = cx - W * 0.1;
    const torsoX2 = cx + W * 0.1;
    const torsoY1 = H * 0.28;
    const torsoY2 = H * 0.62;

    // Left arm: static
    const larmX1 = cx - W * 0.22;
    const larmX2 = cx - W * 0.1;
    const larmY1 = H * 0.29;
    const larmY2 = H * 0.52;

    // Right arm: waving (angle oscillates)
    const waveAngle = Math.sin(f * 0.18) * 0.8;
    const rarmBaseX = cx + W * 0.1;
    const rarmBaseY = H * 0.32;
    const rarmLen = H * 0.28;
    const rarmEndX = rarmBaseX + Math.sin(waveAngle + 0.5) * rarmLen * 0.7;
    const rarmEndY = rarmBaseY - Math.cos(waveAngle + 0.5) * rarmLen;

    // Legs
    const legY1 = H * 0.62;
    const legY2 = H * 0.95;
    const lLegX1 = cx - W * 0.12;
    const lLegX2 = cx - W * 0.02;
    const rLegX1 = cx + W * 0.02;
    const rLegX2 = cx + W * 0.12;

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let inside = false;

        // Head
        const dh = Math.hypot(x - headCX, y - headCY);
        if (dh < headR) { inside = true; }

        // Torso
        if (!inside && x >= torsoX1 && x <= torsoX2 && y >= torsoY1 && y <= torsoY2) {
          inside = true;
        }

        // Left arm
        if (!inside && x >= larmX1 && x <= larmX2 && y >= larmY1 && y <= larmY2) {
          inside = true;
        }

        // Right arm (draw as thick line segment)
        if (!inside) {
          const t = _closestT(rarmBaseX, rarmBaseY, rarmEndX, rarmEndY, x, y);
          const px = rarmBaseX + t * (rarmEndX - rarmBaseX);
          const py = rarmBaseY + t * (rarmEndY - rarmBaseY);
          if (Math.hypot(x - px, y - py) < W * 0.065) { inside = true; }
        }

        // Left leg
        if (!inside && x >= lLegX1 && x <= lLegX2 && y >= legY1 && y <= legY2) {
          inside = true;
        }

        // Right leg
        if (!inside && x >= rLegX1 && x <= rLegX2 && y >= legY1 && y <= legY2) {
          inside = true;
        }

        if (inside) data[y * W + x] = 1;
      }
    }

    return { data, width: W, height: H };
  }

  private _buildOverlay(): void {
    if (this.overlay) return;
    const el = document.createElement('div');
    el.id = 'demo-overlay';
    Object.assign(el.style, {
      position: 'fixed',
      bottom: '60px',
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '10px',
      zIndex: '9998',
      pointerEvents: 'none',
    });

    const label = document.createElement('div');
    label.textContent = 'Demo mode — move your cursor to interact';
    Object.assign(label.style, {
      color: 'rgba(255,255,255,0.5)',
      fontFamily: 'monospace',
      fontSize: '12px',
      letterSpacing: '0.05em',
    });

    const btn = document.createElement('button');
    btn.textContent = 'Enable webcam to interact';
    Object.assign(btn.style, {
      background: 'transparent',
      color: '#39ff14',
      border: '1px solid #39ff14',
      borderRadius: '4px',
      padding: '8px 20px',
      fontFamily: 'monospace',
      fontSize: '13px',
      cursor: 'pointer',
      pointerEvents: 'auto',
      letterSpacing: '0.05em',
      transition: 'background 0.2s, color 0.2s',
    });
    btn.addEventListener('mouseenter', () => {
      btn.style.background = '#39ff14';
      btn.style.color = '#000';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'transparent';
      btn.style.color = '#39ff14';
    });
    btn.addEventListener('click', () => {
      this.onEnableCamera?.();
    });

    el.appendChild(label);
    el.appendChild(btn);
    document.body.appendChild(el);
    this.overlay = el;
  }

  private _removeOverlay(): void {
    this.overlay?.remove();
    this.overlay = null;
  }
}

/** Returns clamped t ∈ [0,1] for closest point on segment (ax,ay)→(bx,by) to (px,py). */
function _closestT(ax: number, ay: number, bx: number, by: number, px: number, py: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return 0;
  return Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
}
