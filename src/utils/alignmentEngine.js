/**
 * ALIGNMENT ENGINE: LOCAL MODE (PRODUCTION)
 * Coordinate-Locked Orthodontic Core for Orchestra Stabilizer
 */

const UPPER_ARCH_INDICES = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291];
const LOWER_ARCH_INDICES = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291];

/**
 * 🚀 Transformation pass optimized for Stabilized Local Context
 * @param {CanvasRenderingContext2D} ctx - The local stabilizer canvas
 * @param {Array} landmarks - Face landmarks (0-1 range)
 * @param {number} vW - Video width (used for landmark scaling)
 * @param {number} vH - Video height (used for landmark scaling)
 * @param {Object} anchor - {x, y} in video pixels representing stabilizer center (168/13)
 */
function processArch(ctx, landmarks, vW, vH, indices, anchor) {
  const points = indices.map(i => ({ 
    x: (landmarks[i].x * vW) - anchor.x + (ctx.canvas.width / 2), 
    y: (landmarks[i].y * vH) - anchor.y + (ctx.canvas.height * 0.1) // Adjusted for -10% Y-offset
  }));
  
  const xs = points.map(p => p.x), ys = points.map(p => p.y);

  // 1. CALCULATE LOCAL BOUNDS
  const minX = Math.floor(Math.min(...xs)) - 30;
  const maxX = Math.ceil(Math.max(...xs)) + 30;
  const minY = Math.floor(Math.min(...ys)) - 40; 
  const maxY = Math.ceil(Math.max(...ys)) + 40;
  const boxW = maxX - minX, boxH = maxY - minY;
  
  if (boxW <= 0 || boxH <= 0) return;

  const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
  const archMidY = ys.reduce((s, p) => s + p, 0) / ys.length;

  // Clip to canvas limits
  const safeX = Math.max(0, minX);
  const safeY = Math.max(0, minY);
  const safeW = Math.min(ctx.canvas.width - safeX, boxW);
  const safeH = Math.min(ctx.canvas.height - safeY, boxH);

  if (safeW <= 0 || safeH <= 0) return;

  const imageData = ctx.getImageData(safeX, safeY, safeW, safeH);
  const sourceData = new Uint8ClampedArray(imageData.data);
  const newData = new Uint8ClampedArray(sourceData);

  const localMidY = archMidY - safeY;
  const upperBand = archMidY - safeH * 0.22; // Slightly wider for stabilizer
  const lowerBand = archMidY + safeH * 0.22;

  for (let y = 0; y < safeH; y++) {
    for (let x = 0; x < safeW; x++) {
      const globalY = y + safeY;
      if (globalY < upperBand || globalY > lowerBand) continue;

      const i = (y * safeW + x) * 4;
      const gx = x + safeX;

      // 🧠 DEPTH PRESERVATION MASK (Restored for production)
      const lum = (sourceData[i] + sourceData[i+1] + sourceData[i+2]) / 3;
      if (lum < 60) continue;

      const dxRel = (gx - centerX) / (safeW / 2);
      const curve = dxRel * dxRel;
      const targetY = localMidY + (safeH * 0.08) * curve;

      // 💥 FORCE VECTORS
      let dy = (targetY - y) * 1.45;
      dy += Math.sin(gx * 0.05) * 0.3; // Anatomical Jitter
      if (Math.abs(dy) < 2.2) dy = dy > 0 ? 2.2 : -2.2;

      let dx = -dxRel * 2.8 * (1 - Math.abs(dxRel));
      dx += (dx > 0 ? 0.4 : -0.4); 
      dx = Math.max(-3, Math.min(3, dx));

      const sx = Math.max(0, Math.min(safeW - 1, x - dx));
      const sy = Math.max(0, Math.min(safeH - 1, y - dy));

      const x1 = Math.floor(sx), x2 = Math.min(x1 + 1, safeW - 1);
      const y1 = Math.floor(sy), y2 = Math.min(y1 + 1, safeH - 1);
      const tx = sx - x1, ty = sy - y1;

      const i11 = (y1 * safeW + x1) * 4, i21 = (y1 * safeW + x2) * 4;
      const i12 = (y2 * safeW + x1) * 4, i22 = (y2 * safeW + x2) * 4;

      for (let c = 0; c < 3; c++) {
        let v = sourceData[i11+c]*(1-tx)*(1-ty) + sourceData[i21+c]*tx*(1-ty) +
                sourceData[i12+c]*(1-tx)*ty + sourceData[i22+c]*tx*ty;
        if (lum > 80) v = (v - 128) * 1.06 + 128; // Selective Contrast
        newData[i + c] = Math.max(0, Math.min(255, v));
      }
      newData[i + 3] = 255;
    }
  }

  imageData.data.set(newData);
  ctx.putImageData(imageData, safeX, safeY); 
}

/**
 * Orchestrates alignment in local stabilizer coordinates
 * @param {CanvasRenderingContext2D} ctx - The local stabilized canvas
 * @param {Array} landmarks - Global landmarks
 * @param {number} w - Video Width
 * @param {number} h - Video Height
 * @param {Object} options - { anchor: {x, y} }
 */
export function applyAlignment(ctx, landmarks, w, h, options = {}) {
  const anchor = options.anchor || { x: w / 2, y: h / 2 };
  processArch(ctx, landmarks, w, h, UPPER_ARCH_INDICES, anchor);
  processArch(ctx, landmarks, w, h, LOWER_ARCH_INDICES, anchor);
}
