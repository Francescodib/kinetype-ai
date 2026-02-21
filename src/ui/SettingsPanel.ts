import type { InteractionMode, SimConfig } from '../types/index.js';

/** Custom event detail emitted on document when a setting changes. */
export interface SettingsChangeEvent {
  particleCount?: number;
  repulsionForce?: number;
  mode?: InteractionMode;
}

declare global {
  interface DocumentEventMap {
    'kta:settings-change': CustomEvent<SettingsChangeEvent>;
  }
}

function emitChange(detail: SettingsChangeEvent): void {
  document.dispatchEvent(new CustomEvent('kta:settings-change', { detail }));
}

export class SettingsPanel {
  private readonly el: HTMLElement;
  private readonly body: HTMLElement;
  private collapsed = true;

  constructor(config: SimConfig) {
    // Outer container
    this.el = document.createElement('div');
    this.el.id = 'settings-panel';
    Object.assign(this.el.style, {
      position: 'fixed',
      top: '12px',
      left: '12px',
      background: 'rgba(0,0,0,0.70)',
      color: '#e0ffe0',
      fontFamily: 'monospace',
      fontSize: '12px',
      borderRadius: '6px',
      zIndex: '9999',
      userSelect: 'none',
      backdropFilter: 'blur(4px)',
      minWidth: '200px',
    });

    // Header / toggle
    const header = document.createElement('div');
    header.textContent = 'SETTINGS  ▸';
    Object.assign(header.style, {
      padding: '8px 14px',
      cursor: 'pointer',
      letterSpacing: '0.08em',
      borderBottom: '1px solid rgba(57,255,20,0.2)',
    });
    header.addEventListener('click', () => this._toggle());

    // Collapsible body
    this.body = document.createElement('div');
    this.body.style.cssText = 'padding:10px 14px;display:none;';

    this._addSlider(this.body, 'Particles', config.particleCount, 500, 10000, 500, v => {
      emitChange({ particleCount: v });
    });
    this._addSlider(this.body, 'Repulsion', config.repulsionForce, 0.5, 10, 0.5, v => {
      emitChange({ repulsionForce: v });
    });
    this._addModeSelect(this.body, config.mode);

    this.el.appendChild(header);
    this.el.appendChild(this.body);
    document.body.appendChild(this.el);
  }

  private _toggle(): void {
    this.collapsed = !this.collapsed;
    this.body.style.display = this.collapsed ? 'none' : 'block';
    const header = this.el.firstElementChild as HTMLElement;
    header.textContent = this.collapsed ? 'SETTINGS  ▸' : 'SETTINGS  ▾';
  }

  private _addSlider(
    parent: HTMLElement,
    label: string,
    initial: number,
    min: number,
    max: number,
    step: number,
    onChange: (v: number) => void
  ): void {
    const row = document.createElement('div');
    row.style.cssText = 'margin-bottom:10px;';

    const lbl = document.createElement('div');
    lbl.style.cssText = 'display:flex;justify-content:space-between;margin-bottom:4px;';
    const name = document.createElement('span');
    name.textContent = label;
    const val = document.createElement('span');
    val.style.color = '#39ff14';
    val.textContent = String(initial);

    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(initial);
    Object.assign(input.style, {
      width: '100%',
      accentColor: '#39ff14',
      cursor: 'pointer',
    });
    input.addEventListener('input', () => {
      const v = Number(input.value);
      val.textContent = String(v);
      onChange(v);
    });

    lbl.appendChild(name);
    lbl.appendChild(val);
    row.appendChild(lbl);
    row.appendChild(input);
    parent.appendChild(row);
  }

  private _addModeSelect(parent: HTMLElement, initialMode: InteractionMode): void {
    const row = document.createElement('div');
    row.style.cssText = 'margin-bottom:4px;';

    const lbl = document.createElement('div');
    lbl.textContent = 'Mode';
    lbl.style.marginBottom = '4px';

    const sel = document.createElement('select');
    Object.assign(sel.style, {
      width: '100%',
      background: '#111',
      color: '#39ff14',
      border: '1px solid rgba(57,255,20,0.4)',
      borderRadius: '3px',
      fontFamily: 'monospace',
      fontSize: '12px',
      padding: '3px 6px',
      cursor: 'pointer',
    });

    const modes: InteractionMode[] = ['repulse', 'attract', 'vortex', 'freeze'];
    for (const m of modes) {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      if (m === initialMode) opt.selected = true;
      sel.appendChild(opt);
    }
    sel.addEventListener('change', () => {
      emitChange({ mode: sel.value as InteractionMode });
    });

    row.appendChild(lbl);
    row.appendChild(sel);
    parent.appendChild(row);
  }
}
