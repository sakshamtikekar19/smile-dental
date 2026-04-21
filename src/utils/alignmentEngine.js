/**
 * ALIGNMENT ENGINE: CLINICAL GRADE (V22)
 * Parabolic Arch + Soft ROI Edge-Fading.
 */

const INNER_LIP_INDICES = [
  78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, // Upper inner
  324, 318, 402, 317, 14, 87, 178, 88, 95          // Lower inner
];

export function applyProfessionalAlignment(ctx, landmarks, w, h) {
  console.log("✅ ALIGNMENT V22 (CLINICAL GRADE) START");
  
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

  // 🔥 V22 LOOP (CLINICAL FIX)
  for (let y = minY; y < maxY; y++) {
    for (let x = minX; x < maxX; x++) {

      const i = (y * actualW + x) * 4;

      const nx = (x - centerX) / (roiW / 2);

      // 🦷 TRUE PARABOLIC ARCH
      const curve = nx * nx;
      const targetY = archMidY + roiH * 0.10 * curve;

      // 🎯 FORCE (VISIBLE BUT SAFE)
      let dx = -nx * roiW * 0.06;
      let dy = (targetY - y) * 0.9;

      // 🛡️ SOFT EDGE FADE (REPLACES POLYGON)
      // Smoothly tapers the forces to 0 at the ROI edges to protect lips/skin
      const fadeX = Math.min((x - minX) / 20, (maxX - x) / 20);
      const fadeY = Math.min((y - minY) / 20, (maxY - y) / 20);
      const smoothFade = Math.max(0, Math.min(1, Math.min(fadeX, fadeY)));

      dx *= smoothFade;
      dy *= smoothFade;

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
