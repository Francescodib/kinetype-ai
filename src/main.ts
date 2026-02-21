import { Camera } from './camera/Camera.js';
import { Segmenter } from './ai/Segmenter.js';
import { StatsOverlay } from './ui/StatsOverlay.js';
import { ParticleSystem } from './physics/ParticleSystem.js';
import { Renderer } from './render/Renderer.js';
import { MotionAnalyzer } from './utils/MotionAnalyzer.js';
import type { SegmentationMask, InteractionMode, SimConfig } from './types/index.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const PHRASES = ['KINETYPE', 'MOVE ME', 'HELLO', 'TOUCH ME', 'PLAY'];
const PHRASE_INTERVAL_MS = 8000;

// ── UI helpers ────────────────────────────────────────────────────────────────

function buildLoadingScreen(): HTMLElement {
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
  return el;
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

function buildModeUI(
  config: SimConfig,
  onChange: (mode: InteractionMode) => void
): void {
  const panel = document.createElement('div');
  panel.id = 'mode-panel';
  Object.assign(panel.style, {
    position: 'fixed',
    bottom: '16px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    gap: '8px',
    zIndex: '9999',
  });

  const modes: InteractionMode[] = ['repulse', 'attract', 'vortex', 'freeze'];
  const labels = ['1 Repulse', '2 Attract', '3 Vortex', '4 Freeze'];

  const buttons: HTMLButtonElement[] = [];
  modes.forEach((mode, i) => {
    const btn = document.createElement('button');
    btn.textContent = labels[i];
    btn.dataset['mode'] = mode;
    Object.assign(btn.style, {
      background: mode === config.mode ? '#39ff14' : 'rgba(0,0,0,0.6)',
      color: mode === config.mode ? '#000' : '#39ff14',
      border: '1px solid #39ff14',
      borderRadius: '4px',
      padding: '6px 14px',
      fontFamily: 'monospace',
      fontSize: '12px',
      cursor: 'pointer',
      transition: 'background 0.15s, color 0.15s',
    });
    btn.addEventListener('click', () => {
      onChange(mode);
      buttons.forEach((b, j) => {
        const active = modes[j] === mode;
        b.style.background = active ? '#39ff14' : 'rgba(0,0,0,0.6)';
        b.style.color = active ? '#000' : '#39ff14';
      });
    });
    buttons.push(btn);
    panel.appendChild(btn);
  });

  document.body.appendChild(panel);

  // Keyboard shortcuts 1–4
  window.addEventListener('keydown', e => {
    const idx = ['1', '2', '3', '4'].indexOf(e.key);
    if (idx >= 0) buttons[idx].click();
  });
}

function isIOS(): boolean {
  return /iP(hone|od|ad)/.test(navigator.userAgent);
}

// ── App bootstrap ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  document.body.style.cssText = 'margin:0;overflow:hidden;background:#0a0a0f;';

  if (isIOS()) {
    buildErrorScreen(
      'KineType is best experienced on Chrome or Firefox on desktop. iOS Safari has limited WebAssembly support.'
    );
    return;
  }

  const loadingScreen = buildLoadingScreen();
  const loadingMsg = document.getElementById('loading-msg') as HTMLElement;
  const loadingBar = document.getElementById('loading-bar') as HTMLElement;

  // Load AI model
  const segmenter = new Segmenter();
  try {
    loadingBar.style.width = '20%';
    await segmenter.load();
    loadingBar.style.width = '65%';
  } catch (err) {
    console.error('Failed to load segmentation model:', err);
    loadingScreen.remove();
    buildErrorScreen('Failed to load AI model. Check your internet connection and refresh.');
    return;
  }

  // Request webcam
  loadingMsg.textContent = 'Requesting webcam\u2026';
  loadingBar.style.width = '80%';

  const camera = new Camera();
  document.body.appendChild(camera.videoElement);

  let cameraAvailable = true;
  try {
    await camera.start();
  } catch {
    cameraAvailable = false;
    // Mouse-only fallback — don't show error prominently
    console.warn('Webcam unavailable, running in mouse-only mode.');
  }

  loadingBar.style.width = '90%';
  loadingMsg.textContent = 'Building particle system\u2026';

  // ── Config ────────────────────────────────────────────────────────────────

  const config: SimConfig = {
    particleCount: 6000,
    repulsionForce: 3.5,
    friction: 0.88,
    ease: 0.06,
    mode: 'repulse',
  };

  // ── Particle system ───────────────────────────────────────────────────────

  const particleSystem = new ParticleSystem(config);
  const motionAnalyzer = new MotionAnalyzer();
  const stats = new StatsOverlay();

  let currentPhraseIdx = 0;
  let lastPhraseTime = 0;
  let motionIntensity = 0;
  let maskDensity = 0;
  let currentMask: SegmentationMask | null = null;

  // ── Renderer ──────────────────────────────────────────────────────────────

  const renderer = new Renderer({
    particleSystem,
    onUpdate: (dt, _mask, now) => {
      // Feed AI frame
      if (cameraAvailable && camera.isReady) {
        segmenter.segmentFrame(camera.videoElement);
      }

      currentMask = segmenter.lastMask;
      renderer.setMask(currentMask);

      // Motion intensity + mask density
      if (currentMask) {
        const result = motionAnalyzer.analyze(currentMask);
        motionIntensity = result.motionIntensity;
        let person = 0;
        for (let i = 0; i < currentMask.data.length; i++) {
          if (currentMask.data[i] > 0) person++;
        }
        maskDensity = person / currentMask.data.length;
      }

      // Text cycling: Space or timer
      if (now - lastPhraseTime > PHRASE_INTERVAL_MS) {
        _nextPhrase(now);
      }

      particleSystem.updateAll(
        dt,
        currentMask,
        motionIntensity,
        renderer.canvasWidth,
        renderer.canvasHeight
      );

      stats.update({
        aiFps: segmenter.fps,
        maskDensity,
        motionIntensity,
        particleCount: particleSystem.count,
        mode: config.mode,
        renderFps: renderer.fps,
      });
    },
    onLodReduce: () => {
      particleSystem.reduceLOD();
    },
    onLodRestore: () => {
      particleSystem.restoreLOD(renderer.canvasWidth, renderer.canvasHeight);
    },
  });

  await renderer.init();

  // Init particles after renderer so canvas dimensions are known
  particleSystem.init(PHRASES[0], renderer.canvasWidth, renderer.canvasHeight);
  lastPhraseTime = performance.now();

  loadingBar.style.width = '100%';
  await new Promise(r => setTimeout(r, 200));
  loadingScreen.remove();

  // ── Mouse tracking ────────────────────────────────────────────────────────

  window.addEventListener('mousemove', e => {
    particleSystem.setMousePos({ x: e.clientX, y: e.clientY });
  });
  window.addEventListener('mouseleave', () => {
    particleSystem.setMousePos(null);
  });

  // Touch support
  window.addEventListener('touchmove', e => {
    const t = e.touches[0];
    if (t) particleSystem.setMousePos({ x: t.clientX, y: t.clientY });
  }, { passive: true });
  window.addEventListener('touchend', () => {
    particleSystem.setMousePos(null);
  });

  // ── Text cycling ──────────────────────────────────────────────────────────

  function _nextPhrase(now: number): void {
    currentPhraseIdx = (currentPhraseIdx + 1) % PHRASES.length;
    particleSystem.transitionTo(
      PHRASES[currentPhraseIdx],
      renderer.canvasWidth,
      renderer.canvasHeight
    );
    lastPhraseTime = now;
  }

  window.addEventListener('keydown', e => {
    if (e.code === 'Space') {
      e.preventDefault();
      _nextPhrase(performance.now());
    }
  });

  // ── Mode switcher UI ──────────────────────────────────────────────────────

  buildModeUI(config, mode => {
    config.mode = mode;
  });

  // ── Resize ────────────────────────────────────────────────────────────────

  window.addEventListener('resize', () => {
    particleSystem.init(
      PHRASES[currentPhraseIdx],
      renderer.canvasWidth,
      renderer.canvasHeight
    );
  });

  // ── Visibility API ────────────────────────────────────────────────────────

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      segmenter.stop();
    } else {
      segmenter.start();
    }
  });

  segmenter.start();
}

main().catch(console.error);
