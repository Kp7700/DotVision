/**
 * DOTVISION processing engine
 *
 * Pipeline (every frame):
 *  1. Draw the source into an offscreen canvas at the processing resolution
 *  2. Read pixels and convert RGB → Rec.709 luminance
 *  3. Optional temporal blend (video/camera stability) + spatial blur
 *  4. Optional Laplacian edge boost to keep silhouettes readable
 *  5. Tone map: exposure, brightness, contrast, gamma, invert, black-point
 *  6. Sample a stable grid and emit white (or accent) dots whose
 *     *area* is proportional to brightness — classic halftone principle
 *  7. Composite onto a pure black canvas and blit into the display
 *
 * Dots are generated from pixel *position*, never from per-frame random
 * numbers, so the pattern stays coherent as the scene moves.
 */

import { RESOLUTION_WIDTH } from "../presets";
import type { FitMode, ProcessSettings, ViewMode } from "../types";

const TWO_PI = Math.PI * 2;
const HEX_ROW = Math.sqrt(3) / 2; // 0.866025... vertical pitch for hex packing

/** 8×8 Bayer matrix, already normalized to 0..1 using (n + 0.5) / 64 */
const BAYER8 = new Float32Array([
  0.0078125, 0.5078125, 0.1328125, 0.6328125, 0.0390625, 0.5390625, 0.1640625, 0.6640625,
  0.7578125, 0.2578125, 0.8828125, 0.3828125, 0.7890625, 0.2890625, 0.9140625, 0.4140625,
  0.1953125, 0.6953125, 0.0703125, 0.5703125, 0.2265625, 0.7265625, 0.1015625, 0.6015625,
  0.9453125, 0.4453125, 0.8203125, 0.3203125, 0.9765625, 0.4765625, 0.8515625, 0.3515625,
  0.0546875, 0.5546875, 0.1796875, 0.6796875, 0.0234375, 0.5234375, 0.1484375, 0.6484375,
  0.8046875, 0.3046875, 0.9296875, 0.4296875, 0.7734375, 0.2734375, 0.8984375, 0.3984375,
  0.2421875, 0.7421875, 0.1171875, 0.6171875, 0.2109375, 0.7109375, 0.0859375, 0.5859375,
  0.9921875, 0.4921875, 0.8671875, 0.3671875, 0.9609375, 0.4609375, 0.8359375, 0.3359375,
]);

export interface FrameInfo {
  processW: number;
  processH: number;
  sourceW: number;
  sourceH: number;
}

export interface ProcessOptions {
  viewMode: ViewMode;
  split: number;
  fit: FitMode;
  mirror: boolean;
  temporal: boolean;
}

function create2d(
  w: number,
  h: number,
  attrs?: CanvasRenderingContext2DSettings,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, w);
  canvas.height = Math.max(1, h);
  const ctx = canvas.getContext("2d", attrs);
  if (!ctx) throw new Error("Canvas 2D is not available in this browser.");
  return { canvas, ctx };
}

export function fitRect(
  srcW: number,
  srcH: number,
  destW: number,
  destH: number,
  mode: FitMode,
): { x: number; y: number; w: number; h: number } {
  if (srcW <= 0 || srcH <= 0 || destW <= 0 || destH <= 0) {
    return { x: 0, y: 0, w: destW, h: destH };
  }
  const scale =
    mode === "cover"
      ? Math.max(destW / srcW, destH / srcH)
      : Math.min(destW / srcW, destH / srcH);
  const w = srcW * scale;
  const h = srcH * scale;
  return { x: (destW - w) * 0.5, y: (destH - h) * 0.5, w, h };
}

