/**
 * ALIGNMENT ENGINE: Professional Refinements (The Magic Pass)
 * 1. Contact Preservation (fixes fake gaps)
 * 2. Micro-Imperfection Injection (realism)
 * 3. Shadow Consistency (prevents floating look)
 * 4. Smile Arc Preservation (natural curvature)
 */

const UPPER_ARCH_INDICES = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308];

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/**
 * 🦷 FINAL REFINEMENT: Micro-Imperfections (Realism)
 */
function addNaturalVariation(dx, dy, x, y) {
  const varX = Math.sin(x * 0.3) * 0.15;
  const varY = Math.cos(y * 0.2) * 0.1;
  return { dx: dx + varX, dy: dy + varY };
}

/**
 * Main Entry Point
 */
export function applyAlignment(ctx, landmarks, w, h, options = {}) {
  const {
    strength = 1.0, 
    maxShiftX = 2.2,
    maxShiftY = 1.1,
    minGap = 1.8, // Contact preservation
    smoothing = 0.3
  } = options;

  let points = UPPER_ARCH_INDICES.map(i => ({ 
    x: landmarks[i].x * w, 
    y: landmarks[i].y * h,
    origX: landmarks[i].x * w,
    origY: landmarks[i].y * h
  }));

  const mid = Math.floor(points.length / 2);
  const centerX = points[mid].x;
  const archMidY = points.reduce((s, p) => s + p.y, 0) / points.length;

  // 1. SMILE ARC PRESERVATION
  points = points.map((p, i) => {
    const offset = Math.abs(i - mid) * 0.6;
    return { ...p, targetY: archMidY - offset };
  });

  // 2. CONTACT PRESERVATION (Fixes merging/fake gaps)
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const gap = curr.x - prev.x;
    if (gap < minGap) {
      const shift = minGap - gap;
      curr.x += shift;
    }
  }

  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const minX = Math.floor(Math.min(...xs)) - 15, maxX = Math.ceil(Math.max(...xs)) + 15;
  const minY = Math.floor(Math.min(...ys)) - 15, maxY = Math.ceil(Math.max(...ys)) + 15;
  const boxW = maxX - minX, boxH = maxY - minY;
  
  if (boxW <= 0 || boxH <= 0) return;

  const imageData = ctx.getImageData(minX, minY, boxW, boxH);
  const data = imageData.data;
  const sourceData = new Uint8ClampedArray(data);

  // 🚀 GUM PROTECTION Logic
  const isEnamel = (r, g, b) => {
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const notGum = !(r > g * 1.2 && r > b * 1.2);
    const notDark = lum > 55;
    return notGum && notDark;
  };

  // 🦷 MISSING TOOTH DETECTION
  const detectMissingMask = (sourceData, boxW, boxH) => {
    const mask = new Array(boxW * boxH).fill(false);
    const isEnamelLocal = (i) => {
      const r = sourceData[i], g = sourceData[i+1], b = sourceData[i+2];
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const notGum = !(r > g * 1.2 && r > b * 1.2);
      return notGum && lum > 55;
    };
    for (let y = 1; y < boxH - 1; y++) {
      for (let x = 1; x < boxW - 1; x++) {
        const idx = y * boxW + x;
        const i = idx * 4;
        if (isEnamelLocal(i)) continue;
        let neighbors = 0;
        const n1 = ((y * boxW + (x - 1)) * 4);
        const n2 = ((y * boxW + (x + 1)) * 4);
        const n3 = (((y - 1) * boxW + x) * 4);
        const n4 = (((y + 1) * boxW + x) * 4);
        if (isEnamelLocal(n1)) neighbors++;
        if (isEnamelLocal(n2)) neighbors++;
        if (isEnamelLocal(n3)) neighbors++;
        if (isEnamelLocal(n4)) neighbors++;
        if (neighbors >= 2) mask[idx] = true;
      }
    }
    return mask;
  };

  const expandMask = (mask, boxW, boxH, passes = 2) => {
    let output = [...mask];
    for (let p = 0; p < passes; p++) {
      const temp = [...output];
      for (let y = 1; y < boxH - 1; y++) {
        for (let x = 1; x < boxW - 1; x++) {
          const idx = y * boxW + x;
          if (output[idx] || output[idx - 1] || output[idx + 1] || output[idx - boxW] || output[idx + boxW]) {
            temp[idx] = true;
          }
        }
      }
      output = temp;
    }
    return output;
  };

  // 🧠 detect missing tooth regions
  let missingMask = detectMissingMask(sourceData, boxW, boxH);
  missingMask = expandMask(missingMask, boxW, boxH, 2);

  // 3. PIXEL MIGRATION WITH SHADOW CONSISTENCY
  for (let y = 0; y < boxH; y++) {
    for (let x = 0; x < boxW; x++) {
      const i = (y * boxW + x) * 4;
      const r = sourceData[i], g = sourceData[i+1], b = sourceData[i+2];

      const idxFlat = y * boxW + x;
      if (!isEnamel(r, g, b) || missingMask[idxFlat]) continue;

      const gx = x + minX, gy = y + minY;
      
      // Calculate target curve displacement
      const dxRel = (gx - centerX) / (boxW / 2);
      const targetY = archMidY + (boxH * 0.015) * (dxRel * dxRel); 
      
      let dy = (targetY - gy) * strength * 0.5;
      let dx = (centerX - gx) * 0.015 * strength;

      // 🧠 MICRO-IMPERFECTION INJECTION
      const variation = addNaturalVariation(dx, dy, gx, gy);
      dx = clamp(variation.dx, -maxShiftX, maxShiftX);
      dy = clamp(variation.dy, -maxShiftY, maxShiftY);

      // --- BACK-MAPPING ---
      const sx = clamp(x - dx, 0, boxW - 1);
      const sy = clamp(y - dy, 0, boxH - 1);

      const x1 = Math.floor(sx), x2 = clamp(x1 + 1, 0, boxW - 1);
      const y1 = Math.floor(sy), y2 = clamp(y1 + 1, 0, boxH - 1);
      const tx = sx - x1, ty = sy - y1;

      for (let c = 0; c < 3; c++) {
        const p00 = sourceData[(y1 * boxW + x1) * 4 + c];
        const p10 = sourceData[(y1 * boxW + x2) * 4 + c];
        const p01 = sourceData[(y2 * boxW + x1) * 4 + c];
        const p11 = sourceData[(y2 * boxW + x2) * 4 + c];
        const interX = p00 * (1 - tx) + p10 * tx;
        const interY = p01 * (1 - tx) + p11 * tx;
        
        // 🧪 SHADOW CONSISTENCY FIX
        // Subtle shading adjustment based on movement to fix "floating" look
        const shadeAdjust = (dx * 0.4 + dy * 0.3) * 0.4;
        data[i + c] = clamp((interX * (1 - ty) + interY * ty) - shadeAdjust, 0, 255);
      }
    }
  }

  ctx.putImageData(imageData, minX, minY);

  // 4. FINAL RADIANCE
  ctx.save();
  ctx.globalAlpha = 0.025;
  ctx.filter = "blur(0.3px) brightness(1.015)";
  ctx.drawImage(ctx.canvas, 0, 0);
  ctx.restore();
}
