export interface StatsData {
  aiFps: number;
  maskDensity: number; // 0–1, avg segmentation confidence proxy
  motionIntensity: number; // 0–1 placeholder
  particleCount?: number;
  mode?: string;
}

export class StatsOverlay {
  private readonly el: HTMLElement;
  private visible = true;

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'stats-overlay';
    Object.assign(this.el.style, {
      position: 'fixed',
      top: '12px',
      right: '12px',
      background: 'rgba(0,0,0,0.65)',
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
    });
    document.body.appendChild(this.el);

    // Toggle with backtick
    window.addEventListener('keydown', e => {
      if (e.key === '`') this.toggle();
    });
  }

  update(data: StatsData): void {
    if (!this.visible) return;
    const density = (data.maskDensity * 100).toFixed(1);
    const motion = (data.motionIntensity * 100).toFixed(0);
    const particles = data.particleCount !== undefined ? `\nParticles  ${data.particleCount}` : '';
    const mode = data.mode ? `\nMode       ${data.mode}` : '';
    this.el.innerText =
      `AI FPS     ${data.aiFps}` +
      `\nMask       ${density}%` +
      `\nMotion     ${motion}%` +
      particles +
      mode;
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