export function parseHexColor(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (h.length !== 6) return { r: 255, g: 255, b: 255 };
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return { r: 255, g: 255, b: 255 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/**
 * Deterministic 2D hash in 0..1. Used by the stipple mode so a given
 * grid cell always makes the same keep/skip decision for the same brightness.
 */
function hash2d(x: number, y: number): number {
  let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function bilinear(lum: Float32Array, w: number, h: number, x: number, y: number): number {
  const x0 = Math.min(w - 1, Math.max(0, x | 0));
  const y0 = Math.min(h - 1, Math.max(0, y | 0));
  const x1 = Math.min(w - 1, x0 + 1);
  const y1 = Math.min(h - 1, y0 + 1);
  const fx = x - x0;
  const fy = y - y0;
  const a = lum[y0 * w + x0];
  const b = lum[y0 * w + x1];
  const c = lum[y1 * w + x0];
  const d = lum[y1 * w + x1];
  return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
}

function boxBlur(src: Float32Array, tmp: Float32Array, w: number, h: number, passes: number): void {
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        const l = src[row + Math.max(x - 1, 0)];
        const c = src[row + x];
        const r = src[row + Math.min(x + 1, w - 1)];
        tmp[row + x] = (l + c + r) * 0.33333334;
      }
    }
    for (let y = 0; y < h; y++) {
      const ym = Math.max(y - 1, 0) * w;
      const yc = y * w;
      const yp = Math.min(y + 1, h - 1) * w;
      for (let x = 0; x < w; x++) {
        src[yc + x] = (tmp[ym + x] + tmp[yc + x] + tmp[yp + x]) * 0.33333334;
      }
    }
  }
}

function enhanceEdges(
  src: Float32Array,
  dst: Float32Array,
  w: number,
  h: number,
  amount: number,
): void {
  for (let x = 0; x < w; x++) {
    dst[x] = src[x];
    dst[(h - 1) * w + x] = src[(h - 1) * w + x];
  }
  for (let y = 1; y < h - 1; y++) {
    dst[y * w] = src[y * w];
    dst[y * w + w - 1] = src[y * w + w - 1];
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = 4 * src[i] - src[i - 1] - src[i + 1] - src[i - w] - src[i + w];
      dst[i] = src[i] + amount * lap;
    }
  }
}

/**
 * Procedural shaded sphere used as the empty-state demo.
 * The live engine then turns it into dots, so presets preview themselves.
 */
