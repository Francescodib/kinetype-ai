export interface SamplePoint {
  homeX: number;
  homeY: number;
}

export interface TextSamplerOptions {
  text: string;
  canvasWidth: number;
  canvasHeight: number;
  maxParticles: number;
  fontFamily?: string;
  color?: string;
}

export class TextSampler {
  private readonly offscreen: OffscreenCanvas;
  private readonly ctx: OffscreenCanvasRenderingContext2D;

  constructor() {
    this.offscreen = new OffscreenCanvas(1, 1);
    this.ctx = this.offscreen.getContext('2d', {
      willReadFrequently: true,
    }) as OffscreenCanvasRenderingContext2D;
  }

  sample(opts: TextSamplerOptions): SamplePoint[] {
    const {
      text,
      canvasWidth,
      canvasHeight,
      maxParticles,
      fontFamily = 'Arial Black, Impact, sans-serif',
      color = '#ffffff',
    } = opts;

    this.offscreen.width = canvasWidth;
    this.offscreen.height = canvasHeight;
    this.ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // ── Font sizing ───────────────────────────────────────────────────────────
    // Width-first: scale to fill 82% of canvas width.
    let fontSize = Math.floor(canvasHeight * 0.55);
    this.ctx.font = `900 ${fontSize}px ${fontFamily}`;
    let measured = this.ctx.measureText(text).width;
    const targetWidth = canvasWidth * 0.82;
    if (measured > targetWidth) {
      fontSize = Math.floor(fontSize * (targetWidth / measured));
    }
    // On portrait screens the width-clamped font can become tiny (all particles
    // collapse into a single horizontal stripe). Enforce a minimum only when
    // the canvas is taller than it is wide — on landscape the width-based size
    // is already large enough and applying a floor would cause overflow.
    if (canvasHeight > canvasWidth) {
      const minFontSize = Math.floor(canvasWidth * 0.22);
      if (fontSize < minFontSize) fontSize = minFontSize;
    }

    this.ctx.font = `900 ${fontSize}px ${fontFamily}`;
    measured = this.ctx.measureText(text).width;

    // Center text (may overflow canvas horizontally on portrait — intentional).
    const x = (canvasWidth - measured) / 2;
    const y = canvasHeight / 2 + fontSize * 0.35;

    this.ctx.fillStyle = color;
    this.ctx.fillText(text, x, y);

    // ── Pixel scan ────────────────────────────────────────────────────────────
    const imageData = this.ctx.getImageData(0, 0, canvasWidth, canvasHeight);
    const pixels = imageData.data;
    const W = canvasWidth;
    const H = canvasHeight;

    const isFilled = (px: number, py: number): boolean => {
      if (px < 0 || py < 0 || px >= W || py >= H) return false;
      return pixels[(py * W + px) * 4 + 3] > 128;
    };

    const edgePoints: SamplePoint[] = [];
    const interiorPoints: SamplePoint[] = [];

    for (let py = 0; py < H; py++) {
      for (let px = 0; px < W; px++) {
        if (!isFilled(px, py)) continue;
        // A pixel is an edge if at least one 4-connected neighbour is unfilled.
        const isEdge =
          !isFilled(px - 1, py) ||
          !isFilled(px + 1, py) ||
          !isFilled(px, py - 1) ||
          !isFilled(px, py + 1);
        if (isEdge) {
          edgePoints.push({ homeX: px, homeY: py });
        } else {
          interiorPoints.push({ homeX: px, homeY: py });
        }
      }
    }

    if (edgePoints.length + interiorPoints.length === 0) return [];

    const subsampleArr = (arr: SamplePoint[], count: number): SamplePoint[] => {
      if (arr.length <= count) return arr;
      const step = arr.length / count;
      const result: SamplePoint[] = [];
      for (let i = 0; i < count; i++) result.push(arr[Math.floor(i * step)]);
      return result;
    };

    const totalRaw = edgePoints.length + interiorPoints.length;
    if (totalRaw <= maxParticles) {
      // No subsampling needed — return edges first so LOD truncation removes interior first.
      return [...edgePoints, ...interiorPoints];
    }

    // ── Edge-biased subsampling ───────────────────────────────────────────────
    // Give edges up to 70 % of the particle budget so that at lower particle
    // counts (LOD reductions, mobile) the letter outlines stay readable.
    const edgeBudget = Math.min(edgePoints.length, Math.ceil(maxParticles * 0.7));
    const interiorBudget = maxParticles - edgeBudget;

    return [
      ...subsampleArr(edgePoints, edgeBudget),
      ...subsampleArr(interiorPoints, interiorBudget),
    ];
  }
}
