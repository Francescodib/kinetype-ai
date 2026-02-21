export interface StatsData {
  renderFps: number;
  particleCount: number;
  /** Average particle speed (canvas px/s) — drives the second sparkline. */
  avgSpeed: number;
  mode: string;
  handsTracked: number; // 0, 1, or 2
}

const INTERVAL_MS = 100;  // sample every 100 ms → snappy response
const HISTORY = 150;      // 150 × 100 ms = 15 s of scrolling history
const CHART_W = 196;
const CHART_H = 64;

export class StatsOverlay {
  private readonly el: HTMLElement;
  // Hidden by default on narrow screens (mobile) to avoid overlapping the settings panel.
  private visible = window.innerWidth > 640;

  // Sparkline state
  private readonly chartCanvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly fpsHistory: number[] = [];
  private readonly speedHistory: number[] = [];
  private lastSampleTime = 0;

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'stats-overlay';
    Object.assign(this.el.style, {
      position: 'fixed',
      top: '12px',
      right: '12px',
      background: 'rgba(0,0,0,0.70)',
      color: '#e0ffe0',
      fontFamily: 'monospace',
      fontSize: '12px',
      padding: '10px 14px',
      borderRadius: '6px',
      lineHeight: '1.7',
      pointerEvents: 'none',
      zIndex: '9999',
      userSelect: 'none',
      backdropFilter: 'blur(4px)',
      minWidth: '210px',
    });

    this.el.innerHTML = `
      <div id="st-fps"></div>
      <div id="st-particles"></div>
      <div id="st-mode"></div>
      <div id="st-hands"></div>
    `;

    // ── Sparkline charts ──────────────────────────────────────────────────────

    const divider = document.createElement('div');
    divider.style.cssText = 'border-top:1px solid rgba(57,255,20,0.25);margin:8px 0 6px;';
    this.el.appendChild(divider);

    this.chartCanvas = document.createElement('canvas');
    this.chartCanvas.width = CHART_W;
    this.chartCanvas.height = CHART_H;
    this.chartCanvas.style.cssText = `
      display:block;width:100%;border-radius:3px;
      background:rgba(0,0,0,0.3);image-rendering:crisp-edges;
    `;
    this.el.appendChild(this.chartCanvas);
    this.ctx = this.chartCanvas.getContext('2d')!;

    const legend = document.createElement('div');
    legend.style.cssText = 'display:flex;justify-content:space-between;margin-top:3px;font-size:10px;opacity:0.65;';
    legend.innerHTML =
      '<span style="color:#39ff14">── FPS (0–60)</span>' +
      '<span style="color:#ff8844">── Speed</span>';
    this.el.appendChild(legend);

    document.body.appendChild(this.el);
    if (!this.visible) this.el.style.display = 'none';

    window.addEventListener('keydown', e => {
      if (e.key === '`') this.toggle();
    });
  }

  update(data: StatsData): void {
    if (!this.visible) return;

    (this.el.querySelector('#st-fps') as HTMLElement).textContent =
      `FPS     ${String(data.renderFps).padStart(3)}`;
    (this.el.querySelector('#st-particles') as HTMLElement).textContent =
      `Particles ${data.particleCount}`;
    (this.el.querySelector('#st-mode') as HTMLElement).textContent =
      `Mode    ${data.mode}`;
    (this.el.querySelector('#st-hands') as HTMLElement).textContent =
      data.handsTracked > 0 ? `Hands   ${data.handsTracked}` : `Hands   —`;

    const now = performance.now();
    if (now - this.lastSampleTime >= INTERVAL_MS) {
      this.lastSampleTime = now;
      this._push(this.fpsHistory, data.renderFps);
      this._push(this.speedHistory, data.avgSpeed);
      this._drawCharts();
    }
  }

  private _push(arr: number[], val: number): void {
    arr.push(val);
    if (arr.length > HISTORY) arr.shift();
  }

  private _drawCharts(): void {
    const { ctx } = this;
    const W = CHART_W;
    const H = CHART_H;
    const mid = Math.floor(H / 2);

    ctx.clearRect(0, 0, W, H);

    // Separator
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(W, mid);
    ctx.stroke();

    // FPS chart — top half, range 0–60
    this._sparkline(this.fpsHistory, 0, 0, W, mid - 1, 0, 60, '#39ff14');

    // Speed chart — bottom half, range 0–150 px/s
    this._sparkline(this.speedHistory, 0, mid + 1, W, mid - 1, 0, 150, '#ff8844');
  }

  private _sparkline(
    data: number[],
    x: number, y: number, w: number, h: number,
    min: number, max: number,
    color: string,
  ): void {
    if (data.length < 2) return;
    const ctx = this.ctx;
    const range = max - min || 1;
    const n = data.length;

    const px = (i: number): number => x + (i / (HISTORY - 1)) * w;
    const py = (v: number): number => y + h - ((Math.min(v, max) - min) / range) * h;

    // Filled area
    ctx.beginPath();
    ctx.moveTo(px(0), y + h);
    for (let i = 0; i < n; i++) ctx.lineTo(px(i), py(data[i]));
    ctx.lineTo(px(n - 1), y + h);
    ctx.closePath();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = 1;

    // Line
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      if (i === 0) ctx.moveTo(px(0), py(data[0]));
      else ctx.lineTo(px(i), py(data[i]));
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Dot at latest value
    ctx.beginPath();
    ctx.arc(px(n - 1), py(data[n - 1]), 2.5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  toggle(): void {
    this.visible = !this.visible;
    this.el.style.display = this.visible ? 'block' : 'none';
  }

  show(): void {
    this.visible = true;
    this.el.style.display = 'block';
  }
}
