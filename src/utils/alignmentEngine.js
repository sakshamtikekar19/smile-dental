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

    if (cluster.length > 80 && cluster.length < 1800) { // CLINICAL LIMIT: prevents side-tooth merging
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
  const { strength, maxShiftX, maxShiftY } = options;

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
    // Saturation Guard: ensures red skin/hair isn't caught
    const isSaturated = (r > g * 1.25 && r > b * 1.25);
    return !isSaturated && lum > 58; 
  };

  // 1. BUILD ENAMEL MASK & PRE-DARKEN (Clinical Fix: prevent gaps)
  const enamelMask = new Array(boxW * boxH).fill(false);
  for (let i = 0; i < boxW * boxH; i++) {
    const idx = i * 4;
    const r = sourceData[idx], g = sourceData[idx+1], b = sourceData[idx+2];

    if (isEnamel(r, g, b)) {
      enamelMask[i] = true;
      // SOFTEN BASE (Clinical choice: 0.75 is safer)
      newData[idx] *= 0.75;
      newData[idx+1] *= 0.75;
      newData[idx+2] *= 0.75;
    }
  }

  // 2. SEGMENT INTO TEETH
  let teethClusters = segmentTeeth(enamelMask, boxW, boxH);
  
  // Sort Left -> Right for consistent processing
  teethClusters.sort((a, b) => getCenter(a, boxW).x - getCenter(b, boxW).x);

  const isLower = indices.includes(14);

  // 3. RIGID MOVEMENT LOOP
  teethClusters.forEach((cluster) => {
    const center = getCenter(cluster, boxW);

    // 🧠 MIN DISTANCE (Overlap Prevention)
    const minDist = 6;
    const clusterIdx = teethClusters.indexOf(cluster);
    if (clusterIdx > 0) {
      const prevCenter = getCenter(teethClusters[clusterIdx - 1], boxW);
      if (Math.abs(center.x - prevCenter.x) < minDist) return;
    }

    const gx = center.x + minX, gy = center.y + minY;
    
    // Calculate target vertical pos and rotation
    const dxRel = (gx - centerX) / (boxW / 2);
    const targetYGlobal = isLower ? archMidY + (boxH * 0.01) * (dxRel * dxRel) : archMidY - (boxH * 0.012) * (dxRel * dxRel);
    const targetY = targetYGlobal - minY;

    let dy = (targetY - center.y) * 0.55 * strength;
    
    // 👄 SMILE LINE NATURALIZATION (Avoids flat look)
    const distFromCenter = Math.abs(gx - centerX) / (boxW / 2);
    dy *= (0.8 + distFromCenter * 0.2);

    if (Math.abs(dy) < 0.4 && Math.abs(dy) > 0.01) {
      dy = dy > 0 ? 0.4 : -0.4; // MINIMUM MOVEMENT GUARANTEE
    }
    let dx = 0; // Lock horizontal to prevent jank
    
    // Protection limits
    dx = clamp(dx, -maxShiftX, maxShiftX);
    dy = clamp(dy, -maxShiftY, maxShiftY);

    // 🚀 BOOSTED ROTATION (Perceptible Side Correction)
    const norm = (center.x - centerX) / (boxW / 2);
    let angle = norm * 0.0035; 
    const falloff = 1 - Math.abs(norm);
    angle *= (1 - falloff);

    // 🔥 CORRECTED FRONT TOOTH LOCK (Allows Movement)
    if (Math.abs(center.x - centerX) < boxW * 0.1) {
      angle *= 0.7;
      dy *= 0.9;
    }

    angle += (Math.random() - 0.5) * 0.0005; // Natural jitter

    const cosA = Math.cos(angle), sinA = Math.sin(angle);

    for (let idx of cluster) {
      const x = idx % boxW, y = Math.floor(idx / boxW);
      
      // Rotate around tooth center
      const relX = x - center.x, relY = y - center.y;
      const rotX = relX * cosA - relY * sinA;
      const rotY = relX * sinA + relY * cosA;

      const nx = Math.round(center.x + rotX + dx);
      const ny = Math.round(center.y + rotY + dy);

      if (nx < 0 || nx >= boxW || ny < 0 || ny >= boxH) continue;

      const sx = clamp(x - dx - rotX, 0, boxW - 1);
      const sy = clamp(y - dy - rotY, 0, boxH - 1);
      const x1 = Math.floor(sx), x2 = clamp(x1 + 1, 0, boxW - 1);
      const y1 = Math.floor(sy), y2 = clamp(y1 + 1, 0, boxH - 1);
      const tx = sx - x1, ty = sy - y1;

      const niFlat = ny * boxW + nx;
      if (depthMap[niFlat] > center.y) continue;
      depthMap[niFlat] = center.y;

      const ni = niFlat * 4;
      const shadeAdjust = (dx * 0.2 + dy * 0.2) * 0.25;

      // 🚀 EDGE-AWARE BLENDING (Strong edges, smooth centers)
      const edgeFactor = Math.abs(dx) + Math.abs(dy);
      const dynamicBlend = clamp(0.65 + (edgeFactor * 0.1), 0.65, 0.75);

      for (let c = 0; c < 3; c++) {
        const p00 = sourceData[(y1 * boxW + x1) * 4 + c];
        const p10 = sourceData[(y1 * boxW + x2) * 4 + c];
        const p01 = sourceData[(y2 * boxW + x1) * 4 + c];
        const p11 = sourceData[(y2 * boxW + x2) * 4 + c];
        const interX = p00 * (1 - tx) + p10 * tx;
        const interY = p01 * (1 - tx) + p11 * tx;
        const newVal = clamp((interX * (1 - ty) + interY * ty) - shadeAdjust, 0, 255);
        
        // Final Realism Blend (Source Texture + New Shift)
        newData[ni + c] = sourceData[(y * boxW + x) * 4 + c] * dynamicBlend + newVal * (1 - dynamicBlend);
      }
      newData[ni + 3] = 255; // CLINCAL FIX: Guaranteed Solid Teeth (No Goth tint)

      // FALLBACK: Prevent gaps
      if (newData[ni + 3] === 0) {
        for (let c = 0; c < 4; c++) newData[ni + c] = sourceData[(y * boxW + x) * 4 + c];
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
