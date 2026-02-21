const STORAGE_KEY = 'kta_privacy_ok';

export class PrivacyBanner {
  private el: HTMLElement | null = null;

  /** Show the banner only if not previously dismissed. */
  show(): void {
    if (localStorage.getItem(STORAGE_KEY) === '1') return;
    this._build();
  }

  private _build(): void {
    const el = document.createElement('div');
    el.id = 'privacy-banner';
    Object.assign(el.style, {
      position: 'fixed',
      bottom: '12px',
      right: '12px',
      background: 'rgba(0,0,0,0.80)',
      color: 'rgba(255,255,255,0.75)',
      fontFamily: 'monospace',
      fontSize: '11px',
      padding: '10px 14px',
      borderRadius: '6px',
      maxWidth: '320px',
      lineHeight: '1.6',
      zIndex: '9998',
      backdropFilter: 'blur(4px)',
      border: '1px solid rgba(255,255,255,0.1)',
    });

    const msg = document.createElement('span');
    msg.textContent =
      'All processing happens locally on your device. No video is sent anywhere.';

    const dismiss = document.createElement('button');
    dismiss.textContent = '✕';
    Object.assign(dismiss.style, {
      float: 'right',
      marginLeft: '10px',
      background: 'none',
      border: 'none',
      color: '#39ff14',
      fontFamily: 'monospace',
      fontSize: '13px',
      cursor: 'pointer',
      lineHeight: '1',
      padding: '0',
    });
    dismiss.addEventListener('click', () => this._dismiss());

    el.appendChild(dismiss);
    el.appendChild(msg);
    document.body.appendChild(el);
    this.el = el;
  }

  private _dismiss(): void {
    localStorage.setItem(STORAGE_KEY, '1');
    this.el?.remove();
    this.el = null;
  }
}
