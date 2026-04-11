/**
 * smileProcessor.worker.js
 * Runs ALL heavy pixel operations in a dedicated Web Worker.
 *
 * Messages IN  (from main thread):
 *   { type: "PROCESS", imageData: ImageData, treatment: string, landmarks: Array|null }
 *
 * Messages OUT (to main thread):
 *   { type: "PROGRESS", log: string }
 *   { type: "DONE",     imageData: ImageData }
 *   { type: "ERROR",    message: string }
 */

// ── Constants ────────────────────────────────────────────────────────────────
const ENAMEL_LUM_MIN  = 18;
const ENAMEL_LUM_MAX  = 248;
const ENAMEL_SAT_MAX  = 0.52;
const TEETH_WHITEN_MASK_INDICES = [
  78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 
  324, 318, 402, 317, 14, 87, 178, 88, 95
];

function log(msg) { self.postMessage({ type: "PROGRESS", log: msg }); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ── Ray-cast point-in-polygon ─────────────────────────────────────────────────
function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-6) + xi)
      inside = !inside;
  }
  return inside;
}

function buildBitmapMask(poly, iw, ih) {
  const mask = new Uint8Array(iw * ih);
  if (!poly || poly.length < 3) return mask;
  const xs = poly.map(p => p.x), ys = poly.map(p => p.y);
  const minX = Math.max(0, Math.floor(Math.min(...xs)));
  const maxX = Math.min(iw - 1, Math.ceil(Math.max(...xs)));
  const minY = Math.max(0, Math.floor(Math.min(...ys)));
  const maxY = Math.min(ih - 1, Math.ceil(Math.max(...ys)));
  for (let py = minY; py <= maxY; py++)
    for (let px = minX; px <= maxX; px++)
      if (pointInPoly(px, py, poly)) mask[py * iw + px] = 1;
  return mask;
}

function getMaskPoints(landmarks, iw, ih, extraInset = 0) {
  const pts = TEETH_WHITEN_MASK_INDICES.map(idx => {
    const p = landmarks[idx];
    if (!p || typeof p.x !== "number") return null;
    return { x: p.x * iw, y: p.y * ih };
  }).filter(Boolean);
  if (pts.length < 3) return null;
  if (extraInset > 0) {
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    pts.forEach(p => {
      const dx = p.x - cx, dy = p.y - cy;
      const len = Math.hypot(dx, dy) || 1;
      p.x -= (dx / len) * extraInset;
      p.y -= (dy / len) * extraInset;
    });
  }
  return pts;
}

// ── RGB ↔ HSL helpers ────────────────────────────────────────────────────────
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0)
        : max === g ? (b - r) / d + 2
        : (r - g) / d + 4;
  h /= 6;
  return [h, s, l];
}

function hslToRgb(h, s, l) {
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  return [
    Math.round(hue2rgb(p, q, h + 1/3) * 255),
    Math.round(hue2rgb(p, q, h)       * 255),
    Math.round(hue2rgb(p, q, h - 1/3) * 255),
  ];
}

// --- Whitening Logic removed per CRITICAL ARCHITECTURE REVERT (Mandate 1) ---


// ── Alignment Warp ───────────────────────────────────────────────────────────
function sampleRGBA(src, sw, sh, x, y) {
  const px = clamp(x, 0, sw - 1), py = clamp(y, 0, sh - 1);
  const x0 = Math.floor(px), y0 = Math.floor(py);
  const x1 = Math.min(sw - 1, x0 + 1), y1 = Math.min(sh - 1, y0 + 1);
  const tx = px - x0, ty = py - y0;
  const i00 = (y0 * sw + x0) * 4, i10 = (y0 * sw + x1) * 4;
  const i01 = (y1 * sw + x0) * 4, i11 = (y1 * sw + x1) * 4;
  const out = [0, 0, 0, 255];
  for (let k = 0; k < 3; k++) {
    const a = src[i00 + k] * (1 - tx) + src[i10 + k] * tx;
    const bb = src[i01 + k] * (1 - tx) + src[i11 + k] * tx;
    out[k] = a * (1 - ty) + bb * ty;
  }
  return out;
}

