import { Camera } from './camera/Camera.js';
import { HandTracker, FINGERTIP_INDICES, HAND_CONNECTIONS } from './ai/HandTracker.js';
import { StatsOverlay } from './ui/StatsOverlay.js';
import { SettingsPanel } from './ui/SettingsPanel.js';
import { PrivacyBanner } from './ui/PrivacyBanner.js';
import { ParticleSystem } from './physics/ParticleSystem.js';
import { TextCycler } from './physics/TextCycler.js';
import { Renderer } from './render/Renderer.js';
import type { InteractionMode, SimConfig, ForcePoint } from './types/index.js';

// ── iOS warning ───────────────────────────────────────────────────────────────

function isIOS(): boolean {
  return /iP(hone|od|ad)/.test(navigator.userAgent);
}

// ── Loading screen ────────────────────────────────────────────────────────────

function buildLoadingScreen(): { el: HTMLElement; msg: HTMLElement; bar: HTMLElement } {
  const el = document.createElement('div');
  el.id = 'loading-screen';
  Object.assign(el.style, {
    position: 'fixed',
    inset: '0',
    background: '#0a0a0f',
    color: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'monospace',
    zIndex: '10000',
  });
  el.innerHTML = `
    <div style="font-size:2.5rem;font-weight:900;letter-spacing:0.15em;margin-bottom:1.5rem;">KINETYPE</div>
    <div id="loading-msg" style="font-size:0.9rem;opacity:0.7;">Loading AI model\u2026</div>
    <div style="margin-top:1rem;width:260px;height:4px;background:#222;border-radius:2px;overflow:hidden;">
      <div id="loading-bar" style="height:100%;width:0%;background:#39ff14;transition:width 0.4s ease;border-radius:2px;"></div>
    </div>
  `;
  document.body.appendChild(el);
  return {
    el,
    msg: el.querySelector('#loading-msg') as HTMLElement,
    bar: el.querySelector('#loading-bar') as HTMLElement,
  };
}

function buildErrorScreen(message: string): void {
  const el = document.createElement('div');
  el.id = 'error-screen';
  Object.assign(el.style, {
    position: 'fixed',
    inset: '0',
    background: '#0a0a0f',
    color: '#ff4444',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'monospace',
    zIndex: '10000',
  });
  el.innerHTML = `
    <div style="font-size:2rem;font-weight:900;margin-bottom:1rem;color:#fff;">KINETYPE</div>
    <div style="font-size:1rem;opacity:0.85;max-width:400px;text-align:center;line-height:1.6;">${message}</div>
  `;
  document.body.appendChild(el);
}

// ── Mode switcher bottom bar ──────────────────────────────────────────────────

/**
 * Build the mode bar and return a sync function that updates button styles
 * whenever the active mode changes from an external source (e.g. settings panel).
 */
function buildModeBar(
  initialMode: InteractionMode,
  onChange: (mode: InteractionMode) => void
): (mode: InteractionMode) => void {
  // Outer column: buttons on top, credits line below
  const wrapper = document.createElement('div');
  wrapper.id = 'mode-panel';
  Object.assign(wrapper.style, {
    position: 'fixed',
    bottom: '12px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    zIndex: '9999',
  });

  // Mode buttons row
  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:8px;';

  const modes: InteractionMode[] = ['repulse', 'attract', 'vortex'];
  const labels = ['1 Repulse', '2 Attract', '3 Vortex'];
  const buttons: HTMLButtonElement[] = [];

  const syncStyles = (active: InteractionMode): void => {
    buttons.forEach((b, j) => {
      const on = modes[j] === active;
      b.style.background = on ? '#39ff14' : 'rgba(0,0,0,0.6)';
      b.style.color = on ? '#000' : '#39ff14';
    });
  };

  modes.forEach((mode, i) => {
    const btn = document.createElement('button');
    btn.textContent = labels[i];
    Object.assign(btn.style, {
      background: mode === initialMode ? '#39ff14' : 'rgba(0,0,0,0.6)',
      color: mode === initialMode ? '#000' : '#39ff14',
      border: '1px solid #39ff14',
      borderRadius: '4px',
      padding: '6px 14px',
      fontFamily: 'monospace',
      fontSize: '12px',
      cursor: 'pointer',
      transition: 'background 0.15s, color 0.15s',
    });
    btn.addEventListener('click', () => onChange(mode));
    buttons.push(btn);
    btnRow.appendChild(btn);
  });

  // Credits line
  const credits = document.createElement('div');
  Object.assign(credits.style, {
    fontFamily: 'monospace',
    fontSize: '11px',
    color: '#e0ffe0',
    opacity: '0.55',
    whiteSpace: 'nowrap',
    transition: 'opacity 0.2s',
  });
  credits.innerHTML =
    `<a href="https://francescodibiase.com" target="_blank" rel="noopener noreferrer"` +
    ` style="color:#e0ffe0;text-decoration:none;"` +
    ` onmouseover="this.parentElement.style.opacity='0.85'"` +
    ` onmouseout="this.parentElement.style.opacity='0.55'"` +
    `>FrancescodiBiase.com</a>&ensp;&middot;&ensp;2026`;

  wrapper.appendChild(btnRow);
  wrapper.appendChild(credits);
  document.body.appendChild(wrapper);

  window.addEventListener('keydown', e => {
    const idx = ['1', '2', '3'].indexOf(e.key);
    if (idx >= 0) {
      const m = modes[idx];
      if (m) onChange(m);
    }
  });

  return syncStyles;
}

