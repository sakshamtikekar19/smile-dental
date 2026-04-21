/**
 * ALIGNMENT ENGINE: THE HYBRID MATRIX (V20)
 * Smooth Bilinear Enamel + 4-Point Bio-Gated Lip Protection.
 * Physics: Gaussian Falloff for noticeable but subtle shifting.
 */

const INNER_LIP_INDICES = [
  78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, // Upper inner
  324, 318, 402, 317, 14, 87, 178, 88, 95          // Lower inner
];

// 🧠 The Mathematical Fence (Ray-Casting Algorithm)
function isPixelInsidePolygon(px, py, polygon) {
    let isInside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        let xi = polygon[i].x, yi = polygon[i].y;
        let xj = polygon[j].x, yj = polygon[j].y;
        let intersect = ((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
        if (intersect) isInside = !isInside;
    }
    return isInside;
}

// 🩸 Biochemical Flesh Detector
function isFlesh(r, g, b) {
    // Detects pink/red mucosal tissue (Lips & Gums)
    return (r > g * 1.15 && r > b * 1.15); 
}

export function applyProfessionalAlignment(ctx, landmarks, w, h) {
  console.log("✅ ALIGNMENT V20 (HYBRID MATRIX) START");
  
  if (!landmarks || landmarks.length === 0) return;

  const imageData = ctx.getImageData(0, 0, w, h);
  const src = new Uint8ClampedArray(imageData.data); 
  const dst = imageData.data;
  
  // Force absolute array synchronization for multi-device stability
  const actualW = imageData.width;
  const actualH = imageData.height;

  const mouthPolygon = [];
  INNER_LIP_INDICES.forEach((idx) => {
    mouthPolygon.push({
      x: landmarks[idx].x * actualW,
      y: landmarks[idx].y * actualH
    });
  });

  const mouthIndices = [61, 291, 78, 13, 14, 308];
  let minX = actualW, minY = actualH, maxX = 0, maxY = 0;
  mouthIndices.forEach(i => {
    const px = landmarks[i].x * actualW, py = landmarks[i].y * actualH;
    minX = Math.min(minX, px); minY = Math.min(minY, py);
    maxX = Math.max(maxX, px); maxY = Math.max(maxY, py);
  });

  // Tighter padding for focused surgery
  const padX = (maxX - minX) * 0.15, padY = (maxY - minY) * 0.20;
  minX = Math.max(0, Math.floor(minX - padX)); 
  maxX = Math.min(actualW, Math.ceil(maxX + padX));
  minY = Math.max(0, Math.floor(minY - padY)); 
  maxY = Math.min(actualH, Math.ceil(maxY + padY));

  const centerX = (minX + maxX) / 2;
  const archMidY = (minY + maxY) / 2;
  const roiW = maxX - minX;
  const roiH = maxY - minY;

  // 🧪 V20 LOOP: Hybrid Bilinear Math (Smooth Enamel + Hard Lips)
  for (let y = minY; y < maxY; y++) {
    for (let x = minX; x < maxX; x++) {
      
      // 🛑 GATE 1: Geometric Outside Fence
      if (!isPixelInsidePolygon(x, y, mouthPolygon)) continue;

      const i = (y * actualW + x) * 4;

      // 🩸 GATE 2: Dest Flesh Protector (Don't overwrite the lips)
      if (isFlesh(src[i], src[i+1], src[i+2])) continue;

      const nx = (x - centerX) / (roiW / 2);
      const ny = (y - archMidY) / (roiH / 2);
      
      // 🔥 FIX 1: Gaussian Falloff (Silky smooth, subtle physics)
      const distSq = nx * nx + ny * ny;
      if (distSq > 1.2) continue; 
      const falloff = Math.exp(-distSq * 2.2);

      // Noticeable but subtle movement vectors
      let dx = nx * roiW * 0.035 * falloff; 
      let dy = Math.abs(nx) * roiH * 0.045 * falloff; 

      const sx = x - dx;
      const sy = y - dy;

      // 🛑 GATE 3: Geometric Source Denial
      if (!isPixelInsidePolygon(sx, sy, mouthPolygon)) continue;

      // Prepare indices for sampling
      const x0 = Math.max(0, Math.min(actualW - 2, Math.floor(sx)));
      const y0 = Math.max(0, Math.min(actualH - 2, Math.floor(sy)));
      const x1 = x0 + 1;
      const y1 = y0 + 1;
      const wx = sx - x0;
      const wy = sy - y0;

      // Extract the 4 surrounding pixel indices
      const p00 = (y0 * actualW + x0) * 4;
      const p10 = (y0 * actualW + x1) * 4;
      const p01 = (y1 * actualW + x0) * 4;
      const p11 = (y1 * actualW + x1) * 4;

      // 🔥 FIX 2: The 4-Point Bio-Gate
      // If ANY of the 4 source pixels are pink flesh, we ABORT the smooth blend to prevent 
      // the "Pink Ghost" bleed, and instantly snap to a safe, solid tooth pixel.
      let isSafeToBlend = true;
      if (isFlesh(src[p00], src[p00+1], src[p00+2]) ||
          isFlesh(src[p10], src[p10+1], src[p10+2]) ||
          isFlesh(src[p01], src[p01+1], src[p01+2]) ||
          isFlesh(src[p11], src[p11+1], src[p11+2])) {
          isSafeToBlend = false;
      }

      if (isSafeToBlend) {
          // HD Bilinear: Smooth Enamel (98% of teeth)
          for (let c = 0; c < 3; c++) {
              dst[i + c] = src[p00 + c] * (1 - wx) * (1 - wy) +
                           src[p10 + c] * wx * (1 - wy) +
                           src[p01 + c] * (1 - wx) * wy +
                           src[p11 + c] * wx * wy;
          }
      } else {
          // Safe Fast-Snap: Prevents the pink bleed at the exact lip line
          const safeIdx = (Math.round(sy) * actualW + Math.round(sx)) * 4;
          if (isFlesh(src[safeIdx], src[safeIdx+1], src[safeIdx+2])) continue;
          dst[i] = src[safeIdx];
          dst[i+1] = src[safeIdx+1];
          dst[i+2] = src[safeIdx+2];
      }
      
      dst[i+3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  console.log("✅ ALIGNMENT V20 (HYBRID MATRIX) APPLIED");
}

export const applyAlignment = applyProfessionalAlignment;
