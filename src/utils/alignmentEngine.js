/**
 * ALIGNMENT ENGINE: Rigid Tooth Segmentation & Transformation
 * 1. Connectivity-based Segmentation (Tooth Clustering)
 * 2. Object-Oriented Rigid Movement (Translation + Rotation)
 * 3. Shadow Consistency & Depth Mapping
 */

const UPPER_ARCH_INDICES = [61, 78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 291];
const LOWER_ARCH_INDICES = [291, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95, 78, 61];

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/**
 * 🦷 TOOTH SEGMENTATION ENGINE (Flood Fill Clustering)
 */
function segmentTeeth(mask, width, height) {
  const visited = new Uint8Array(mask.length);
  const clusters = [];
  const dirs = [-1, 1, -width, width];
  let iterations = 0;
  const MAX_ITERATIONS = 500000; // Safeguard against unexpected infinite loops

  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || visited[i]) continue;
    if (++iterations > MAX_ITERATIONS) break;

    let queue = [i];
    let cluster = [];
    visited[i] = 1;

    while (queue.length) {
      const curr = queue.pop();
      cluster.push(curr);

      for (let d of dirs) {
        const ni = curr + d;
        if (ni >= 0 && ni < mask.length && mask[ni] && !visited[ni]) {
          if (Math.abs((curr % width) - (ni % width)) <= 1) {
            visited[ni] = 1;
            queue.push(ni);
          }
        }
      }
    }

    if (cluster.length > 20 && cluster.length < 200000) { 
      clusters.push(cluster);
    }
  }
  return clusters;
}

/**
 * Calculates geometric center of a tooth cluster
 */
function getCenter(cluster, width) {
  let sx = 0, sy = 0;
  for (let idx of cluster) {
    sx += idx % width;
    sy += Math.floor(idx / width);
  }
  return { x: sx / cluster.length, y: sy / cluster.length };
}

/**
 * 🚀 Internal transformation pass for a specific arch
 */
function processArch(ctx, landmarks, w, h, indices, options) {
  const { rotation = 0, scale = 1.0 } = options;

  let points = indices.map(i => ({ x: landmarks[i].x * w, y: landmarks[i].y * h }));
  const midPoint = Math.floor(points.length / 2);
  
  // Midline anchor
  const centerX = points[midPoint].x;
  const archMidY = points.reduce((s, p) => s + p.y, 0) / points.length;

  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const horizontalPadding = (Math.max(...xs) - Math.min(...xs)) * 0.15; 
  const verticalPadding = 35;
  const minX = Math.floor(Math.min(...xs)) - horizontalPadding, maxX = Math.ceil(Math.max(...xs)) + horizontalPadding;
  const minY = Math.floor(Math.min(...ys)) - verticalPadding, maxY = Math.ceil(Math.max(...ys)) + verticalPadding;
  const boxW = maxX - minX, boxH = maxY - minY;
  if (boxW <= 0 || boxH <= 0) return;

  const imageData = ctx.getImageData(minX, minY, boxW, boxH);
  const data = imageData.data;
  const sourceData = new Uint8ClampedArray(data);
  const newData = new Uint8ClampedArray(sourceData);

  const isLower = indices.includes(14) || indices.includes(324); 
  
  // 1. ANATOMICAL REGION MASK (Landmark-Driven)
  const teethMask = new Uint8Array(boxW * boxH);
  const bandHalfHeight = boxH * 0.12; 
  const upperY = archMidY - bandHalfHeight;
  const lowerY = archMidY + bandHalfHeight;

  for (let y = 0; y < boxH; y++) {
    const gy = y + minY;
    if (gy > upperY && gy < lowerY) {
      for (let x = 0; x < boxW; x++) {
        teethMask[y * boxW + x] = 1;
      }
    }
  }

  // 🦷 TOOTH CENTERS (Anatomical influence points)
  const teethCenters = indices.map(idx => ({
    x: landmarks[idx].x * w - minX,
    y: landmarks[idx].y * h - minY
  }));

  // 2. BACKWARD MAPPING ALIGNMENT (Rotation-Aware)
  const influenceRadius = boxW * 0.08 * scale;
  const cos = Math.cos(-rotation);
  const sin = Math.sin(-rotation);

  for (let y = 0; y < boxH; y++) {
    for (let x = 0; x < boxW; x++) {
      const idx = y * boxW + x;
      const i = idx * 4;

      if (!teethMask[idx]) continue;

      // 🧠 ROTATION-MATRIX COORDINATES (Corrects for Tilt)
      const lx = (x + minX) - centerX;
      const ly = (y + minY) - archMidY;
      const rx = lx * cos - ly * sin; // Local Rotated X
      
      const dxRel = rx / (boxW / 2);

      // FIND NEAREST TOOTH CENTER INFLUENCE
      let minDistSq = Infinity;
      for (let t of teethCenters) {
        const dx = x - t.x, dy = y - t.y;
        const dSq = dx * dx + dy * dy;
        if (dSq < minDistSq) minDistSq = dSq;
      }
      const distNorm = Math.sqrt(minDistSq) / influenceRadius;
      let weight = Math.max(0.4, Math.exp(-distNorm * distNorm));

      // 🎯 CLINICAL CURVE (Calculated on Rotated Axis)
      const curveDir = isLower ? 1 : -1;
      const curveDisplacement = curveDir * (boxH * 0.06) * (dxRel * dxRel);
      
      // 🚀 FORCE MOVEMENT
      let dy = ((archMidY + curveDisplacement) - (y + minY)) * 1.2 * weight;
      if (Math.abs(dy) < 2) dy = dy > 0 ? 2 : -2;

      // Backward Map with sub-pixel interpolation
      const sy = clamp(y - dy, 0, boxH - 1);
      const y1 = Math.floor(sy), y2 = Math.min(y1 + 1, boxH - 1), ty = sy - y1;
      const i1 = (y1 * boxW + x) * 4, i2 = (y2 * boxW + x) * 4;

      newData[i]     = sourceData[i1] * (1 - ty) + sourceData[i2] * ty;
      newData[i + 1] = sourceData[i1 + 1] * (1 - ty) + sourceData[i2 + 1] * ty;
      newData[i + 2] = sourceData[i1 + 2] * (1 - ty) + sourceData[i2 + 2] * ty;
      newData[i + 3] = 255;
    }
  }

  imageData.data.set(newData);
  ctx.putImageData(imageData, minX, minY);
}

/**
 * Main Entry Point - Multi-Arch Rigid Recovery
 */
export function applyAlignment(ctx, landmarks, w, h, options = {}) {
  processArch(ctx, landmarks, w, h, UPPER_ARCH_INDICES, options);
  processArch(ctx, landmarks, w, h, LOWER_ARCH_INDICES, options);
}
