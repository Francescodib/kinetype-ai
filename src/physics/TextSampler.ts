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

    // Fit font size so text fills ~70% of width
    let fontSize = Math.floor(canvasHeight * 0.55);
    this.ctx.font = `900 ${fontSize}px ${fontFamily}`;
    let measured = this.ctx.measureText(text).width;
    const targetWidth = canvasWidth * 0.82;
    if (measured > targetWidth) {
      fontSize = Math.floor(fontSize * (targetWidth / measured));
    }

    this.ctx.font = `900 ${fontSize}px ${fontFamily}`;
    measured = this.ctx.measureText(text).width;

    // Center text
    const x = (canvasWidth - measured) / 2;
    const y = canvasHeight / 2 + fontSize * 0.35;

    this.ctx.fillStyle = color;
    this.ctx.fillText(text, x, y);

    // Scan non-transparent pixels
    const imageData = this.ctx.getImageData(0, 0, canvasWidth, canvasHeight);
    const pixels = imageData.data;
    const raw: SamplePoint[] = [];

    for (let py = 0; py < canvasHeight; py++) {
      for (let px = 0; px < canvasWidth; px++) {
        const alpha = pixels[(py * canvasWidth + px) * 4 + 3];
        if (alpha > 128) {
          raw.push({ homeX: px, homeY: py });
        }
      }
    }

    if (raw.length === 0) return [];

    // Subsample evenly to maxParticles
    if (raw.length <= maxParticles) return raw;

    const step = raw.length / maxParticles;
    const result: SamplePoint[] = [];
    for (let i = 0; i < maxParticles; i++) {
      result.push(raw[Math.floor(i * step)]);
    }
    return result;
  }
}
