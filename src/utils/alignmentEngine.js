/**
 * ALIGNMENT ENGINE: PRODUCTION GRADE (V29 - Strict Enamel Isolation)
 * Anatomical Buffering + Tighter Enamel Logic.
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
  console.log("✅ ALIGNMENT V29 (STRICT ISOLATION) START");
  
  if (!landmarks || landmarks.length === 0) return;

  const imageData = ctx.getImageData(0, 0, w, h);
  const src = new Uint8ClampedArray(imageData.data); 
  const dst = imageData.data;
  
  const actualW = imageData.width;
  const actualH = imageData.height;

  // 1. Create Base Mouth Polygon
  const mouthPoly = INNER_LIP_INDICES.map(idx => ({
    x: landmarks[idx].x * actualW,
    y: landmarks[idx].y * actualH
  }));

  // 2. ROI Calculation
  let minX = actualW, minY = actualH, maxX = 0, maxY = 0;
  mouthPoly.forEach(pt => {
    minX = Math.min(minX, pt.x); minY = Math.min(minY, pt.y);
    maxX = Math.max(maxX, pt.x); maxY = Math.max(maxY, pt.y);
  });

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const roiW = maxX - minX;
  const roiH = maxY - minY;

  // 3. 🔥 CREATE INTERNAL SAFE ZONE (SHRINK POLYGON BY 15%)
  // This creates a physical gap between the lips and the movement area.
  const safePoly = mouthPoly.map(pt => ({
    x: pt.x + (centerX - pt.x) * 0.15,
    y: pt.y + (centerY - pt.y) * 0.15
  }));

  // 🧪 V29 LOOP: Precision Orthodontics
  for (let y = Math.floor(minY - 10); y < Math.ceil(maxY + 10); y++) {
    for (let x = Math.floor(minX - 10); x < Math.ceil(maxX + 10); x++) {
      if (x < 0 || x >= actualW || y < 0 || y >= actualH) continue;

      const i = (y * actualW + x) * 4;

      // 🔥 FIX 1 — HARD ANATOMICAL BUFFER
      // If pixel is outside the SHRINKED polygon, it is 100% locked.
      if (!isPointInPoly(safePoly, {x, y})) {
        dst[i] = src[i];
        dst[i+1] = src[i+1];
        dst[i+2] = src[i+2];
        dst[i+3] = 255;
        continue;
      }

      // 🔥 FIX 2 — STRICT ENAMEL DETECTION (Higher thresholds)
      const r = src[i], g = src[i + 1], b = src[i + 2];
      const isTooth = 
        r > 155 && 
        g > 145 && 
        b > 130 && 
        (Math.max(r, g, b) - Math.min(r, g, b)) < 35; // Lower saturation = more enamel-like

      if (!isTooth) {
        dst[i] = src[i];
        dst[i+1] = src[i+1];
        dst[i+2] = src[i+2];
        dst[i+3] = 255;
        continue;
      }

      // 4. MOVEMENT CALCULATIONS
      const nx = (x - centerX) / (roiW / 2);
      const curve = nx * nx;
      const targetY = centerY - (roiH * 0.08) * curve; // Subtler arch
      const dyRaw = targetY - y;

      const centerWeight = 1 - Math.abs(nx);
      const power = Math.pow(Math.max(0, centerWeight), 1.4);

      let dy = dyRaw * 0.7 * power; // Conservative force
      let dx = -nx * roiW * 0.003 * power;

      // 5. SAFE SAMPLING
      const sx = Math.max(3, Math.min(actualW - 4, x - dx));
      const sy = Math.max(3, Math.min(actualH - 4, y - dy));

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
      
      // Precision micro-blend
      dst[i] = dst[i] * 0.96 + src[i] * 0.04;
      dst[i+1] = dst[i+1] * 0.96 + src[i+1] * 0.04;
      dst[i+2] = dst[i+2] * 0.96 + src[i+2] * 0.04;
      
      dst[i + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

export const applyAlignment = applyProfessionalAlignment;
