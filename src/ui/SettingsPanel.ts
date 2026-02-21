import type { InteractionMode, SimConfig } from '../types/index.js';

/** Custom event detail emitted on document when a setting changes. */
export interface SettingsChangeEvent {
  particleCount?: number;
  repulsionForce?: number;
  mode?: InteractionMode;
  showWebcam?: boolean;
}

export interface TextChangeEvent {
  text: string;
}

declare global {
  interface DocumentEventMap {
    'kta:settings-change': CustomEvent<SettingsChangeEvent>;
    'kta:text-change': CustomEvent<TextChangeEvent>;
  }
}

function emitChange(detail: SettingsChangeEvent): void {
  document.dispatchEvent(new CustomEvent('kta:settings-change', { detail }));
}

export class SettingsPanel {
  private readonly el: HTMLElement;
  private readonly body: HTMLElement;
  private collapsed = true;
  private modeSelect!: HTMLSelectElement;

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

    this._addTextInput(this.body, 'KINETYPE');
    this._addSlider(this.body, 'Particles', config.particleCount, 500, 10000, 500, v => {
      emitChange({ particleCount: v });
    });
    this._addSlider(this.body, 'Repulsion', config.repulsionForce, 0.5, 10, 0.5, v => {
      emitChange({ repulsionForce: v });
    });
    this._addModeSelect(this.body, config.mode);
    this._addToggle(this.body, 'Show webcam', true, v => {
      emitChange({ showWebcam: v });
    });

    this.el.appendChild(header);
    this.el.appendChild(this.body);
    document.body.appendChild(this.el);
  }

  /** Sync the mode selector when the mode is changed externally (e.g. bottom bar). */
  setMode(mode: InteractionMode): void {
    this.modeSelect.value = mode;
  }

  private _toggle(): void {
    this.collapsed = !this.collapsed;
    this.body.style.display = this.collapsed ? 'none' : 'block';
    const header = this.el.firstElementChild as HTMLElement;
    header.textContent = this.collapsed ? 'SETTINGS  ▸' : 'SETTINGS  ▾';
  }

  private _addTextInput(parent: HTMLElement, initialText: string): void {
    const row = document.createElement('div');
    row.style.cssText = 'margin-bottom:10px;';

    const lbl = document.createElement('div');
    lbl.textContent = 'Text';
    lbl.style.marginBottom = '4px';

    const inputRow = document.createElement('div');
    inputRow.style.cssText = 'display:flex;gap:6px;';

    const input = document.createElement('input');
    input.type = 'text';
    input.value = initialText;
    input.maxLength = 20;
    Object.assign(input.style, {
      flex: '1',
      background: '#111',
      color: '#39ff14',
      border: '1px solid rgba(57,255,20,0.4)',
      borderRadius: '3px',
      fontFamily: 'monospace',
      fontSize: '12px',
      padding: '3px 6px',
      outline: 'none',
      textTransform: 'uppercase',
    });
    input.addEventListener('input', () => {
      input.value = input.value.toUpperCase();
    });

    const btn = document.createElement('button');
    btn.textContent = 'Apply';
    Object.assign(btn.style, {
      background: 'transparent',
      color: '#39ff14',
      border: '1px solid rgba(57,255,20,0.4)',
      borderRadius: '3px',
      fontFamily: 'monospace',
      fontSize: '12px',
      padding: '3px 8px',
      cursor: 'pointer',
      whiteSpace: 'nowrap',
    });

    const apply = (): void => {
      const text = input.value.trim().toUpperCase();
      if (!text) return;
      document.dispatchEvent(new CustomEvent('kta:text-change', { detail: { text } }));
    };

    btn.addEventListener('click', apply);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') apply(); });

    inputRow.appendChild(input);
    inputRow.appendChild(btn);
    row.appendChild(lbl);
    row.appendChild(inputRow);
    parent.appendChild(row);
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

  private _addToggle(
    parent: HTMLElement,
    label: string,
    initial: boolean,
    onChange: (v: boolean) => void
  ): void {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;margin-top:6px;';

    const lbl = document.createElement('label');
    lbl.textContent = label;
    Object.assign(lbl.style, {
      cursor: 'pointer',
      userSelect: 'none',
    });

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = initial;
    Object.assign(input.style, {
      accentColor: '#39ff14',
      width: '14px',
      height: '14px',
      cursor: 'pointer',
    });
    input.addEventListener('change', () => onChange(input.checked));
    lbl.htmlFor = input.id = `kta-toggle-${label.replace(/\s+/g, '-').toLowerCase()}`;

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
    this.modeSelect = sel;
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

    const modes: InteractionMode[] = ['repulse', 'attract', 'vortex'];
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
