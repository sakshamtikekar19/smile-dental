/**
 * ALIGNMENT ENGINE: Forced Orthodontic Shift Baseline
 * Direct Parabolic Geometry with High-Visibility Snap
 */

const UPPER_ARCH_INDICES = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291];
const LOWER_ARCH_INDICES = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291];

/**
 * 🚀 Internal transformation pass for a specific arch
 */
function processArch(ctx, landmarks, w, h, indices) {
  const points = indices.map(i => ({ x: landmarks[i].x * w, y: landmarks[i].y * h }));
  const xs = points.map(p => p.x), ys = points.map(p => p.y);

  // 1. CALCULATE BOUNDS
  const minX = Math.floor(Math.min(...xs)) - 30;
  const maxX = Math.ceil(Math.max(...xs)) + 30;
  const minY = Math.floor(Math.min(...ys)) - 40; 
  const maxY = Math.ceil(Math.max(...ys)) + 40;
  const boxW = maxX - minX, boxH = maxY - minY;
  if (boxW <= 0 || boxH <= 0) return;

  const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
  const archMidY = ys.reduce((s, p) => s + p, 0) / ys.length;

  const imageData = ctx.getImageData(minX, minY, boxW, boxH);
  const data = imageData.data;
  const sourceData = new Uint8ClampedArray(data);

  // 🦷 DEFINE TEETH MASK (Surgical Band)
  const teethMask = new Uint8Array(boxW * boxH);
  const verticalBand = boxH * 0.28;
  for (let y = 0; y < boxH; y++) {
    const gy = y + minY;
    if (Math.abs(gy - archMidY) < verticalBand) {
       for (let x = 0; x < boxW; x++) teethMask[y * boxW + x] = 1;
    }
  }

  // 👉 GUARANTEED VISIBLE MOVEMENT LOOP
  for (let y = 0; y < boxH; y++) {
    for (let x = 0; x < boxW; x++) {

      const idx = y * boxW + x;
      if (!teethMask[idx]) continue;

      const i = idx * 4;
      const gx = x + minX;
      const gy = y + minY;

      // 🎯 STRONG PARABOLIC ARCH
      const dxRel = (gx - centerX) / (boxW / 2);
      const curve = dxRel * dxRel;
      const targetY = archMidY + (boxH * 0.08) * curve;

      // 💥 FORCE MOVEMENT (NO WEIGHT)
      let dy = (targetY - gy) * 1.4;

      // 🚀 HARD SNAP (THIS MAKES IT VISIBLE)
      if (Math.abs(dy) < 2.5) {
        dy = dy > 0 ? 2.5 : -2.5;
      }

      // 🧠 SIMPLE HORIZONTAL CORRECTION
      let dx = -dxRel * 2.0;
      dx = Math.max(-3, Math.min(3, dx));

      // Backward Sampling Coordinates
      const sx = Math.max(0, Math.min(boxW - 1, x - dx));
      const sy = Math.max(0, Math.min(boxH - 1, y - dy));

      const y1 = Math.floor(sy);
      const y2 = Math.min(y1 + 1, boxH - 1);
      const ty = sy - y1;

      const i1 = (y1 * boxW + Math.floor(sx)) * 4;
      const i2 = (y2 * boxW + Math.floor(sx)) * 4;

      data[i]     = sourceData[i1] * (1 - ty) + sourceData[i2] * ty;
      data[i + 1] = sourceData[i1 + 1] * (1 - ty) + sourceData[i2 + 1] * ty;
      data[i + 2] = sourceData[i1 + 2] * (1 - ty) + sourceData[i2 + 2] * ty;
      data[i + 3] = 255;
    }
  }

  ctx.putImageData(imageData, minX, minY);
}

/**
 * Main Entry Point - Multi-Arch Alignment
 */
export function applyAlignment(ctx, landmarks, w, h) {
  processArch(ctx, landmarks, w, h, UPPER_ARCH_INDICES);
  processArch(ctx, landmarks, w, h, LOWER_ARCH_INDICES);
}
