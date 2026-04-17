/**
 * ALIGNMENT ENGINE: Clinical Orthodontic Transformation (Geometry Only)
 * 1. Landmark-Based Influence (Gaussian Falloff)
 * 2. High-Force Parabolic Arch Alignment
 * 3. True Tooth Targeting (Horizontal Snapping)
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
  const minX = Math.floor(Math.min(...xs)) - 30;
  const maxX = Math.ceil(Math.max(...xs)) + 30;
  const minY = Math.floor(Math.min(...ys)) - 45; 
  const maxY = Math.ceil(Math.max(...ys)) + 45;
  const boxW = maxX - minX, boxH = maxY - minY;
  if (boxW <= 0 || boxH <= 0) return;

  const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
  const archMidY = ys.reduce((s, p) => s + p, 0) / ys.length;

  const imageData = ctx.getImageData(minX, minY, boxW, boxH);
  const data = imageData.data;
  const sourceData = new Uint8ClampedArray(data);
  const newData = new Uint8ClampedArray(sourceData);

  // TOOTH CENTERS (Influence Anchors)
  const centers = points.map(p => ({ x: p.x - minX, y: p.y - minY, gx: p.x }));
  const radiusSq = Math.pow(boxW * 0.15, 2); // Influence radius

  for (let y = 0; y < boxH; y++) {
    const gy = y + minY;
    
    for (let x = 0; x < boxW; x++) {
      const gx = x + minX;

      // A. WEIGHT PIXEL INFLUENCE (Precise Gaussian)
      let minDistSq = Infinity;
      let nearestTooth = null;
      for (let i = 0; i < centers.length; i++) {
        const dX = x - centers[i].x, dY = y - centers[i].y;
        const dSq = dX * dX + dY * dY;
        if (dSq < minDistSq) { 
          minDistSq = dSq; 
          nearestTooth = centers[i];
        }
      }
      
      // Clinical Weight: Only move what is VERY close to a landmark
      let weight = Math.exp(-minDistSq / radiusSq);
      
      // HARD RADIUS CUTOFF: Protect Lips/Mustache
      // If weight is too low, don't move at all
      if (weight < 0.15) continue;
      
      // Normalize weight range for smoother blending at edges [0.15, 1.0] -> [0, 1.0]
      const smoothWeight = (weight - 0.15) / 0.85;

      // B. PARABOLIC ARCH ALIGNMENT (Vertical Force)
      const dxRel = (gx - centerX) / (boxW / 2);
      const targetY = archMidY + (boxH * 0.035) * (dxRel * dxRel);
      
      let dy = (targetY - gy) * 1.1 * smoothWeight;
      
      // C. TRUE TOOTH TARGETING (Horizontal Alignment)
      let dx = (nearestTooth.gx - gx) * 0.35 * smoothWeight;
      dx = clamp(dx, -3.0, 3.0);

      // D. MICRO-ROTATION
      const angle = dxRel * 0.16 * smoothWeight;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      
      const cx = nearestTooth.x;
      const cy = nearestTooth.y;

      // Backward Coordinate Mapping (Sub-pixel precise)
      const sx_rot = cosA * (x - cx) - sinA * (y - cy) + cx;
      const sy_rot = sinA * (x - cx) + cosA * (y - cy) + cy;

      // Combined displacement vector
      let sx = sx_rot - dx;
      let sy = sy_rot - dy;

      // E. COORDINATE SAFETY CLAMP (Prevents Black Streaks)
      sx = clamp(sx, 0, boxW - 1.001);
      sy = clamp(sy, 0, boxH - 1.001);

      // F. BILINEAR INTERPOLATION (Backward Sampling)
      const x1 = Math.floor(sx), x2 = x1 + 1, tx = sx - x1;
      const y1 = Math.floor(sy), y2 = y1 + 1, ty = sy - y1;

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
      // Keep original alpha
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
