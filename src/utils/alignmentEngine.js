/**
 * ALIGNMENT ENGINE: PRODUCTION-GRADE ORTHODONTIC CORE
 * High-Visibility, Bilinear Interpolated Shift with Anatomical Depth Protection
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
  const sourceData = new Uint8ClampedArray(imageData.data);
  const newData = new Uint8ClampedArray(sourceData);

  // 🎯 CLINICAL PARAMETERS
  const localMidY = archMidY - minY;
  const upperBand = archMidY - boxH * 0.18;
  const lowerBand = archMidY + boxH * 0.18;

  for (let y = 0; y < boxH; y++) {
    for (let x = 0; x < boxW; x++) {

      const globalY = y + minY;
      if (globalY < upperBand || globalY > lowerBand) continue;

      const i = (y * boxW + x) * 4;
      const gx = x + minX;

      // 🧠 1. DEPTH PRESERVATION MASK (Protect natural shadows)
      const lum = (sourceData[i] + sourceData[i+1] + sourceData[i+2]) / 3;
      if (lum < 65) {
        newData[i]     = sourceData[i];
        newData[i+1]   = sourceData[i+1];
        newData[i+2]   = sourceData[i+2];
        newData[i+3]   = 255;
        continue;
      }

      // 🧠 2. STRONG ARCH CURVE
      const dxRel = (gx - centerX) / (boxW / 2);
      const curve = dxRel * dxRel;
      const targetY = localMidY + (boxH * 0.07) * curve;

      // 💥 3. FORCE VERTICAL MOVEMENT + HARMONIC JITTER
      let dy = (targetY - y) * 1.45;
      dy += Math.sin(gx * 0.05) * 0.3; // Micro-jitter for anatomical realism

      if (Math.abs(dy) < 2.2) dy = dy > 0 ? 2.2 : -2.2;

      // 🧠 4. NON-LINEAR HORIZONTAL STRAIGHTENING
      let dx = -dxRel * 2.8 * (1 - Math.abs(dxRel));
      dx += (dx > 0 ? 0.4 : -0.4); 
      dx = Math.max(-3, Math.min(3, dx));

      // 🎯 5. SAMPLING BOUNDS GUARD
      const sx = Math.max(0, Math.min(boxW - 1, x - dx));
      const sy = Math.max(0, Math.min(boxH - 1, y - dy));

      // 🧪 6. TRUE BILINEAR INTERPOLATION (4-PIXEL ANCHOR)
      const x1 = Math.floor(sx);
      const x2 = Math.min(x1 + 1, boxW - 1);
      const y1 = Math.floor(sy);
      const y2 = Math.min(y1 + 1, boxH - 1);

      const tx = sx - x1;
      const ty = sy - y1;

      const i11 = (y1 * boxW + x1) * 4;
      const i21 = (y1 * boxW + x2) * 4;
      const i12 = (y2 * boxW + x1) * 4;
      const i22 = (y2 * boxW + x2) * 4;

      for (let c = 0; c < 3; c++) {
        let v =
          sourceData[i11 + c] * (1 - tx) * (1 - ty) +
          sourceData[i21 + c] * tx * (1 - ty) +
          sourceData[i12 + c] * (1 - tx) * ty +
          sourceData[i22 + c] * tx * ty;

        // ✨ 7. SELECTIVE ENAMEL CONTRAST
        if (lum > 80) {
          const contrast = 1.06;
          v = (v - 128) * contrast + 128;
        }

        newData[i + c] = Math.max(0, Math.min(255, v));
      }
      newData[i + 3] = 255;
    }
  }

  // ✅ APPLY FINAL RENDER
  imageData.data.set(newData);
  ctx.putImageData(imageData, minX, minY); 
}

/**
 * Main Entry Point - Multi-Arch Alignment
 */
export function applyAlignment(ctx, landmarks, w, h) {
  processArch(ctx, landmarks, w, h, UPPER_ARCH_INDICES);
  processArch(ctx, landmarks, w, h, LOWER_ARCH_INDICES);
}