// ── Centered hint overlay (shown when camera is live but no hands detected) ───

function buildHintOverlay(): HTMLElement {
  const el = document.createElement('div');
  Object.assign(el.style, {
    position: 'fixed',
    top: '22%',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(0,0,0,0.70)',
    backdropFilter: 'blur(4px)',
    color: '#ff8800',
    fontFamily: 'monospace',
    fontSize: '13px',
    lineHeight: '1.9',
    letterSpacing: '0.05em',
    textAlign: 'center',
    padding: '12px 22px',
    borderRadius: '6px',
    zIndex: '9998',
    pointerEvents: 'none',
    userSelect: 'none',
    opacity: '0',
    transition: 'opacity 0.8s ease',
  });
  el.innerHTML =
    'Show your hands in front of the camera<br>to sculpt the text in real time.';
  document.body.appendChild(el);
  return el;
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  document.body.style.cssText = 'margin:0;overflow:hidden;background:#0a0a0f;';

  if (isIOS()) {
    buildErrorScreen(
      'KineType is best experienced on Chrome or Firefox on desktop. iOS Safari has limited WebAssembly support.'
    );
    return;
  }

  const loading = buildLoadingScreen();

  // ── Load hand tracking model ───────────────────────────────────────────────

  const handTracker = new HandTracker();
  try {
    loading.bar.style.width = '30%';
    await handTracker.load();
    loading.bar.style.width = '80%';
  } catch (err) {
    console.error('Failed to load hand tracking model:', err);
    loading.el.remove();
    buildErrorScreen('Failed to load AI model. Check your internet connection and refresh.');
    return;
  }

  loading.msg.textContent = 'Initialising\u2026';
  loading.bar.style.width = '95%';

  // ── Simulation config ─────────────────────────────────────────────────────

  const config: SimConfig = {
    particleCount: 4000,
    repulsionForce: 12,
    friction: 0.92,
    ease: 0.06,
    mode: 'repulse',
  };

  // ── Core systems ──────────────────────────────────────────────────────────

  const particleSystem = new ParticleSystem(config);
  const stats = new StatsOverlay();
  let cameraLive = false;

  // Built early so the onUpdate closure can reference it before renderer.init().
  const hintEl = buildHintOverlay();

  // ── Renderer ──────────────────────────────────────────────────────────────

  const renderer = new Renderer({
    particleSystem,
    onUpdate: (dt, now) => {
      const cW = renderer.canvasWidth;
      const cH = renderer.canvasHeight;

      // ── Hand tracking ──────────────────────────────────────────────────────
      if (cameraLive) {
        handTracker.detect(camera.videoElement);
      }
      const hands = cameraLive ? handTracker.hands : [];

      // Show hint only when camera is active but no hands are in frame
      hintEl.style.opacity = (cameraLive && hands.length === 0) ? '1' : '0';

      if (cameraLive) {
        const forcePoints: ForcePoint[] = [];

        const palmSpeeds = handTracker.palmSpeeds;

        const handDrawData = hands.map((hand, handIdx) => {
          const landmarks = hand.landmarks.map(lm => handTracker.toCanvas(lm, cW, cH));

          // Velocity-based force scaling.
          // palmSpeeds is in normalised units/s: 0 = still, ~0.5 = gentle, ~2+ = fast swipe.
          // Map to a multiplier: stationary → 0.25×, moderate → 1×, fast swipe → 3.5×.
          const speed = palmSpeeds[handIdx] ?? 0;
          const velScale = Math.max(0.25, Math.min(3.5, speed / 0.5));

          // Fingertips: strong focused force, scaled by hand velocity
          for (const ti of FINGERTIP_INDICES) {
            const lm = landmarks[ti];
            if (lm) forcePoints.push({ x: lm.x, y: lm.y, radius: 130, strength: 38 * velScale });
          }
          // Palm center: broad soft force, also velocity-scaled
          const palm = landmarks[9];
          if (palm) forcePoints.push({ x: palm.x, y: palm.y, radius: 190, strength: 20 * velScale });

          return { landmarks, connections: HAND_CONNECTIONS, fingertipIndices: FINGERTIP_INDICES };
        });

        particleSystem.setForcePoints(forcePoints);
        renderer.renderHands(handDrawData);
      } else {
        renderer.renderHands([]);
      }

      // ── Text cycling ───────────────────────────────────────────────────────
      textCycler.tick(now);

      // ── Physics ────────────────────────────────────────────────────────────
      particleSystem.updateAll(dt, cW, cH);

      // ── Stats ──────────────────────────────────────────────────────────────
      stats.update({
        renderFps: renderer.fps,
        particleCount: particleSystem.count,
        avgSpeed: particleSystem.avgSpeed,
        mode: config.mode,
        handsTracked: cameraLive ? handTracker.hands.length : 0,
      });
    },
    onLodReduce: () => particleSystem.reduceLOD(),
    onLodRestore: () => particleSystem.restoreLOD(renderer.canvasWidth, renderer.canvasHeight),
  });

  await renderer.init();

  // ── Text cycler ───────────────────────────────────────────────────────────

  const PHRASES = ['KINETYPE'];

  const textCycler = new TextCycler({
    phrases: PHRASES,
    intervalMs: Number.MAX_SAFE_INTEGER,
    canvasWidth: renderer.canvasWidth,
    canvasHeight: renderer.canvasHeight,
    maxParticles: config.particleCount,
  });

  textCycler.onCycleStart((phrase) => {
    particleSystem.transitionTo(phrase, renderer.canvasWidth, renderer.canvasHeight);
  });

  particleSystem.init(PHRASES[0], renderer.canvasWidth, renderer.canvasHeight);

  window.addEventListener('keydown', e => {
    if (e.code === 'Space') { e.preventDefault(); textCycler.next(); }
  });

  // ── Camera setup ──────────────────────────────────────────────────────────

  const camera = new Camera();

  const videoTint = document.createElement('div');
  videoTint.id = 'video-tint';
  Object.assign(videoTint.style, {
    position: 'fixed',
    inset: '0',
    background: 'rgba(0,0,0,0.62)',
    zIndex: '1',
    display: 'none',
    pointerEvents: 'none',
  });
  document.body.appendChild(videoTint);

  Object.assign(camera.videoElement.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transform: 'scaleX(-1)',
    zIndex: '0',
    display: 'none',
    pointerEvents: 'none',
  });
  document.body.appendChild(camera.videoElement);

  async function enableCamera(): Promise<void> {
    try {
      await camera.start();
      cameraLive = true;
      camera.videoElement.style.display = 'block';
      videoTint.style.display = 'block';
      handTracker.start();
    } catch {
      console.warn('Camera unavailable, continuing in mouse-only mode.');
    }
  }

  // ── Finish loading ────────────────────────────────────────────────────────

  loading.bar.style.width = '100%';
  await new Promise(r => setTimeout(r, 200));
  loading.el.remove();

  void enableCamera();

  // ── UI ────────────────────────────────────────────────────────────────────

  new PrivacyBanner().show();
  const settingsPanel = new SettingsPanel(config);

  let syncModeBar: (m: InteractionMode) => void = () => { };
  const setMode = (mode: InteractionMode): void => {
    config.mode = mode;
    syncModeBar(mode);
    settingsPanel.setMode(mode);
  };
  syncModeBar = buildModeBar(config.mode, setMode);

  document.addEventListener('kta:settings-change', e => {
    const d = e.detail;
    if (d.repulsionForce !== undefined) config.repulsionForce = d.repulsionForce;
    if (d.mode !== undefined) setMode(d.mode);
  });

  document.addEventListener('kta:text-change', e => {
    textCycler.setPhrase(e.detail.text);
  });

  // ── Mouse / touch tracking ────────────────────────────────────────────────

  window.addEventListener('mousemove', e => {
    particleSystem.setMousePos({ x: e.clientX, y: e.clientY });
  });
  window.addEventListener('mouseleave', () => particleSystem.setMousePos(null));

  window.addEventListener('touchmove', e => {
    const t = e.touches[0];
    if (t) particleSystem.setMousePos({ x: t.clientX, y: t.clientY });
  }, { passive: true });
  window.addEventListener('touchend', () => particleSystem.setMousePos(null));

  // ── Resize ────────────────────────────────────────────────────────────────

  window.addEventListener('resize', () => {
    textCycler.resize(renderer.canvasWidth, renderer.canvasHeight);
    particleSystem.init(textCycler.currentPhrase(), renderer.canvasWidth, renderer.canvasHeight);
  });

  // ── Page Visibility API ───────────────────────────────────────────────────

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      handTracker.stop();
    } else if (cameraLive) {
      handTracker.start();
    }
  });
}

main().catch(console.error);
