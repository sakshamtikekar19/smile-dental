/**
 * ALIGNMENT ENGINE: GEOMETRIC PRECISION (V12)
 * Pure Ray-Casting for Absolute Zero-Glitch Facial Preservation.
 */

const INNER_LIP_INDICES = [
  78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, // Upper inner
  324, 318, 402, 317, 14, 87, 178, 88, 95          // Lower inner
];

// 🧠 The Mathematical Fence! (Ray-Casting Algorithm)
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

export function applyProfessionalAlignment(ctx, landmarks, w, h) {
  console.log("✅ ALIGNMENT V12 (RAY-CASTING) START");
  
  if (!landmarks || landmarks.length === 0) return;

  // 1. 🎭 THE INVISIBLE FENCE: Exact coordinates of the inner lips
  const mouthPolygon = [];
  INNER_LIP_INDICES.forEach((idx) => {
    mouthPolygon.push({
      x: landmarks[idx].x * w,
      y: landmarks[idx].y * h
    });
  });

  // 🦷 ROI: Surgical bounding box for performance
  const mouthIndices = [61, 291, 78, 13, 14, 308];
  let minX = w, minY = h, maxX = 0, maxY = 0;
  mouthIndices.forEach(i => {
    const px = landmarks[i].x * w, py = landmarks[i].y * h;
    minX = Math.min(minX, px); minY = Math.min(minY, py);
    maxX = Math.max(maxX, px); maxY = Math.max(maxY, py);
  });

  const padX = (maxX - minX) * 0.25, padY = (maxY - minY) * 0.40;
  minX = Math.max(0, minX - padX); maxX = Math.min(w, maxX + padX);
  minY = Math.max(0, minY - padY); maxY = Math.min(h, maxY + padY);

  const imageData = ctx.getImageData(0, 0, w, h);
  const src = new Uint8ClampedArray(imageData.data); 
  const dst = imageData.data;

  const centerX = (minX + maxX) / 2, archMidY = (minY + maxY) / 2;
  const roiW = maxX - minX, roiH = maxY - minY;
  const resScale = (w < 1000) ? 1.4 : 1.0;

  // 🧪 V12 LOOP: 100% Geometry-Masked Warp
  for (let y = minY | 0; y < maxY; y++) {
    for (let x = minX | 0; x < maxX; x++) {
        
      // 🛑 THE FENCE: If the pixel is outside the lips, DO NOT WARP IT!
      // This instantly protects the mustache, chin, and outer lips from distortion.
      if (!isPixelInsidePolygon(x, y, mouthPolygon)) {
          continue; 
      }

      const i = (y * w + x) * 4;

      const nx = (x - centerX) / (roiW / 2);
      const curve = nx * nx;
      const targetY = archMidY + roiH * 0.07 * curve;

      // Forces: 0.12 Pull / 1.2 Lift 
      let dx = -nx * roiW * 0.12 * resScale; 
      let dy = (targetY - y) * 1.2 * resScale;

      // Reverse map with Bilinear Interpolation
      const sx = Math.max(0, Math.min(w - 2, x - dx));
      const sy = Math.max(0, Math.min(h - 2, y - dy));

      const x0 = Math.floor(sx), y0 = Math.floor(sy);
      const x1 = x0 + 1, y1 = y0 + 1;
      const wx = sx - x0, wy = sy - y0;

      for (let c = 0; c < 3; c++) {
        const c00 = src[(y0 * w + x0) * 4 + c];
        const c10 = src[(y0 * w + x1) * 4 + c];
        const c01 = src[(y1 * w + x0) * 4 + c];
        const c11 = src[(y1 * w + x1) * 4 + c];

        dst[i + c] = c00 * (1 - wx) * (1 - wy) +
                     c10 * wx * (1 - wy) +
                     c01 * (1 - wx) * wy +
                     c11 * wx * wy;
      }
      dst[i + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  console.log("✅ ALIGNMENT V12 (RAY-CASTING) APPLIED");
}

export const applyAlignment = applyProfessionalAlignment;
