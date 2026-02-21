# KineType AI

Interactive kinetic typography where text made of particles reacts in real-time to your body movements, captured via webcam.

**Live demo:** https://kinetype-ai.vercel.app

---

## What it does

- Your webcam captures a live silhouette using MediaPipe AI segmentation (runs entirely in the browser — no data is sent anywhere)
- The silhouette drives thousands of particles that form text
- Four interaction modes: **Repulse**, **Attract**, **Vortex**, **Freeze**
- Motion intensity modulates force: wave fast → explosive scatter; move slowly → gentle push

## Tech stack

| Layer | Technology |
|---|---|
| Language | TypeScript 5 (strict) |
| Build | Vite 7 |
| AI / Segmentation | MediaPipe Tasks Vision — selfie segmentation |
| Rendering | Pixi.js 8 — ParticleContainer, WebGL |
| Deploy | Vercel (primary) / GitHub Pages |

## Running locally

```bash
npm install
npm run dev
```

Open http://localhost:5173 — allow webcam access when prompted.

## Build & deploy

```bash
npm run build   # outputs to dist/
npm run preview # preview production build locally
```

Deploys automatically to GitHub Pages on push to `main` via GitHub Actions.
For Vercel: connect the repo and set `VITE_BASE_PATH=/` (default).

## Controls

| Key | Action |
|---|---|
| `1` | Repulse mode |
| `2` | Attract mode |
| `3` | Vortex mode |
| `4` | Freeze mode |
| `Space` | Next phrase |
| `` ` `` | Toggle stats overlay |

## Architecture

```
src/
├── main.ts               Bootstrap, event wiring, global state
├── camera/Camera.ts      Webcam stream + mirroring
├── ai/Segmenter.ts       MediaPipe wrapper, 30fps gated inference
├── physics/
│   ├── Particle.ts       Euler integration, spring ease, color blend
│   ├── ParticleSystem.ts Pool, mask interaction, 4 modes, bounding-box opt
│   ├── TextSampler.ts    OffscreenCanvas text → particle home positions
│   └── TextCycler.ts     Phrase cycling, 8s timer + Space key
├── render/Renderer.ts    Pixi.js app, ParticleContainer, glow layer
├── ui/
│   ├── DemoMode.ts       Procedural silhouette demo without webcam
│   ├── SettingsPanel.ts  Collapse/expand: particles, repulsion, mode
│   ├── PrivacyBanner.ts  One-time dismissible privacy notice
│   └── StatsOverlay.ts   Live metrics: FPS, motion, coverage, mode
└── utils/
    ├── MotionAnalyzer.ts  Frame-diff → motionIntensity (0–1)
    ├── FPSMonitor.ts      Rolling FPS + dynamic LOD trigger
    └── ObjectPool.ts      Generic acquire/release pool
```

## Privacy

All AI inference runs locally in your browser using WebAssembly. The webcam feed never leaves your device.