export function renderDemoScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  time: number,
): void {
  const img = ctx.createImageData(w, h);
  const data = img.data;
  const cx = w * 0.5;
  const cy = h * 0.47;
  const rad = Math.min(w, h) * 0.33;
  const rad2 = rad * rad;

  let lx = Math.cos(time * 0.65) * 0.58;
  let ly = Math.sin(time * 0.48) * 0.32 - 0.22;
  let lz = 0.78;
  const llen = Math.hypot(lx, ly, lz) || 1;
  lx /= llen;
  ly /= llen;
  lz /= llen;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;

      let v = 3;
      const gy = y / h;
      v += gy * 6;

      if (d2 <= rad2) {
        const z = Math.sqrt(rad2 - d2);
        const nx = dx / rad;
        const ny = dy / rad;
        const nz = z / rad;
        const diff = Math.max(0, nx * lx + ny * ly + nz * lz);
        const hx = lx;
        const hy = ly;
        const hz = lz + 1;
        const hlen = Math.hypot(hx, hy, hz) || 1;
        const spec = Math.pow(
          Math.max(0, (nx * hx + ny * hy + nz * hz) / hlen),
          36,
        );
        v = 16 + diff * 205 + spec * 255;
        v *= 0.82 + 0.18 * nz;
      } else {
        const shadowY = cy + rad * 0.98;
        const sdx = (x - cx) / (rad * 1.15);
        const sdy = (y - shadowY) / (rad * 0.2);
        const sd = sdx * sdx + sdy * sdy;
        if (sd < 1) v = Math.max(v, 14 * (1 - sd) * (1 - sd));
      }

      const c = v < 0 ? 0 : v > 255 ? 255 : v;
      data[i] = c;
      data[i + 1] = c;
      data[i + 2] = c;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

export class DotEngine {
  private sample: HTMLCanvasElement;
  private sampleCtx: CanvasRenderingContext2D;
  private proc: HTMLCanvasElement;
  private procCtx: CanvasRenderingContext2D;
  private original: HTMLCanvasElement;
  private originalCtx: CanvasRenderingContext2D;

  private lum = new Float32Array(1);
  private tmp = new Float32Array(1);
  private prev = new Float32Array(1);
  private err = new Float32Array(1);
  private hasPrev = false;

  constructor() {
    const s = create2d(16, 16, { willReadFrequently: true, alpha: false });
    this.sample = s.canvas;
    this.sampleCtx = s.ctx;

    const p = create2d(16, 16, { alpha: false });
    this.proc = p.canvas;
    this.procCtx = p.ctx;
    this.procCtx.imageSmoothingEnabled = true;

    const o = create2d(16, 16, { alpha: false });
    this.original = o.canvas;
    this.originalCtx = o.ctx;
  }

  getProcessedCanvas(): HTMLCanvasElement {
    return this.proc;
  }

  getOriginalCanvas(): HTMLCanvasElement {
    return this.original;
  }

  resetTemporal(): void {
    this.hasPrev = false;
  }

  private ensureSize(w: number, h: number): void {
    if (this.sample.width !== w || this.sample.height !== h) {
      this.sample.width = w;
      this.sample.height = h;
      this.proc.width = w;
      this.proc.height = h;
      this.original.width = w;
      this.original.height = h;
    }
    const n = w * h;
    if (this.lum.length !== n) {
      this.lum = new Float32Array(n);
      this.tmp = new Float32Array(n);
      this.prev = new Float32Array(n);
      this.err = new Float32Array(n);
      this.hasPrev = false;
    }
  }

  /**
   * Main per-frame entry. `sourceW/H` are the intrinsic pixel dimensions
   * of the video/image. The destination context is the on-screen canvas.
   */
  process(
    source: CanvasImageSource,
    sourceW: number,
    sourceH: number,
    dest: CanvasRenderingContext2D,
    destW: number,
    destH: number,
    settings: ProcessSettings,
    options: ProcessOptions,
  ): FrameInfo {
    const info: FrameInfo = { processW: 0, processH: 0, sourceW, sourceH };
    if (destW < 2 || destH < 2 || sourceW < 2 || sourceH < 2) return info;

    const maxW = RESOLUTION_WIDTH[settings.resolution];
    const aspect = sourceW / sourceH;
    let pw = maxW;
    let ph = Math.round(maxW / aspect);
    if (ph > maxW * 1.35) {
      ph = Math.round(maxW * 1.35);
      pw = Math.round(ph * aspect);
    }
    pw = Math.max(80, pw);
    ph = Math.max(80, ph);
    info.processW = pw;
    info.processH = ph;

    this.ensureSize(pw, ph);

    const sctx = this.sampleCtx;
    sctx.save();
    if (options.mirror) {
      sctx.translate(pw, 0);
      sctx.scale(-1, 1);
    }
    sctx.drawImage(source, 0, 0, sourceW, sourceH, 0, 0, pw, ph);
    sctx.restore();

    // Keep a copy of the (already mirrored) original for split / save.
    this.originalCtx.drawImage(this.sample, 0, 0);

    const pixels = sctx.getImageData(0, 0, pw, ph).data;
    const lum = this.lum;
    const n = pw * ph;

    // --- RGB → luminance (Rec.709) ---
    for (let i = 0, p = 0; i < n; i++, p += 4) {
      lum[i] = (0.2126 * pixels[p] + 0.7152 * pixels[p + 1] + 0.0722 * pixels[p + 2]) / 255;
    }

    // Temporal blend keeps the grid from sparkling on noisy webcams.
    if (options.temporal && this.hasPrev && this.prev.length === n) {
      const t = 0.22 + settings.smoothing * 0.38;
      const it = 1 - t;
      const prev = this.prev;
      for (let i = 0; i < n; i++) lum[i] = lum[i] * it + prev[i] * t;
    }
    this.prev.set(lum);
    this.hasPrev = true;

    const blurPasses = Math.round(settings.smoothing * 3);
    if (blurPasses > 0) boxBlur(lum, this.tmp, pw, ph, blurPasses);

    if (settings.edgeEnhance > 0.01) {
      enhanceEdges(lum, this.tmp, pw, ph, settings.edgeEnhance * 1.6);
      lum.set(this.tmp);
    }

    // --- Tone mapping ---
    const exposure = settings.exposure;
    const brightness = settings.brightness;
    const contrast = settings.contrast;
    const gamma = Math.max(0.05, settings.gamma);
    const invGamma = 1 / gamma;
    const black = Math.max(0, Math.min(0.95, settings.threshold));
    const blackScale = 1 / (1 - black);
    const invert = settings.invert;
    const density = Math.max(0.05, settings.dotDensity);

    for (let i = 0; i < n; i++) {
      let y = lum[i] * exposure;
      y = (y - 0.5) * contrast + 0.5 + brightness;
      if (y < 0) y = 0;
      else if (y > 1) y = 1;
      y = Math.pow(y, invGamma);
      if (invert) y = 1 - y;
      if (black > 0) {
        y = y <= black ? 0 : (y - black) * blackScale;
      }
      // Density warps the curve: >1 lifts midtones (more/larger dots).
      y = Math.pow(y, 1 / density);
      if (y < 0) y = 0;
      else if (y > 1) y = 1;
      lum[i] = y;
    }

    this.renderDots(settings, pw, ph);

    this.composite(dest, destW, destH, sourceW, sourceH, options);
    return info;
  }

  private renderDots(settings: ProcessSettings, w: number, h: number): void {
    const ctx = this.procCtx;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = settings.dotColor || "#ffffff";

    const spacing = Math.max(2, settings.dotSpacing);
    const minR = Math.max(0, settings.minDotSize) * settings.dotSize;
    const maxR = Math.max(minR, (spacing * 0.5) * settings.maxDotSize * settings.dotSize);
    const sharp = settings.dotSharpness;
    const mode = settings.ditherMode;

    ctx.beginPath();

    if (mode === "halftone") {
      this.halftone(w, h, spacing, minR, maxR, sharp);
    } else if (mode === "ordered") {
      this.ordered(w, h, spacing, minR, maxR);
    } else if (mode === "floyd") {
      this.floyd(w, h, spacing, minR, maxR);
    } else if (mode === "threshold") {
      this.thresholdDots(w, h, spacing, minR, maxR);
    } else {
      this.stipple(w, h, spacing, minR, maxR);
    }

    ctx.fill();
  }

  /** Variable-size dots on a hexagonal lattice. Area ∝ brightness. */
  private halftone(
    w: number,
    h: number,
    spacing: number,
    minR: number,
    maxR: number,
    sharp: number,
  ): void {
    const ctx = this.procCtx;
    const lum = this.lum;
    const rowStep = spacing * HEX_ROW;
    const rows = Math.ceil(h / rowStep) + 1;
    const cols = Math.ceil(w / spacing) + 1;
    // Size curve: mix of sqrt (area-correct) and linear, driven by sharpness.
    const exp = 0.5 + (1 - sharp) * 0.35;

    for (let row = 0; row < rows; row++) {
      const y = row * rowStep + rowStep * 0.5;
      if (y < -spacing || y >= h + spacing) continue;
      const xOff = (row & 1) * spacing * 0.5;
      for (let col = 0; col < cols; col++) {
        const x = col * spacing + spacing * 0.5 + xOff;
        if (x < -spacing || x >= w + spacing) continue;
        const Y = bilinear(lum, w, h, x, y);
        if (Y < 0.018) continue;
        let r = minR + (maxR - minR) * Math.pow(Y, exp);
        if (r < 0.22) continue;
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, TWO_PI);
      }
    }
  }

  /** Ordered Bayer dithering — equal-sized dots, on/off, rock-stable. */
  private ordered(w: number, h: number, spacing: number, minR: number, maxR: number): void {
    const ctx = this.procCtx;
    const lum = this.lum;
    const cols = Math.ceil(w / spacing);
    const rows = Math.ceil(h / spacing);
    const baseR = Math.max(0.35, minR > 0 ? minR : maxR * 0.42);

    for (let row = 0; row < rows; row++) {
      const y = row * spacing + spacing * 0.5;
      for (let col = 0; col < cols; col++) {
        const x = col * spacing + spacing * 0.5;
        const Y = bilinear(lum, w, h, x, y);
        const b = BAYER8[(row & 7) * 8 + (col & 7)];
        if (Y <= b) continue;
        const r = baseR + (maxR - baseR) * Y * 0.35;
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, TWO_PI);
      }
    }
  }

  /** Floyd–Steinberg error diffusion on the grid, then one dot per cell. */
  private floyd(w: number, h: number, spacing: number, minR: number, maxR: number): void {
    const ctx = this.procCtx;
    const lum = this.lum;
    const gw = Math.max(1, Math.ceil(w / spacing));
    const gh = Math.max(1, Math.ceil(h / spacing));
    const err = this.err;
    const cells = gw * gh;
    if (err.length < cells) {
      this.err = new Float32Array(cells);
    }
    const buf = this.err.length >= cells ? this.err : new Float32Array(cells);

    for (let row = 0; row < gh; row++) {
      for (let col = 0; col < gw; col++) {
        const x = col * spacing + spacing * 0.5;
        const y = row * spacing + spacing * 0.5;
        buf[row * gw + col] = bilinear(lum, w, h, x, y);
      }
    }

    for (let row = 0; row < gh; row++) {
      for (let col = 0; col < gw; col++) {
        const i = row * gw + col;
        const old = buf[i];
        const next = old >= 0.5 ? 1 : 0;
        buf[i] = next;
        const e = old - next;
        if (col + 1 < gw) buf[i + 1] += e * 0.4375; // 7/16
        if (row + 1 < gh) {
          if (col > 0) buf[i + gw - 1] += e * 0.1875; // 3/16
          buf[i + gw] += e * 0.3125; // 5/16
          if (col + 1 < gw) buf[i + gw + 1] += e * 0.0625; // 1/16
        }
      }
    }

    const baseR = Math.max(0.35, minR > 0 ? minR : maxR * 0.45);
    for (let row = 0; row < gh; row++) {
      for (let col = 0; col < gw; col++) {
        if (buf[row * gw + col] < 0.5) continue;
        const x = col * spacing + spacing * 0.5;
        const y = row * spacing + spacing * 0.5;
        const Y = bilinear(lum, w, h, x, y);
        const r = baseR + (maxR - baseR) * Y * 0.4;
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, TWO_PI);
      }
    }
  }

  /** Hard cutoff after tone-map; remaining cells get size-mapped dots. */
  private thresholdDots(
    w: number,
    h: number,
    spacing: number,
    minR: number,
    maxR: number,
  ): void {
    const ctx = this.procCtx;
    const lum = this.lum;
    const cols = Math.ceil(w / spacing);
    const rows = Math.ceil(h / spacing);

    for (let row = 0; row < rows; row++) {
      const y = row * spacing + spacing * 0.5;
      const xOff = (row & 1) * spacing * 0.5;
      for (let col = 0; col < cols; col++) {
        const x = col * spacing + spacing * 0.5 + xOff;
        const Y = bilinear(lum, w, h, x, y);
        if (Y < 0.5) continue;
        const r = minR + (maxR - minR) * Math.sqrt(Y);
        if (r < 0.22) continue;
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, TWO_PI);
      }
    }
  }

  /** Position-hashed density. Stable across frames, organic look. */
  private stipple(
    w: number,
    h: number,
    spacing: number,
    minR: number,
    maxR: number,
  ): void {
    const ctx = this.procCtx;
    const lum = this.lum;
    const cols = Math.ceil(w / spacing);
    const rows = Math.ceil(h / spacing);

    for (let row = 0; row < rows; row++) {
      const y = row * spacing + spacing * 0.5;
      const xOff = (row & 1) * spacing * 0.5;
      for (let col = 0; col < cols; col++) {
        const x = col * spacing + spacing * 0.5 + xOff;
        const Y = bilinear(lum, w, h, x, y);
        if (Y < 0.02) continue;
        // Keep dots whose hash falls below brightness — denser in highlights.
        if (hash2d(col, row) > Y) continue;
        const r = minR + (maxR - minR) * Math.sqrt(Y);
        if (r < 0.22) continue;
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, TWO_PI);
      }
    }
  }

  private composite(
    dest: CanvasRenderingContext2D,
    destW: number,
    destH: number,
    sourceW: number,
    sourceH: number,
    options: ProcessOptions,
  ): void {
    dest.fillStyle = "#000000";
    dest.fillRect(0, 0, destW, destH);

    const rect = fitRect(sourceW, sourceH, destW, destH, options.fit);

    if (options.viewMode === "original") {
      dest.imageSmoothingEnabled = true;
      dest.drawImage(this.original, rect.x, rect.y, rect.w, rect.h);
      return;
    }

    if (options.viewMode === "processed") {
      dest.imageSmoothingEnabled = true;
      dest.drawImage(this.proc, rect.x, rect.y, rect.w, rect.h);
      return;
    }

    const splitX = Math.max(0, Math.min(destW, destW * options.split));

    dest.save();
    dest.beginPath();
    dest.rect(0, 0, splitX, destH);
    dest.clip();
    dest.imageSmoothingEnabled = true;
    dest.drawImage(this.original, rect.x, rect.y, rect.w, rect.h);
    dest.restore();

    dest.save();
    dest.beginPath();
    dest.rect(splitX, 0, destW - splitX, destH);
    dest.clip();
    dest.imageSmoothingEnabled = true;
    dest.drawImage(this.proc, rect.x, rect.y, rect.w, rect.h);
    dest.restore();

    dest.fillStyle = "rgba(255,255,255,0.85)";
    dest.fillRect(splitX - 1, 0, 2, destH);
    dest.fillStyle = "#ffffff";
    dest.beginPath();
    dest.arc(splitX, destH * 0.5, 7, 0, TWO_PI);
    dest.fill();
    dest.fillStyle = "#111";
    dest.beginPath();
    dest.arc(splitX, destH * 0.5, 2.5, 0, TWO_PI);
    dest.fill();
  }
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds % 60);
  const m = Math.floor(seconds / 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function pickRecorderMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4;codecs=h264",
    "video/mp4",
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return "";
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function cameraErrorMessage(err: unknown): { status: "denied" | "unavailable" | "error"; message: string } {
  const name = err && typeof err === "object" && "name" in err ? String((err as { name: string }).name) : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return {
      status: "denied",
      message: "Camera permission was denied. Allow camera access in the browser and try again.",
    };
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return {
      status: "unavailable",
      message: "No camera was found on this device.",
    };
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return {
      status: "error",
      message: "The camera is already in use by another application.",
    };
  }
  if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") {
    return {
      status: "error",
      message: "This camera does not support the requested settings. Try the other lens.",
    };
  }
  if (name === "SecurityError") {
    return {
      status: "error",
      message: "Camera access requires a secure context (HTTPS).",
    };
  }
  return {
    status: "error",
    message: "Could not start the camera. Check permissions and try again.",
  };
}
