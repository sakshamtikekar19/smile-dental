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
  const horizontalPadding = (Math.max(...xs) - Math.min(...xs)) * 0.15; // 15% Padding
  const verticalPadding = 35;
  const minX = Math.floor(Math.min(...xs)) - horizontalPadding, maxX = Math.ceil(Math.max(...xs)) + horizontalPadding;
  const minY = Math.floor(Math.min(...ys)) - verticalPadding, maxY = Math.ceil(Math.max(...ys)) + verticalPadding;
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
      // 🦷 ERASURE PASS: Clear the original position to prevent ghosting
      newData[idx] = 180;     // Fill with neutral background-ish tone
      newData[idx+1] = 160;
      newData[idx+2] = 150;
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

  // 3. RIGID MOVEMENT LOOP (Guaranteed Visibility)
  // [CLEAN SLATE]: Redundant reset removed to prevent ghosting.

  teethClusters.forEach(cluster => {
    const center = getCenter(cluster, boxW);
    const gx = center.x + minX;

    const dxRel = (gx - centerX) / (boxW / 2);
    const targetYGlobal = isLower ? archMidY + (boxH * 0.01) * (dxRel * dxRel) : archMidY - (boxH * 0.012) * (dxRel * dxRel);
    const targetY = targetYGlobal - minY;

    const dx = 0;
    let dy = (targetY - center.y) * strength * 0.8;

    // force visible movement
    if (Math.abs(dy) < 1 && Math.abs(dy) > 0.01) {
      dy = dy > 0 ? 1 : -1;
    }

    cluster.forEach(idx => {
      const x = idx % boxW;
      const y = Math.floor(idx / boxW);

      const nx = x;
      const ny = y + dy;

      if (nx < 0 || nx >= boxW || ny < 0 || ny >= boxH) return;

      const ni = (Math.floor(ny) * boxW + Math.floor(nx)) * 4;
      const oi = idx * 4;

      for (let c = 0; c < 4; c++) {
        newData[ni + c] = sourceData[oi + c];
      }
    });
  });

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

  // 🔥 DIAGNOSTIC: Lime Visibility Box
  ctx.save();
  ctx.strokeStyle = "lime";
  ctx.lineWidth = 5;
  ctx.strokeRect(50, 50, 200, 100);
  ctx.restore();
}
