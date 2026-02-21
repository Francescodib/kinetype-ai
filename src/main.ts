import { Camera } from './camera/Camera.js';
import { Segmenter } from './ai/Segmenter.js';
import { HandTracker, FINGERTIP_INDICES, HAND_CONNECTIONS } from './ai/HandTracker.js';
import { StatsOverlay } from './ui/StatsOverlay.js';
import { DemoMode } from './ui/DemoMode.js';
import { SettingsPanel } from './ui/SettingsPanel.js';
import { PrivacyBanner } from './ui/PrivacyBanner.js';
import { ParticleSystem } from './physics/ParticleSystem.js';
import { TextCycler } from './physics/TextCycler.js';
import { Renderer } from './render/Renderer.js';
import { MotionAnalyzer } from './utils/MotionAnalyzer.js';
import type { SegmentationMask, InteractionMode, SimConfig, ForcePoint } from './types/index.js';

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

function buildModeBar(
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

  window.addEventListener('keydown', e => {
    const idx = ['1', '2', '3', '4'].indexOf(e.key);
    if (idx >= 0) buttons[idx]?.click();
  });
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

  // ── Load AI models (segmentation + hand tracking in parallel) ─────────────

  const segmenter = new Segmenter();
  const handTracker = new HandTracker();
  try {
    loading.bar.style.width = '20%';
    await Promise.all([
      segmenter.load(),
      handTracker.load().catch(err => {
        // Hand tracking is optional — log and continue without it
        console.warn('HandTracker failed to load, continuing without it:', err);
      }),
    ]);
    loading.bar.style.width = '65%';
  } catch (err) {
    console.error('Failed to load segmentation model:', err);
    loading.el.remove();
    buildErrorScreen('Failed to load AI model. Check your internet connection and refresh.');
    return;
  }

  loading.msg.textContent = 'Initialising\u2026';
  loading.bar.style.width = '85%';

  // ── Simulation config ─────────────────────────────────────────────────────

  const config: SimConfig = {
    particleCount: 4000,
    repulsionForce: 8,
    friction: 0.88,
    ease: 0.06,
    mode: 'repulse',
  };

  // ── Core systems ──────────────────────────────────────────────────────────

  const particleSystem = new ParticleSystem(config);
  const motionAnalyzer = new MotionAnalyzer();
  const stats = new StatsOverlay();

  let motionIntensity = 0;
  let maskDensity = 0;
  let currentMask: SegmentationMask | null = null;
  let cameraLive = false;

  // ── Renderer ──────────────────────────────────────────────────────────────

  const renderer = new Renderer({
    particleSystem,
    onUpdate: (dt, _mask, now) => {
      const cW = renderer.canvasWidth;
      const cH = renderer.canvasHeight;

      // ── AI segmentation + hand tracking (only when camera is live) ─────────
      if (cameraLive) {
        // Hand tracking runs first; if hands are in frame, skip body segmentation
        // this frame to halve the synchronous WASM inference load.
        handTracker.detect(camera.videoElement);
        const hands = handTracker.hands;

        if (hands.length === 0) {
          // No hands → run body segmentation for full-body ambient interaction
          segmenter.segmentFrame(camera.videoElement);
          const seg = segmenter.lastMask;
          if (seg) {
            currentMask = seg;
            const result = motionAnalyzer.analyze(seg);
            motionIntensity = result.motionIntensity;
            let person = 0;
            for (let i = 0; i < seg.data.length; i++) {
              if (seg.data[i] > 0) person++;
            }
            maskDensity = person / seg.data.length;
          }
        } else {
          // Hands present → clear body mask (hand forces take over)
          currentMask = null;
          motionIntensity = 0;
          maskDensity = 0;
        }

        const forcePoints: ForcePoint[] = [];

        const handDrawData = hands.map(hand => {
          const landmarks = hand.landmarks.map(lm => handTracker.toCanvas(lm, cW, cH));

          // Fingertips: strong focused force
          for (const ti of FINGERTIP_INDICES) {
            const lm = landmarks[ti];
            if (lm) forcePoints.push({ x: lm.x, y: lm.y, radius: 100, strength: 22 });
          }
          // Palm center (landmark 9 — base of middle finger): broader softer force
          const palm = landmarks[9];
          if (palm) forcePoints.push({ x: palm.x, y: palm.y, radius: 160, strength: 10 });

          return { landmarks, connections: HAND_CONNECTIONS, fingertipIndices: FINGERTIP_INDICES };
        });

        particleSystem.setForcePoints(forcePoints);
        renderer.renderHands(handDrawData);
      } else {
        // No camera: clear any stale hand visuals
        renderer.renderHands([]);
      }

      // ── Text cycling ───────────────────────────────────────────────────────
      textCycler.tick(now);

      // ── Physics ────────────────────────────────────────────────────────────
      particleSystem.updateAll(dt, currentMask, motionIntensity, cW, cH);

      // ── Stats ──────────────────────────────────────────────────────────────
      stats.update({
        aiFps: cameraLive ? segmenter.fps : 0,
        maskDensity,
        motionIntensity,
        particleCount: particleSystem.count,
        mode: config.mode,
        renderFps: renderer.fps,
      });
    },
    onLodReduce: () => particleSystem.reduceLOD(),
    onLodRestore: () => particleSystem.restoreLOD(renderer.canvasWidth, renderer.canvasHeight),
  });

  await renderer.init();

  // ── Text cycler ───────────────────────────────────────────────────────────

  const PHRASES = ['KINETYPE', 'MOVE ME', 'HELLO', 'TOUCH ME', 'PLAY'];

  const textCycler = new TextCycler({
    phrases: PHRASES,
    intervalMs: 8000,
    canvasWidth: renderer.canvasWidth,
    canvasHeight: renderer.canvasHeight,
    maxParticles: config.particleCount,
  });

  textCycler.onCycleStart((phrase) => {
    particleSystem.transitionTo(phrase, renderer.canvasWidth, renderer.canvasHeight);
  });

  // Init particles with first phrase
  particleSystem.init(PHRASES[0], renderer.canvasWidth, renderer.canvasHeight);

  // Space → next phrase immediately
  window.addEventListener('keydown', e => {
    if (e.code === 'Space') { e.preventDefault(); textCycler.next(); }
  });

  // ── Camera setup ──────────────────────────────────────────────────────────

  const camera = new Camera();

  // Dark tint layer between webcam video and Pixi canvas.
  // Becomes visible when camera is live so the video feed is readable but subdued.
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

  // Video element goes at z-index 0, behind the tint and Pixi canvas
  Object.assign(camera.videoElement.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transform: 'scaleX(-1)',
    zIndex: '0',
    display: 'none',        // shown only when camera is live
    pointerEvents: 'none',
  });
  document.body.appendChild(camera.videoElement);

  async function enableCamera(): Promise<void> {
    try {
      await camera.start();
      cameraLive = true;
      // Show the webcam feed behind the canvas
      camera.videoElement.style.display = 'block';
      videoTint.style.display = 'block';
      demoMode.stop();
      currentMask = null;
      motionAnalyzer.reset();
      segmenter.start();
      handTracker.start();
    } catch {
      // Permission denied or no camera → stay in mouse-only / demo mode
      console.warn('Camera unavailable, staying in demo/mouse mode.');
    }
  }

  // ── Demo mode ─────────────────────────────────────────────────────────────

  const demoMode = new DemoMode(
    (mask) => {
      // Demo masks feed the physics loop if camera not live
      if (!cameraLive) {
        currentMask = mask;
        const result = motionAnalyzer.analyze(mask);
        motionIntensity = result.motionIntensity * 0.6; // gentler in demo
        maskDensity = 0.12; // approximate static coverage
      }
    },
    () => { void enableCamera(); }
  );

  demoMode.start();

  // ── Finish loading ────────────────────────────────────────────────────────

  loading.bar.style.width = '100%';
  await new Promise(r => setTimeout(r, 200));
  loading.el.remove();

  // Try camera automatically (silent fail → demo continues)
  void enableCamera();

  // ── UI ────────────────────────────────────────────────────────────────────

  new PrivacyBanner().show();
  new SettingsPanel(config);
  buildModeBar(config, mode => { config.mode = mode; });

  // Settings panel events → live config
  document.addEventListener('kta:settings-change', e => {
    const d = e.detail;
    if (d.repulsionForce !== undefined) config.repulsionForce = d.repulsionForce;
    if (d.mode !== undefined) config.mode = d.mode;
    // particleCount changes require re-init (handled gracefully by LOD)
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
      segmenter.stop();
      handTracker.stop();
      demoMode.stop();
    } else {
      if (cameraLive) {
        segmenter.start();
        handTracker.start();
      } else {
        demoMode.start();
      }
    }
  });
}

main().catch(console.error);
