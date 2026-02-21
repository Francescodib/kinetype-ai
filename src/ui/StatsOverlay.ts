export interface StatsData {
  aiFps: number;
  renderFps?: number;
  maskDensity: number;    // 0–1: fraction of screen covered by silhouette
  motionIntensity: number; // 0–1
  particleCount?: number;
  mode?: string;
}

export class StatsOverlay {
  private readonly el: HTMLElement;
  private readonly motionBar: HTMLElement;
  private readonly maskBar: HTMLElement;
  private visible = true;

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
      minWidth: '200px',
    });

    // Shared bar builder
    const makeBar = (color: string): { row: HTMLElement; fill: HTMLElement } => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:6px;margin:2px 0;';
      const track = document.createElement('div');
      track.style.cssText =
        'flex:1;height:4px;background:rgba(255,255,255,0.15);border-radius:2px;overflow:hidden;';
      const fill = document.createElement('div');
      fill.style.cssText = `height:100%;width:0%;background:${color};border-radius:2px;transition:width 0.1s linear;`;
      track.appendChild(fill);
      row.appendChild(track);
      return { row, fill };
    };

    // Build inner HTML structure
    this.el.innerHTML = `
      <div id="st-line1"></div>
      <div id="st-line2"></div>
      <div id="st-motion-label"></div>
    `;

    const motionRow = makeBar('#ff6b35');
    this.el.appendChild(motionRow.row);
    this.motionBar = motionRow.fill;

    const line3 = document.createElement('div');
    line3.id = 'st-line3';
    this.el.appendChild(line3);

    const maskRow = makeBar('#39ff14');
    this.el.appendChild(maskRow.row);
    this.maskBar = maskRow.fill;

    const line4 = document.createElement('div');
    line4.id = 'st-line4';
    this.el.appendChild(line4);

    document.body.appendChild(this.el);

    window.addEventListener('keydown', e => {
      if (e.key === '`') this.toggle();
    });
  }

  update(data: StatsData): void {
    if (!this.visible) return;

    const rFps = data.renderFps !== undefined ? `  R:${data.renderFps}` : '';
    const line1 = this.el.querySelector('#st-line1') as HTMLElement;
    const line2 = this.el.querySelector('#st-line2') as HTMLElement;
    const motionLabel = this.el.querySelector('#st-motion-label') as HTMLElement;
    const line3 = this.el.querySelector('#st-line3') as HTMLElement;
    const line4 = this.el.querySelector('#st-line4') as HTMLElement;

    line1.textContent = `AI FPS  ${String(data.aiFps).padStart(3)}${rFps}`;
    line2.textContent = data.particleCount !== undefined
      ? `Particles ${data.particleCount}`
      : '';

    const motionPct = (data.motionIntensity * 100).toFixed(0);
    motionLabel.textContent = `Motion  ${String(motionPct).padStart(3)}%`;
    this.motionBar.style.width = `${(data.motionIntensity * 100).toFixed(1)}%`;

    const coverPct = (data.maskDensity * 100).toFixed(1);
    line3.textContent = `Cover   ${coverPct}%`;
    this.maskBar.style.width = `${(data.maskDensity * 100).toFixed(1)}%`;

    line4.textContent = data.mode ? `Mode    ${data.mode}` : '';
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
