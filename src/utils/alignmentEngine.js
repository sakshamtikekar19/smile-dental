/**
 * ALIGNMENT ENGINE: PRODUCTION GRADE (V23)
 * Center-Focused Power + Power-Fade Lip Protection.
 */

const INNER_LIP_INDICES = [
  78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, // Upper inner
  324, 318, 402, 317, 14, 87, 178, 88, 95          // Lower inner
];

export function applyProfessionalAlignment(ctx, landmarks, w, h) {
  console.log("✅ ALIGNMENT V23 (PRODUCTION GRADE) START");
  
  if (!landmarks || landmarks.length === 0) return;

  const imageData = ctx.getImageData(0, 0, w, h);
  const src = new Uint8ClampedArray(imageData.data); 
  const dst = imageData.data;
  
  // Array sync for Multi-Device/Mobile stability
  const actualW = imageData.width;
  const actualH = imageData.height;

  // 🦷 ROI Calculation (Bounding box of the mouth)
  const mouthIndices = [61, 291, 78, 13, 14, 308];
  let minX = actualW, minY = actualH, maxX = 0, maxY = 0;
  mouthIndices.forEach(i => {
    const px = landmarks[i].x * actualW, py = landmarks[i].y * actualH;
    minX = Math.min(minX, px); minY = Math.min(minY, py);
    maxX = Math.max(maxX, px); maxY = Math.max(maxY, py);
  });

  // ROI Padding
  const padX = (maxX - minX) * 0.15, padY = (maxY - minY) * 0.25;
  minX = Math.max(0, Math.floor(minX - padX)); 
  maxX = Math.min(actualW, Math.ceil(maxX + padX));
  minY = Math.max(0, Math.floor(minY - padY)); 
  maxY = Math.min(actualH, Math.ceil(maxY + padY));

  const centerX = (minX + maxX) / 2;
  const archMidY = (minY + maxY) / 2;
  const roiW = maxX - minX;
  const roiH = maxY - minY;

  // 🔥 V23 LOOP (PRODUCTION GRADE)
  for (let y = minY; y < maxY; y++) {
    for (let x = minX; x < maxX; x++) {

      const i = (y * actualW + x) * 4;

      // NORMALIZED POSITION
      const nx = (x - centerX) / (roiW / 2);

      // ✅ TRUE PARABOLIC ARCH (CLINICAL)
      const curve = nx * nx;
      const targetY = archMidY - (roiH * 0.10) * curve;

      // DISTANCE FROM IDEAL ARCH
      const dyRaw = targetY - y;

      // ✅ CENTER-FOCUSED POWER (IMPORTANT FIX)
      // Transformation is strongest at center-encisors, tapers at edges
      const centerWeight = 1.0 - Math.abs(nx); 
      const power = Math.pow(Math.max(0, centerWeight), 1.5); 

      // ✅ FINAL CONTROLLED MOVEMENT (High-End Subtle correction)
      let dy = dyRaw * 0.6 * power;   
      let dx = -nx * roiW * 0.015 * power; 

      // ✅ SOFT LIP PROTECTION (Power-Fade Gate)
      const fade = Math.max(0, 1 - Math.pow(Math.abs(nx), 2.2));

      dx *= fade;
      dy *= fade;

      if (x === Math.floor(centerX) && y === Math.floor(archMidY)) {
        console.log("✅ ALIGNMENT ACTIVE:", dx, dy);
      }

      // 🎯 REVERSE SAMPLING (High-Fidelity Bilinear)
      const sx = Math.max(0, Math.min(actualW - 2, x - dx));
      const sy = Math.max(0, Math.min(actualH - 2, y - dy));

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
      dst[i + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

export const applyAlignment = applyProfessionalAlignment;
