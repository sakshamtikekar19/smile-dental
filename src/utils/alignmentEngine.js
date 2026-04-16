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
export function segmentTeeth(mask, width, height) {
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
      
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      
      // 🏥 ROBUST DETECTION: Accept teeth (Desaturated), Reject Lips/Gums (Red-Heavy)
      const isEnamel = lum > 60 && !(r > g * 1.3 && r > b * 1.3);
      
      // 🏥 ANATOMICAL SAFETY: Exclude pixels beyond the lip transition line
      const globalY = y + minY;
      const verticalSafety = isLower ? (globalY > archMidY - 4) : (globalY < archMidY + 4);

      if (isEnamel && verticalSafety) {
        enamelMask[idx] = 1;
      }
    }
  }
  console.timeEnd("enamel_scan");

  console.time("segmentation");
  let teethClusters = segmentTeeth(enamelMask, boxW, boxH);
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

  teethClusters.forEach(cluster => {
    const center = getCenter(cluster, boxW);
    const gx = center.x + minX;

    // 🦷 Anatomical Parabolic Target Mapping (Enhanced Curvature)
    const curveStrength = isLower ? 0.02 : 0.025;
    const dxRel = (gx - centerX) / (boxW / 2);
    const targetYGlobal = isLower 
      ? archMidY + (boxH * curveStrength) * (dxRel * dxRel)
      : archMidY - (boxH * curveStrength) * (dxRel * dxRel);
    const targetY = targetYGlobal - minY;

    // 🚀 Professional Continuous Movement (No Snapping)
    let dy = (targetY - center.y) * 0.8;
    if (Math.abs(dy) < 0.8) {
      dy *= 1.5;
    }

    cluster.forEach(idx => {
      const x = idx % boxW;
      const y = Math.floor(idx / boxW);

      const nx = x;
      const ny = Math.floor(y + dy);

      if (nx < 0 || nx >= boxW || ny < 0 || ny >= boxH) return;

      const ni = (ny * boxW + nx) * 4;
      const oi = idx * 4;

      // 🛡️ OVERLAP GUARD (Prevents color corruption)
      if (newData[ni + 3] !== 0) return;

      newData[ni]     = sourceData[oi];
      newData[ni + 1] = sourceData[oi + 1];
      newData[ni + 2] = sourceData[oi + 2];
      newData[ni + 3] = 255;
    });
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
