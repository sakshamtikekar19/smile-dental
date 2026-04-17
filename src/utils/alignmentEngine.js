/**
 * ALIGNMENT ENGINE: Clinical Orthodontic Transformation (Geometry Only)
 * 1. Landmark-Based Influence (Gaussian Falloff)
 * 2. High-Force Parabolic Arch Alignment
 * 3. Horizontal Spacing Correction
 * 4. Micro-Rotation Alignment (Tilt Correction)
 */

const UPPER_ARCH_INDICES = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291];
const LOWER_ARCH_INDICES = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291];

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/**
 * 🚀 Internal transformation pass for a specific arch
 */
function processArch(ctx, landmarks, w, h, indices) {
  const points = indices.map(i => ({ x: landmarks[i].x * w, y: landmarks[i].y * h }));
  const xs = points.map(p => p.x), ys = points.map(p => p.y);

  // 1. CALCULATE BOUNDS
  const minX = Math.floor(Math.min(...xs)) - 5;
  const maxX = Math.ceil(Math.max(...xs)) + 5;
  const minY = Math.floor(Math.min(...ys)) - 35; 
  const maxY = Math.ceil(Math.max(...ys)) + 35;
  const boxW = maxX - minX, boxH = maxY - minY;
  if (boxW <= 0 || boxH <= 0) return;

  const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
  const archMidY = ys.reduce((s, p) => s + p, 0) / ys.length;

  const imageData = ctx.getImageData(minX, minY, boxW, boxH);
  const data = imageData.data;
  const sourceData = new Uint8ClampedArray(data);
  const newData = new Uint8ClampedArray(sourceData);

  // REGION LOCK BAND (Surgical Anchor)
  const bandHalfH = boxH * 0.10;
  const upperLockY = archMidY - bandHalfH;
  const lowerLockY = archMidY + bandHalfH;

  // TOOTH CENTERS (Influence Anchors)
  const centers = points.map(p => ({ x: p.x - minX, y: p.y - minY }));
  const radiusSq = Math.pow(boxW * 0.12, 2);

  for (let y = 0; y < boxH; y++) {
    const gy = y + minY;
    // Strict Region Lock
    if (gy < upperLockY || gy > lowerLockY) continue;

    for (let x = 0; x < boxW; x++) {
      const gx = x + minX;

      // A. WEIGHT PIXEL INFLUENCE (Gaussian)
      let minDistSq = Infinity;
      let nearestIdx = 0;
      for (let i = 0; i < centers.length; i++) {
        const dX = x - centers[i].x, dY = y - centers[i].y;
        const dSq = dX * dX + dY * dY;
        if (dSq < minDistSq) { minDistSq = dSq; nearestIdx = i; }
      }
      let weight = Math.exp(-minDistSq / radiusSq);
      weight = Math.max(0.4, weight);

      // B. PARABOLIC ARCH ALIGNMENT (Vertical Force)
      const dxRel = (gx - centerX) / (boxW / 2);
      const targetY = archMidY + (boxH * 0.035) * (dxRel * dxRel);
      
      let dy = (targetY - gy) * 1.1 * weight;
      if (Math.abs(dy) < 1.5 && weight > 0.4) {
        dy = Math.sign(dy) * 1.5;
      }

      // C. HORIZONTAL SPACING CORRECTION
      const targetX = centerX + dxRel * (boxW * 0.42);
      let dx = (targetX - gx) * 0.25 * weight;
      dx = clamp(dx, -2.0, 2.0);

      // D. MICRO-ROTATION (High-Torque Pass)
      const angle = dxRel * 0.16 * weight;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      
      const cx = centers[nearestIdx].x;
      const cy = centers[nearestIdx].y;

      // Backward Coordinate Mapping
      const sx_rot = cosA * (x - cx) - sinA * (y - cy) + cx;
      const sy_rot = sinA * (x - cx) + cosA * (y - cy) + cy;

      // Apply primary displacements
      const sx = sx_rot - dx;
      const sy = sy_rot - dy;

      // E. BILINEAR INTERPOLATION (Backward Sampling)
      const x1 = Math.floor(sx), x2 = Math.min(x1 + 1, boxW - 1), tx = sx - x1;
      const y1 = Math.floor(sy), y2 = Math.min(y1 + 1, boxH - 1), ty = sy - y1;

      if (x1 < 0 || x1 >= boxW || y1 < 0 || y1 >= boxH) continue;

      const i00 = (y1 * boxW + x1) * 4;
      const i10 = (y1 * boxW + x2) * 4;
      const i01 = (y2 * boxW + x1) * 4;
      const i11 = (y2 * boxW + x2) * 4;

      const lerp = (v1, v2, v3, v4, tX, tY) => {
        const top = v1 * (1 - tX) + v2 * tX;
        const bot = v3 * (1 - tX) + v4 * tX;
        return top * (1 - tY) + bot * tY;
      };

      const outIdx = (y * boxW + x) * 4;
      newData[outIdx]     = lerp(sourceData[i00], sourceData[i10], sourceData[i01], sourceData[i11], tx, ty);
      newData[outIdx + 1] = lerp(sourceData[i00+1], sourceData[i10+1], sourceData[i01+1], sourceData[i11+1], tx, ty);
      newData[outIdx + 2] = lerp(sourceData[i00+2], sourceData[i10+2], sourceData[i01+2], sourceData[i11+2], tx, ty);
      newData[outIdx + 3] = sourceData[outIdx + 3];
    }
  }

  imageData.data.set(newData);
  ctx.putImageData(imageData, minX, minY);
}

/**
 * Main Entry Point - Multi-Arch Rigid Recovery
 */
export function applyAlignment(ctx, landmarks, w, h) {
  processArch(ctx, landmarks, w, h, UPPER_ARCH_INDICES);
  processArch(ctx, landmarks, w, h, LOWER_ARCH_INDICES);
}
