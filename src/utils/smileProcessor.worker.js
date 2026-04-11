/**
 * smileProcessor.worker.js
 * Runs ALL heavy pixel operations (whitening, alignment warp, mask building)
 * in a dedicated Web Worker so the main thread can never crash or freeze.
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
const ENAMEL_LUM_MIN  = 15;
const ENAMEL_LUM_MAX  = 252;
const ENAMEL_SAT_MAX  = 0.58;
const OVAL_FEATHER_PX = 16;
const TEETH_WHITEN_MASK_INDICES = [
  61, 185, 40, 39, 37, 0, 267, 270, 269, 409, 291,
  375, 321, 405, 314, 17, 84, 181, 91, 146,
];

function log(msg) { self.postMessage({ type: "PROGRESS", log: msg }); }

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

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
  for (let py = minY; py <= maxY; py++) {
    for (let px = minX; px <= maxX; px++) {
      if (pointInPoly(px, py, poly)) mask[py * iw + px] = 1;
    }
  }
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
    const b = src[i01 + k] * (1 - tx) + src[i11 + k] * tx;
    out[k] = a * (1 - ty) + b * ty;
  }
  return out;
}

// ── Whitening Pass ───────────────────────────────────────────────────────────
function applyWhitening(srcData, iw, ih, maskPoly, strength = 0.38) {
  const out = new Uint8ClampedArray(srcData);
  const mask = maskPoly ? buildBitmapMask(maskPoly, iw, ih) : null;

  const xs = maskPoly?.map(p => p.x) ?? [0], ys = maskPoly?.map(p => p.y) ?? [0];
  const minX = Math.max(0, Math.floor(Math.min(...xs)) - 5);
  const maxX = Math.min(iw - 1, Math.ceil(Math.max(...xs)) + 5);
  const minY = Math.max(0, Math.floor(Math.min(...ys)) - 5);
  const maxY = Math.min(ih - 1, Math.ceil(Math.max(...ys)) + 5);

  for (let py = minY; py <= maxY; py++) {
    for (let px = minX; px <= maxX; px++) {
      if (mask && !mask[py * iw + px]) continue;
      const i = (py * iw + px) * 4;
      const r = srcData[i], g = srcData[i + 1], b = srcData[i + 2];

      // Red gate — skip gum/lip pixels
      const redExcess = r / Math.max(g, 1);
      if (r > 105 && (redExcess > 1.18 || r / Math.max(b, 1) > 1.22)) continue;

      const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      if (lum < 0.04) continue;

      const lumFactor = Math.pow(1 - lum, 0.5);
      const alpha = clamp(strength * (0.85 + 0.4 * lumFactor), 0, 1);

      // Soft-light blend: pull toward white
      out[i]     = clamp(Math.round(r + (255 - r) * alpha * 0.55), 0, 255);
      out[i + 1] = clamp(Math.round(g + (255 - g) * alpha * 0.55), 0, 255);
      out[i + 2] = clamp(Math.round(b + (250 - b) * alpha * 0.45), 0, 255);
    }
  }
  return out;
}

// ── Alignment Warp ───────────────────────────────────────────────────────────
function applyAlignmentWarp(srcData, iw, ih, maskPoly, landmarks, treatment) {
  const out = new Uint8ClampedArray(srcData);
  const mask = maskPoly ? buildBitmapMask(maskPoly, iw, ih) : null;
  if (!mask) return out;

  const lipU = landmarks[13], lipL = landmarks[14];
  const midYNorm = lipU && lipL ? (lipU.y + lipL.y) * 0.5 : 0.55;
  const upperCap = Math.floor(clamp(midYNorm * ih - 2, 0, ih - 1));

  // Find enamel top edge per column
  const topEdge = new Float32Array(iw).fill(1e9);
  const valid    = new Uint8Array(iw);
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

  // Median-smooth top edge
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

  // Inverse warp
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
      const isGum = smp[0] > 140 && smp[0] / Math.max(smp[1],1) > 1.25 && smp[0] / Math.max(smp[2],1) > 1.25;
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

    const maskPoly = landmarks ? getMaskPoints(landmarks, iw, ih, 3) : null;

    // Step 1: Whitening
    if (["whitening", "transformation", "braces"].includes(treatment)) {
      log("Applying clinical whitening...");
      processed = applyWhitening(processed, iw, ih, maskPoly, 0.4);
    }

    // Step 2: Alignment warp
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