function applyAlignmentWarp(srcData, iw, ih, maskPoly, landmarks, treatment) {
  const out = new Uint8ClampedArray(srcData);
  const mask = maskPoly ? buildBitmapMask(maskPoly, iw, ih) : null;
  if (!mask) return out;

  const lipU = landmarks[13], lipL = landmarks[14];
  const midYNorm = lipU && lipL ? (lipU.y + lipL.y) * 0.5 : 0.55;
  const upperCap = Math.floor(clamp(midYNorm * ih - 2, 0, ih - 1));

  const topEdge = new Float32Array(iw).fill(1e9);
  const valid   = new Uint8Array(iw);
  for (let cx = 0; cx < iw; cx++) {
    for (let cy = 0; cy <= upperCap; cy++) {
      if (!mask[cy * iw + cx]) continue;
      const i = (cy * iw + cx) * 4;
      const r = srcData[i], g = srcData[i+1], b = srcData[i+2];
      const maxc = Math.max(r,g,b), minc = Math.min(r,g,b);
      const lum = 0.2126*r + 0.7152*g + 0.0722*b;
      const sat = maxc === 0 ? 0 : (maxc - minc) / maxc;
      if (lum >= ENAMEL_LUM_MIN && lum <= ENAMEL_LUM_MAX && sat <= ENAMEL_SAT_MAX) {
        topEdge[cx] = cy; valid[cx] = 1; break;
      }
    }
  }

  const smoothTop = new Float32Array(iw);
  for (let cx = 0; cx < iw; cx++) {
    const vals = [];
    for (let k = -3; k <= 3; k++) {
      const ix = clamp(cx + k, 0, iw - 1);
      if (valid[ix]) vals.push(topEdge[ix]);
    }
    if (vals.length) { vals.sort((a,b) => a-b); smoothTop[cx] = vals[Math.floor(vals.length/2)]; }
    else smoothTop[cx] = upperCap * 0.62;
  }

  const midX = iw * 0.5;
  const frontL = Math.floor(iw * 0.34), frontR = Math.ceil(iw * 0.66);
  let targetY = 0, targetN = 0;
  for (let cx = frontL; cx <= frontR; cx++) {
    if (!valid[cx]) continue; targetY += smoothTop[cx]; targetN++;
  }
  targetY = targetN ? targetY / targetN : upperCap * 0.6;

  const archAmp = clamp((treatment === "transformation" ? 0.09 : 0.03) * iw, 2, 14);
  const dyCol = new Float32Array(iw), dxCol = new Float32Array(iw);
  for (let cx = 0; cx < iw; cx++) {
    const u = (cx - midX) / Math.max(iw * 0.5, 1);
    dyCol[cx] = clamp((targetY + archAmp * u * u - smoothTop[cx]) * 0.85, -6.5, 6.5);
    const slope = (smoothTop[clamp(cx+1,0,iw-1)] - smoothTop[clamp(cx-1,0,iw-1)]) * 0.5;
    dxCol[cx] = clamp(-slope * 0.14, -1.1, 1.1);
  }

  for (let cy = 0; cy < ih; cy++) {
    for (let cx = 0; cx < iw; cx++) {
      const oi = (cy * iw + cx) * 4;
      if (!mask[cy * iw + cx] || cy > upperCap) continue;
      const top = smoothTop[cx];
      const depth = clamp((cy - top) / Math.max(upperCap - top + 1, 1), 0, 1);
      const ww = 1 - depth;
      const tdx = dxCol[cx] * (0.2 + 0.8 * ww);
      const tdy = dyCol[cx] * (0.28 + 0.72 * ww);
      const slope = (smoothTop[clamp(cx+1,0,iw-1)] - smoothTop[clamp(cx-1,0,iw-1)]) * 0.5;
      const thetaBase = treatment === "alignment" ? 0.16 : 0.32;
      const theta = -Math.atan(slope) * (1 - depth) * thetaBase;
      const vx = -tdx, vy = cy - top - tdy;
      const cosT = Math.cos(theta), sinT = Math.sin(theta);
      const sx = Math.round(cx + vx * cosT + vy * sinT);
      const sy = Math.round(top + (-vx * sinT + vy * cosT));
      const smp = (sx >= 0 && sx < iw && sy >= 0 && sy < ih && mask[sy * iw + sx])
        ? sampleRGBA(srcData, iw, ih, sx, sy)
        : sampleRGBA(srcData, iw, ih, cx, cy);
      const isGum = smp[0] > 135 && smp[0] / Math.max(smp[1],1) > 1.22 && smp[0] / Math.max(smp[2],1) > 1.22;
      if (!isGum) { out[oi]=smp[0]; out[oi+1]=smp[1]; out[oi+2]=smp[2]; out[oi+3]=smp[3]; }
    }
  }
  return out;
}

// ── Message Handler ──────────────────────────────────────────────────────────
self.onmessage = function(e) {
  const { type, imageData, treatment, landmarks } = e.data;
  if (type !== "PROCESS") return;

  try {
    const { data, width: iw, height: ih } = imageData;
    let processed = new Uint8ClampedArray(data);

    // Use a tighter inset (2px) for the mask — less gum bleed
    const maskPoly = landmarks ? getMaskPoints(landmarks, iw, ih, 2) : null;

    // Step 2: Alignment warp (Whitening moved to main thread per Mandate 2)
    if (["alignment", "transformation"].includes(treatment)) {
      log("Realigning tooth geometry...");
      if (landmarks && maskPoly) {
        processed = applyAlignmentWarp(processed, iw, ih, maskPoly, landmarks, treatment);
      }
    }

    log("Finalizing simulation...");
    const resultImageData = new ImageData(processed, iw, ih);
    self.postMessage({ type: "DONE", imageData: resultImageData }, [resultImageData.data.buffer]);
  } catch (err) {
    self.postMessage({ type: "ERROR", message: err?.message || "Worker processing failed" });
  }
};
