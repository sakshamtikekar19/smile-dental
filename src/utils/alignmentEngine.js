/**
 * ALIGNMENT ENGINE: PRODUCTION GRADE (V28 - Geometric Protection)
 * Inner-Mouth Masking + Anatomical Locking.
 */

const INNER_LIP_INDICES = [
  78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, // Upper inner
  324, 318, 402, 317, 14, 87, 178, 88, 95          // Lower inner
];

function isPointInPoly(poly, pt) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect = ((yi > pt.y) !== (yj > pt.y)) &&
      (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function applyProfessionalAlignment(ctx, landmarks, w, h) {
  console.log("✅ ALIGNMENT V28 (GEOMETRIC PROTECTION) START");
  
  if (!landmarks || landmarks.length === 0) return;

  const imageData = ctx.getImageData(0, 0, w, h);
  const src = new Uint8ClampedArray(imageData.data); 
  const dst = imageData.data;
  
  const actualW = imageData.width;
  const actualH = imageData.height;

  // 1. Create Mouth Polygon (Inner Lip)
  const mouthPoly = INNER_LIP_INDICES.map(idx => ({
    x: landmarks[idx].x * actualW,
    y: landmarks[idx].y * actualH
  }));

  // 2. ROI Calculation (Bounding Box of Inner Mouth)
  let minX = actualW, minY = actualH, maxX = 0, maxY = 0;
  mouthPoly.forEach(pt => {
    minX = Math.min(minX, pt.x); minY = Math.min(minY, pt.y);
    maxX = Math.max(maxX, pt.x); maxY = Math.max(maxY, pt.y);
  });

  // Small padding for the loop
  minX = Math.max(0, Math.floor(minX - 5));
  maxX = Math.min(actualW, Math.ceil(maxX + 5));
  minY = Math.max(0, Math.floor(minY - 5));
  maxY = Math.min(actualH, Math.ceil(maxY + 5));

  const centerX = (minX + maxX) / 2;
  const archMidY = (minY + maxY) / 2;
  const roiW = maxX - minX;
  const roiH = maxY - minY;

  // 🧪 V28 LOOP: Confined Orthodontics
  for (let y = minY; y < maxY; y++) {
    for (let x = minX; x < maxX; x++) {

      const i = (y * actualW + x) * 4;

      // 🔥 FIX 1 — GEOMETRIC HARD LOCK
      // If pixel is outside the inner mouth polygon, it is 100% protected.
      if (!isPointInPoly(mouthPoly, {x, y})) {
        dst[i] = src[i];
        dst[i+1] = src[i+1];
        dst[i+2] = src[i+2];
        dst[i+3] = 255;
        continue;
      }

      // 🔥 FIX 2 — ENAMEL-SPECIFIC SECONDARY LOCK
      const r = src[i], g = src[i + 1], b = src[i + 2];
      const isTooth = r > 120 && g > 110 && b > 100 && (Math.max(r, g, b) - Math.min(r, g, b)) < 55;

      if (!isTooth) {
        dst[i] = src[i];
        dst[i+1] = src[i+1];
        dst[i+2] = src[i+2];
        dst[i+3] = 255;
        continue;
      }

      // 3. MOVEMENT CALCULATIONS
      const nx = (x - centerX) / (roiW / 2);
      const curve = nx * nx;
      const targetY = archMidY - roiH * 0.12 * curve; 
      const dyRaw = targetY - y;

      const centerWeight = 1 - Math.abs(nx);
      const power = Math.pow(Math.max(0, centerWeight), 1.3);

      let dy = dyRaw * 0.8 * power; // Moderate force for safety
      let dx = -nx * roiW * 0.005 * power;

      // 4. SAFE SAMPLING
      const sx = Math.max(2, Math.min(actualW - 3, x - dx));
      const sy = Math.max(2, Math.min(actualH - 3, y - dy));

      const x0 = Math.floor(sx), y0 = Math.floor(sy);
      const x1 = x0 + 1, y1 = y0 + 1;
      const wx = sx - x0, wy = sy - y0;

      const p00 = (y0 * actualW + x0) * 4;
      const p10 = (y0 * actualW + x1) * 4;
      const p01 = (y1 * actualW + x0) * 4;
      const p11 = (y1 * actualW + x1) * 4;

      for (let c = 0; c < 3; c++) {
        dst[i + c] = src[p00 + c] * (1 - wx) * (1 - wy) +
                     src[p10 + c] * wx * (1 - wy) +
                     src[p01 + c] * (1 - wx) * wy +
                     src[p11 + c] * wx * wy;
      }
      
      // Micro-smoothing pass
      dst[i] = dst[i] * 0.97 + src[i] * 0.03;
      dst[i+1] = dst[i+1] * 0.97 + src[i+1] * 0.03;
      dst[i+2] = dst[i+2] * 0.97 + src[i+2] * 0.03;
      
      dst[i + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

export const applyAlignment = applyProfessionalAlignment;
