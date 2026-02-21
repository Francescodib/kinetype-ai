import { Camera } from './camera/Camera.js';
import { Segmenter } from './ai/Segmenter.js';
import { StatsOverlay } from './ui/StatsOverlay.js';

// ── UI elements ──────────────────────────────────────────────────────────────

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

function buildErrorScreen(message: string): HTMLElement {
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
    <div style="font-size:2rem;font-weight:900;margin-bottom:1rem;">KINETYPE</div>
    <div style="font-size:1rem;opacity:0.8;max-width:380px;text-align:center;">${message}</div>
  `;
  document.body.appendChild(el);
  return el;
}

function buildDebugCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.id = 'debug-canvas';
  Object.assign(canvas.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transform: 'scaleX(-1)',
    zIndex: '1',
    background: '#0a0a0f',
  });
  document.body.appendChild(canvas);
  return canvas;
}

// ── iOS / unsupported browser warning ────────────────────────────────────────

function isIOS(): boolean {
  return /iP(hone|od|ad)/.test(navigator.userAgent);
}

// ── App bootstrap ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  document.body.style.cssText = 'margin:0;overflow:hidden;background:#0a0a0f;';

  if (isIOS()) {
    buildErrorScreen(
      'KineType is best experienced on Chrome or Firefox on desktop.<br>iOS Safari has limited WebAssembly support.'
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
    loadingBar.style.width = '70%';
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

  try {
    await camera.start();
  } catch {
    if (camera.status === 'denied') {
      loadingScreen.remove();
      buildErrorScreen('Webcam access denied. Please allow camera access and refresh the page.');
      return;
    }
    loadingScreen.remove();
    buildErrorScreen('Could not access webcam. Please check your device settings.');
    return;
  }

  loadingBar.style.width = '100%';
  await new Promise(r => setTimeout(r, 300));
  loadingScreen.remove();

  // Build debug overlay canvas
  const debugCanvas = buildDebugCanvas();
  const debugCtx = debugCanvas.getContext('2d')!;
  debugCanvas.width = camera.width;
  debugCanvas.height = camera.height;

  const stats = new StatsOverlay();
  segmenter.start();

  // ── Main loop ──────────────────────────────────────────────────────────────
  let maskDensity = 0;

  function loop(): void {
    if (camera.isReady) {
      segmenter.segmentFrame(camera.videoElement);
    }

    const mask = segmenter.lastMask;

    if (mask) {
      if (debugCanvas.width !== mask.width || debugCanvas.height !== mask.height) {
        debugCanvas.width = mask.width;
        debugCanvas.height = mask.height;
      }

      const imgData = debugCtx.createImageData(mask.width, mask.height);
      let personPixels = 0;
      const total = mask.width * mask.height;

      for (let i = 0; i < total; i++) {
        // MediaPipe selfie_segmenter category mask: 1 = person, 0 = background
        const isPerson = mask.data[i] > 0;
        const v = isPerson ? 255 : 0;
        imgData.data[i * 4] = v;
        imgData.data[i * 4 + 1] = v;
        imgData.data[i * 4 + 2] = v;
        imgData.data[i * 4 + 3] = 255;
        if (isPerson) personPixels++;
      }
      debugCtx.putImageData(imgData, 0, 0);
      maskDensity = personPixels / total;
    }

    stats.update({
      aiFps: segmenter.fps,
      maskDensity,
      motionIntensity: 0, // placeholder until Phase 3
    });

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);

  // Pause AI when tab is hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      segmenter.stop();
    } else {
      segmenter.start();
    }
  });
}

main().catch(console.error);
