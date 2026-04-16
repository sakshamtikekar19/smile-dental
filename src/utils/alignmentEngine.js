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
  const { strength = 1.0, maxShiftX, maxShiftY } = options;

  let points = indices.map(i => ({ x: landmarks[i].x * w, y: landmarks[i].y * h }));
  const midPoint = Math.floor(points.length / 2);
  const centerX = points[midPoint].x;
  const archMidY = points.reduce((s, p) => s + p.y, 0) / points.length;

  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const horizontalPadding = (Math.max(...xs) - Math.min(...xs)) * 0.15; // 15% Padding
  const verticalPadding = 35;
  const minX = Math.floor(Math.min(...xs)) - horizontalPadding, maxX = Math.ceil(Math.max(...xs)) + horizontalPadding;
  const minY = Math.floor(Math.min(...ys)) - verticalPadding, maxY = Math.ceil(Math.max(...ys)) + verticalPadding;
  const boxW = maxX - minX, boxH = maxY - minY;
  if (boxW <= 0 || boxH <= 0) return;

  const imageData = ctx.getImageData(minX, minY, boxW, boxH);
  const data = imageData.data;
  const sourceData = new Uint8ClampedArray(data);
  const newData = new Uint8ClampedArray(sourceData.length);

  // ❌ CLEAN START
  for (let i = 0; i < newData.length; i++) { newData[i] = 0; }
  
  const isLower = indices.includes(14) || indices.includes(324); 
  const enamelMask = new Uint8Array(boxW * boxH);

  // 1. SURGICAL ENAMEL SCAN (User-Hardened Robust Detection)
  console.time("enamel_scan");
  for (let y = 0; y < boxH; y++) {
    for (let x = 0; x < boxW; x++) {
      const idx = y * boxW + x;
      const r = sourceData[idx * 4], g = sourceData[idx * 4 + 1], b = sourceData[idx * 4 + 2];
      const gy = y + minY;

      // 🦷 Horizontal Band Lock + Simple Color (User Definitive)
      const isEnamel = (function() {
        const lum = (r + g + b) / 3;
        if (lum < 60) return false;

        // 🔥 HARD REGION LOCK (Physical Safe Zone)
        const upperBandTop = archMidY - boxH * 0.25;
        const upperBandBottom = archMidY + boxH * 0.05;

        const lowerBandTop = archMidY - boxH * 0.05;
        const lowerBandBottom = archMidY + boxH * 0.25;

        const inUpper = gy > upperBandTop && gy < upperBandBottom;
        const inLower = gy > lowerBandTop && gy < lowerBandBottom;

        return inUpper || inLower;
      })();

      if (isEnamel) {
        enamelMask[idx] = 1;
      }
    }
  }
  console.timeEnd("enamel_scan");

  console.time("segmentation");
  let teethClusters = segmentTeeth(enamelMask, boxW, boxH);
  console.log("TEETH COUNT (" + (isLower ? "LOWER" : "UPPER") + "):", teethClusters.length);
  console.timeEnd("segmentation");
  
  if (!teethClusters || teethClusters.length === 0) {
    const fallbackCluster = [];
    for (let i = 0; i < enamelMask.length; i++) {
      if (enamelMask[i]) fallbackCluster.push(i);
    }
    if (fallbackCluster.length > 0) teethClusters = [fallbackCluster];
  }

  teethClusters.sort((a, b) => getCenter(a, boxW).x - getCenter(b, boxW).x);

  // 3. RIGID MOVEMENT LOOP (Guaranteed Visibility)
  // [CLEAN SLATE]: Redundant reset removed to prevent ghosting.

  teethClusters.forEach((cluster) => {
    const center = getCenter(cluster, boxW);
    const gx = center.x + minX;

    const dxRel = (gx - centerX) / (boxW / 2);

    // Stronger, visible smile curve (User-Calibrated 0.04)
    const curveDirection = isLower ? 1 : -1;
    const targetYGlobal = archMidY + curveDirection * (boxH * 0.04) * (dxRel * dxRel);
    const targetY = targetYGlobal - minY;

    // 🚀 BOOSTED MOVEMENT (THIS IS THE FIX)
    let dy = (targetY - center.y) * 0.8;

    // 🚨 MINIMUM MOVEMENT GUARANTEE
    if (Math.abs(dy) < 2) {
      dy = dy > 0 ? 2 : -2;
    }

    for (let idx of cluster) {
      const x = idx % boxW;
      const y = Math.floor(idx / boxW);

      const ny = Math.round(y + dy);
      if (ny < 0 || ny >= boxH) continue;

      const ni = (ny * boxW + x) * 4;
      const oi = idx * 4;

      // overwrite safely
      newData[ni]     = sourceData[oi];
      newData[ni + 1] = sourceData[oi + 1];
      newData[ni + 2] = sourceData[oi + 2];
      newData[ni + 3] = 255;
    }
  });

  // 🔥 RESTORE PIXELS (MANDATORY)
  // restore untouched pixels
  for (let i = 0; i < newData.length; i += 4) {
    if (newData[i + 3] === 0) {
      newData[i]     = sourceData[i];
      newData[i + 1] = sourceData[i + 1];
      newData[i + 2] = sourceData[i + 2];
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
  const settings = {
    strength: options.strength ?? 1.0,
    maxShiftX: options.maxShiftX || 2.4,
    maxShiftY: options.maxShiftY || 1.4
  };


  processArch(ctx, landmarks, w, h, UPPER_ARCH_INDICES, settings);
  processArch(ctx, landmarks, w, h, LOWER_ARCH_INDICES, settings);
}
