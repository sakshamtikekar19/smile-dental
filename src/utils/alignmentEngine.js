/**
 * ALIGNMENT ENGINE: THE CONTINUOUS FIELD (V30 - Hard Fix)
 * Removes pixel-level color guessing to eliminate jagged glitches entirely.
 * Uses a purely mathematical gradient safe-zone to protect lips/gums/mustache.
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
  console.log("✅ ALIGNMENT V30 (CONTINUOUS FIELD) START");
  
  if (!landmarks || landmarks.length === 0) return;

  const imageData = ctx.getImageData(0, 0, w, h);
  const src = new Uint8ClampedArray(imageData.data); 
  const dst = imageData.data;
  
  const actualW = imageData.width;
  const actualH = imageData.height;

  // 1. Create Base Mouth Polygon (The Absolute Boundary)
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

  // 🧪 V30 LOOP: Fluid, Glitch-Free Distortion
  for (let y = Math.floor(minY); y < Math.ceil(maxY); y++) {
    for (let x = Math.floor(minX); x < Math.ceil(maxX); x++) {
      
      // 🛑 GATE 1: Geometric Outside Fence
      // If a pixel is physically outside the lip polygon (mustache/skin), DO NOT TOUCH IT.
      if (!isPointInPoly(mouthPoly, {x, y})) continue;

      const i = (y * actualW + x) * 4;

      const nx = (x - centerX) / (roiW / 2);
      const ny = (y - centerY) / (roiH / 2);

      // 🔥 FIX 1: The Continuous Buffer (Zero Tearing)
      // Instead of guessing colors, we use distance. The closer a pixel gets to the 
      // edge of the bounding box (the lips/gums), the less it is allowed to move.
      const distSq = nx * nx + ny * ny;
      
      // If we are at the outer edges of the mouth, force movement to 0.0
      let smoothFade = 1.0 - (distSq * 1.2); 
      if (smoothFade < 0) smoothFade = 0;
      
      // Ease-in curve so the transition is silky smooth
      smoothFade = smoothFade * smoothFade * (3 - 2 * smoothFade);

      // 4. MOVEMENT CALCULATIONS
      const curve = nx * nx;
      const targetY = centerY - (roiH * 0.06) * curve; 
      const dyRaw = targetY - y;

      // Multiply the force by our smoothFade so it stops moving near the lips
      let dx = -nx * roiW * 0.02 * smoothFade;
      let dy = dyRaw * 0.5 * smoothFade;

      const sx = x - dx;
      const sy = y - dy;

      // 🛑 GATE 2: The Source-Theft Killer
      // If the math accidentally tries to pull a pixel from the lip inward, abort!
      if (!isPointInPoly(mouthPoly, {x: sx, y: sy})) continue;

      // 5. HD BILINEAR SAMPLING (Keeps enamel looking high-definition)
      const x0 = Math.max(0, Math.min(actualW - 2, Math.floor(sx)));
      const y0 = Math.max(0, Math.min(actualH - 2, Math.floor(sy)));
      const x1 = x0 + 1;
      const y1 = y0 + 1;
      const wx = sx - x0;
      const wy = sy - y0;

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
      
      // Preserve alpha
      dst[i + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

export const applyAlignment = applyProfessionalAlignment;
