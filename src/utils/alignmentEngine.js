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

    if (cluster.length > 120) { // Clinical noise filter
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
    const notGum = !(r > g * 1.15 && r > b * 1.15);
    return notGum && lum > 52;
  };

  // 1. BUILD ENAMEL MASK
  const enamelMask = new Array(boxW * boxH).fill(false);
  for (let i = 0; i < boxW * boxH; i++) {
    if (isEnamel(sourceData[i*4], sourceData[i*4+1], sourceData[i*4+2])) enamelMask[i] = true;
  }

  // 2. SEGMENT INTO TEETH
  let teethClusters = segmentTeeth(enamelMask, boxW, boxH);
  
  // Sort Left -> Right for consistent processing
  teethClusters.sort((a, b) => getCenter(a, boxW).x - getCenter(b, boxW).x);

  const isLower = indices.includes(14);

  // 3. RIGID MOVEMENT LOOP
  teethClusters.forEach((cluster) => {
    const center = getCenter(cluster, boxW);
    const gx = center.x + minX, gy = center.y + minY;
    
    // Calculate target vertical pos and rotation
    const dxRel = (gx - centerX) / (boxW / 2);
    const targetYGlobal = isLower ? archMidY + (boxH * 0.01) * (dxRel * dxRel) : archMidY - (boxH * 0.012) * (dxRel * dxRel);
    const targetY = targetYGlobal - minY;

    let dy = (targetY - center.y) * 0.3 * strength;
    let dx = (centerX - gx) * 0.005 * strength; // Extremely subtle horizontal center
    
    // Protection limits
    dx = clamp(dx, -maxShiftX, maxShiftX);
    dy = clamp(dy, -maxShiftY, maxShiftY);

    // Rotation Angle: outer teeth rotate slightly inward
    let angle = (center.x - boxW / 2) * 0.0025; 
    const falloff = 1 - Math.min(1, Math.abs(dxRel) * 1.5);
    angle *= (1 - falloff); // Front teeth stay stable
    angle += (Math.random() - 0.5) * 0.0005; // Realism jitter

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

      const niFlat = ny * boxW + nx;
      if (depthMap[niFlat] > center.y) continue; // Basic Z-buffer for overlaps
      depthMap[niFlat] = center.y;

      const ni = niFlat * 4, oi = idx * 4;
      const shadeAdjust = (dx * 0.2 + dy * 0.2) * 0.25;

      for (let c = 0; c < 3; c++) {
        newData[ni + c] = clamp(sourceData[oi + c] - shadeAdjust, 0, 255);
      }
      newData[ni + 3] = sourceData[oi + 3];
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

  // Clinical Radiance
  ctx.save();
  ctx.globalAlpha = 0.035;
  ctx.filter = "blur(0.4px) brightness(1.01)";
  ctx.drawImage(ctx.canvas, 0, 0);
  ctx.restore();
}
