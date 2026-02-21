# KineType

Interactive kinetic typography — text made of particles that reacts in real-time to your hand movements, tracked via webcam entirely in the browser.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white&style=flat-square)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-7.x-646CFF?logo=vite&logoColor=white&style=flat-square)](https://vitejs.dev/)
[![Pixi.js](https://img.shields.io/badge/Pixi.js-8.x-E72264?logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMiAzMiI+PGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiNlNzIyNjQiLz48L3N2Zz4=&logoColor=white&style=flat-square)](https://pixijs.com/)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-Tasks_Vision-00897B?logo=google&logoColor=white&style=flat-square)](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker)
[![Vercel](https://img.shields.io/badge/Vercel-Deployed-000000?logo=vercel&logoColor=white&style=flat-square)](https://kinetype-ai.vercel.app)
[![License](https://img.shields.io/badge/License-MIT-39ff14?style=flat-square)](LICENSE)

**Live demo:** https://kinetype-ai.vercel.app

![KineType preview](docs/preview-clean.png)

---

## What it does

- Thousands of particles form the word **KINETYPE** (or any custom text)
- Your webcam detects both hands via MediaPipe HandLandmarker — no data leaves your device
- Each fingertip and palm emits a force field that sculpts the particle cloud
- **Velocity-aware forces**: a slow, deliberate hand barely disturbs the text; a fast swipe sends particles exploding across the screen
- Three interaction modes change how the particles respond: repulse, attract, or vortex orbit

---

## Tech stack

| Layer | Technology |
|---|---|
| Language | TypeScript 5 (strict) |
| Build | Vite 7 |
| Hand tracking | MediaPipe Tasks Vision — HandLandmarker, GPU delegate |
| Rendering | Pixi.js 8 — ParticleContainer + WebGL glow layer |
| Hosting | Vercel (auto-deploy on push to `main`) |

---

## Running locally

```bash
npm install
npm run dev
```

Open http://localhost:5173 — allow webcam access when prompted. The AI model (~9 MB) loads from the MediaPipe CDN on first visit.

## Build

```bash
npm run build    # outputs to dist/
npm run preview  # preview production build locally
```

---

## Controls

| Input | Action |
|---|---|
| **Hands in frame** | Sculpt particles in real-time |
| `1` | Repulse mode — hands push particles away |
| `2` | Attract mode — hands pull particles inward |
| `3` | Vortex mode — particles orbit the hand in spirals |
| `Space` | Cycle to next phrase |
| `` ` `` | Toggle stats overlay |

Mouse and touch also work as a single-point force when no webcam is available.

---

## Architecture

```
src/
├── main.ts                   Bootstrap, event wiring, camera + UI orchestration
├── camera/Camera.ts          Webcam stream, CSS mirror (scaleX −1)
├── ai/
│   ├── HandTracker.ts        MediaPipe HandLandmarker, 20fps gated, palm velocity
│   └── Segmenter.ts          WASM path constant (shared with HandTracker)
├── physics/
│   ├── Particle.ts           Euler integration, spring ease, color blend on impact
│   ├── ParticleSystem.ts     Force-point dispatch (fingertips + palms), 3 modes
│   ├── TextSampler.ts        OffscreenCanvas text → particle home positions
│   └── TextCycler.ts         Phrase cycling, configurable interval + Space key
├── render/Renderer.ts        Pixi.js app, ParticleContainer, BlurFilter glow layer
├── ui/
│   ├── SettingsPanel.ts      Collapsible panel: text input, particle count, force, mode
│   ├── StatsOverlay.ts       Live metrics + sparkline charts (FPS + avg speed)
│   └── PrivacyBanner.ts      One-time dismissible privacy notice
└── utils/
    ├── FPSMonitor.ts          Rolling FPS, dynamic LOD trigger
    └── ObjectPool.ts          Generic acquire/release pool (GC pressure reduction)
```

**Key design decisions:**

- Rendering loop (60fps, Pixi ticker) is fully decoupled from AI loop (20fps, timestamp-gated)
- Hand velocity is derived from wrist displacement between detection frames; fast movement amplifies force up to **3.5×**
- LOD system suppressed for the first 12s to let the WASM runtime warm up, then reduces by 10% per trigger if FPS drops below 15 for 5s; floor = 30% of configured max
- Webcam feed is CSS-mirrored (`scaleX(-1)`); landmark X coordinates are flipped accordingly before projecting to canvas space

---

## Privacy

All AI inference runs locally in your browser using WebAssembly + WebGL. The webcam feed never leaves your device and is never uploaded anywhere.

---

## Author

[Francesco di Biase](https://francescodibiase.com) · 2026
