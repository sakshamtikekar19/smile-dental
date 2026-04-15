/**
 * ALIGNMENT ENGINE: Rigid Tooth Segmentation & Transformation
 * 1. Connectivity-based Segmentation (Tooth Clustering)
 * 2. Object-Oriented Rigid Movement (Translation + Rotation)
 * 3. Shadow Consistency & Depth Mapping
 */

const UPPER_ARCH_INDICES = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308];
const LOWER_ARCH_INDICES = [308, 324, 318, 402, 317, 14, 87, 178, 88, 95, 78];

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/**
 * 🦷 TOOTH SEGMENTATION ENGINE (Flood Fill Clustering)
 */
function segmentTeeth(mask, width, height) {
  const visited = new Array(mask.length).fill(false);
  const clusters = [];
  const dirs = [-1, 1, -width, width];

  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || visited[i]) continue;

    let queue = [i];
    let cluster = [];
    visited[i] = true;

    while (queue.length) {
      const curr = queue.pop();
      cluster.push(curr);

      for (let d of dirs) {
        const ni = curr + d;
        // Check bounds and connectivity
        if (ni >= 0 && ni < mask.length && mask[ni] && !visited[ni]) {
          // Prevent wrapping around the canvas edges
          if (Math.abs((curr % width) - (ni % width)) <= 1) {
            visited[ni] = true;
            queue.push(ni);
          }
        }
      }
    }

    if (cluster.length > 40 && cluster.length < 1800) { // LOWERED THRESHOLD: catches more teeth
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
  const minX = Math.floor(Math.min(...xs)) - 30, maxX = Math.ceil(Math.max(...xs)) + 30;
  const minY = Math.floor(Math.min(...ys)) - 30, maxY = Math.ceil(Math.max(...ys)) + 30;
  const boxW = maxX - minX, boxH = maxY - minY;
  if (boxW <= 0 || boxH <= 0) return;

  const imageData = ctx.getImageData(minX, minY, boxW, boxH);
  const data = imageData.data;
  const sourceData = new Uint8ClampedArray(data);
  const newData = new Uint8ClampedArray(sourceData);
  const depthMap = new Float32Array(boxW * boxH).fill(-1);

  const isEnamel = (r, g, b) => {
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    const isTooDark = lum < 42;            // RESTORED: Catch shadowed teeth
    const isGum = r > g * 1.25 && r > b * 1.25; // CALIBRATED: Allows warm tooth tones
    const isSkin = r > 150 && g > 110 && b > 100; // PRECISE: Protects facial skin

    return !isTooDark && !isGum && !isSkin;
  };

  // 1. BUILD ENAMEL MASK & OCCUPANCY MAP (Region Locked)
  const mouthTop = archMidY - boxH * 0.25;
  const mouthBottom = archMidY + boxH * 0.25;

  const enamelMask = new Array(boxW * boxH).fill(false);
  const occupancyMap = new Int8Array(boxW * boxH).fill(0); // Tracking for moved pixels

  for (let i = 0; i < boxW * boxH; i++) {
    const y = Math.floor(i / boxW);
    const globalY = y + minY;

    // 🔒 REGION LOCK: Restrict to mouth band only
    if (globalY < mouthTop || globalY > mouthBottom) continue;

    const idx = i * 4;
    const r = sourceData[idx], g = sourceData[idx+1], b = sourceData[idx+2];

    if (isEnamel(r, g, b)) {
      enamelMask[i] = true;
      // Softly darken old position to show transformation area
      newData[idx] *= 0.85;
      newData[idx+1] *= 0.85;
      newData[idx+2] *= 0.85;
    }
  }

  // 2. SEGMENT INTO TEETH
  let teethClusters = segmentTeeth(enamelMask, boxW, boxH);
  
  // 🚨 FALLBACK: if segmentation fails, treat whole enamel as one cluster
  if (!teethClusters || teethClusters.length === 0) {
    const fallbackCluster = [];
    for (let i = 0; i < enamelMask.length; i++) {
      if (enamelMask[i]) fallbackCluster.push(i);
    }
    if (fallbackCluster.length > 0) teethClusters = [fallbackCluster];
  }

  // Sort Left -> Right for consistent processing
  teethClusters.sort((a, b) => getCenter(a, boxW).x - getCenter(b, boxW).x);

  const isLower = indices.includes(14);

  // 3. FORCE VISIBILITY LOOP (Extreme Debug Mode)
  teethClusters.forEach((cluster) => {
    for (let idx of cluster) {
      const x = idx % boxW;
      const y = Math.floor(idx / boxW);

      const nx = x;
      const ny = y - 5; // FORCE upward movement

      if (ny < 0 || ny >= boxH) continue;

      const ni = (ny * boxW + nx) * 4;
      const oi = idx * 4;

      // DIRECT WRITE (NO CONDITIONS)
      for (let c = 0; c < 4; c++) {
        newData[ni + c] = sourceData[oi + c];
      }
    }
  });

  imageData.data.set(newData);
  ctx.putImageData(imageData, minX, minY);
}

/**
 * Main Entry Point - Multi-Arch Rigid Recovery
 */
export function applyAlignment(ctx, landmarks, w, h, options = {}) {
  const settings = {
    strength: options.strength || 1.0,
    maxShiftX: options.maxShiftX || 2.4,
    maxShiftY: options.maxShiftY || 1.4
  };


  processArch(ctx, landmarks, w, h, UPPER_ARCH_INDICES, settings);
  processArch(ctx, landmarks, w, h, LOWER_ARCH_INDICES, settings);

  // Final Texture Pass (Dental Realism Pass)
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.filter = "contrast(1.03) brightness(1.01)";
  ctx.drawImage(ctx.canvas, 0, 0);
  ctx.restore();

  // Clinical Radiance
  ctx.save();
  ctx.globalAlpha = 0.035;
  ctx.filter = "blur(0.4px) brightness(1.01)";
  ctx.drawImage(ctx.canvas, 0, 0);
  ctx.restore();
}
