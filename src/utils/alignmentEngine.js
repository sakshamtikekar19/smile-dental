/**
 * ALIGNMENT ENGINE: Clinical Orthodontic Transformation (Geometry Only)
 * 1. Landmark-Based Influence (Gaussian Falloff)
 * 2. Parabolic Arch Alignment
 * 3. Micro-Rotation Alignment (Tilt Correction)
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

      // B. PARABOLIC ARCH ALIGNMENT
      const dxRel = (gx - centerX) / (boxW / 2);
      const targetY = archMidY + (boxH * 0.035) * (dxRel * dxRel);
      
      let dy = (targetY - gy) * 0.9 * weight;
      if (Math.abs(dy) < 1.2 && weight > 0.4) {
        dy = Math.sign(dy) * 1.2;
      }

      // C. MICRO-ROTATION (Angle simulation)
      const angle = dxRel * 0.08 * weight;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      
      const cx = centers[nearestIdx].x;
      const cy = centers[nearestIdx].y;

      // Backward Coordinate Mapping
      const rx = cosA * (x - cx) - sinA * (y - cy) + cx;
      const ry = sinA * (x - cx) + cosA * (y - cy) + cy;

      const sx = rx;
      const sy = ry - dy;

      // D. BILINEAR INTERPOLATION (Backward Sampling)
      const x1 = Math.floor(sx), x2 = Math.min(x1 + 1, boxW - 1), tx = sx - x1;
      const y1 = Math.floor(sy), y2 = Math.min(y1 + 1, boxH - 1), ty = sy - y1;

      if (x1 < 0 || x1 >= boxW || y1 < 0 || y1 >= boxH) continue;

      const getRGBA = (px, py) => {
        const i = (py * boxW + px) * 4;
        return [sourceData[i], sourceData[i+1], sourceData[i+2], sourceData[i+3]];
      };

      const c00 = getRGBA(x1, y1);
      const c10 = getRGBA(x2, y1);
      const c01 = getRGBA(x1, y2);
      const c11 = getRGBA(x2, y2);

      const lerp = (v1, v2, t) => v1 * (1 - t) + v2 * t;
      const b0 = lerp(c00[0], c10[0], tx), b1 = lerp(c01[0], c11[0], tx), rVal = lerp(b0, b1, ty);
      const g0 = lerp(c00[1], c10[1], tx), g1 = lerp(c01[1], c11[1], tx), gVal = lerp(g0, g1, ty);
      const bl0 = lerp(c00[2], c10[2], tx), bl1 = lerp(c01[2], c11[2], tx), bVal = lerp(bl0, bl1, ty);

      const outIdx = (y * boxW + x) * 4;
      newData[outIdx]     = rVal;
      newData[outIdx + 1] = gVal;
      newData[outIdx + 2] = bVal;
      newData[outIdx + 3] = sourceData[outIdx + 3]; // Preserve original alpha
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
