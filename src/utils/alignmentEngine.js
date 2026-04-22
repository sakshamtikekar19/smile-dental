/**
 * ALIGNMENT ENGINE: ORTHODONTIC ARCHWIRE (V33)
 * Introduces "Magnetic Leveling" to flatten the occlusal plane (tooth edges)
 * against an ideal mathematical smile curve, mimicking real braces.
 */

const INNER_LIP_INDICES = [
  78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, // Upper inner
  324, 318, 402, 317, 14, 87, 178, 88, 95          // Lower inner
];

// High-speed mathematical fence
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

export function applyProfessionalAlignment(ctx, landmarks, w, h, intensity = 1.0) {
  if (!landmarks || landmarks.length === 0) return;

  const imageData = ctx.getImageData(0, 0, w, h);
  const src = new Uint8ClampedArray(imageData.data); 
  const dst = imageData.data;
  
  const actualW = imageData.width;
  const actualH = imageData.height;

  const mouthPoly = INNER_LIP_INDICES.map(idx => ({
    x: landmarks[idx].x * actualW,
    y: landmarks[idx].y * actualH
  }));

  let minX = actualW, minY = actualH, maxX = 0, maxY = 0;
  mouthPoly.forEach(pt => {
    minX = Math.min(minX, pt.x); minY = Math.min(minY, pt.y);
    maxX = Math.max(maxX, pt.x); maxY = Math.max(maxY, pt.y);
  });

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const roiW = maxX - minX;
  const roiH = maxY - minY;

  if (roiW === 0 || roiH === 0) return;

  // 🧪 V33 LOOP: The Magnetic Archwire
  for (let y = Math.floor(minY); y < Math.ceil(maxY); y++) {
    for (let x = Math.floor(minX); x < Math.ceil(maxX); x++) {
      
      // 🛑 GATE 1: Protect the outside face
      if (!isPointInPoly(mouthPoly, {x, y})) continue;

      const i = (y * actualW + x) * 4;

      const nx = (x - centerX) / (roiW / 2);
      const ny = (y - centerY) / (roiH / 2);

      const distSq = (nx * nx) + (ny * ny);
      if (distSq > 0.95) continue; 
      
      let weight = 1.0 - distSq;
      weight = weight * weight * weight; 

      // 🔥 FIX 1: THE INVISALIGN CURVE
      // We mathematically calculate the perfect U-shape for the smile.
      // It sits slightly above the center and curves upwards at the corners.
      const idealArchY = (centerY - roiH * 0.05) - (nx * nx * roiH * 0.12);

      // 🔥 FIX 2: MAGNETIC LEVELING PHYSICS
      // Instead of just pushing "up", we measure how far the current pixel is 
      // from the ideal arch. We then compress the pixel towards that perfect line.
      // This smooths out bumpy, jagged tooth edges.
      let dy = (y - idealArchY) * 0.22 * weight * intensity; 
      
      // Gentle horizontal closure to fix spacing
      let dx = nx * roiW * 0.025 * weight * intensity; 

      // Calculate the source pixel
      const sx = x + dx;
      const sy = y + dy;

      // 🛑 GATE 2: The Hermetic Seal (Zero Lip Smearing)
      if (!isPointInPoly(mouthPoly, {x: sx, y: sy})) {
         continue; 
      }

      // Safe HD Bilinear Sampling
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
      
      dst[i + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

export const applyAlignment = applyProfessionalAlignment;
