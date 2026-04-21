/**
 * ALIGNMENT ENGINE: PRODUCTION GRADE (V26 - Absolute Alignment)
 * Stronger Arch + Center Priority + Strict Tooth Dominance.
 */

const INNER_LIP_INDICES = [
  78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, // Upper inner
  324, 318, 402, 317, 14, 87, 178, 88, 95          // Lower inner
];

export function applyProfessionalAlignment(ctx, landmarks, w, h) {
  console.log("✅ ALIGNMENT V26 (ABSOLUTE) START");
  
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
  const padX = (maxX - minX) * 0.10; 
  const padY = (maxY - minY) * 0.15; 
  minX = Math.max(0, Math.floor(minX - padX)); 
  maxX = Math.min(actualW, Math.ceil(maxX + padX));
  minY = Math.max(0, Math.floor(minY - padY)); 
  maxY = Math.min(actualH, Math.ceil(maxY + padY));

  const centerX = (minX + maxX) / 2;
  const archMidY = (minY + maxY) / 2;
  const roiW = maxX - minX;
  const roiH = maxY - minY;

  // 🧪 V26 LOOP: Absolute Orthodontics
  for (let y = minY; y < maxY; y++) {
    for (let x = minX; x < maxX; x++) {

      const i = (y * actualW + x) * 4;

      // NORMALIZED POSITION
      const nx = (x - centerX) / (roiW / 2);

      // 🦷 TRUE ARCH (UPWARD, NOT DOWNWARD)
      const curve = nx * nx;
      const targetY = archMidY - roiH * 0.14 * curve; // stronger arch

      const dyRaw = targetY - y;

      // 🎯 CENTER PRIORITY
      const centerWeight = 1 - Math.abs(nx);
      const power = Math.pow(Math.max(0, centerWeight), 1.3);

      // ✅ FINAL MOVEMENT (FIXED BALANCE)
      let dy = dyRaw * 1.4 * power;   // STRONG vertical (main movement)
      let dx = -nx * roiW * 0.008 * power; // VERY LOW horizontal

      // 🛡️ TOOTH-ONLY DOMINANCE (CRITICAL FIX)
      const r = src[i];
      const g = src[i + 1];
      const b = src[i + 2];

      const isTooth =
        r > 130 &&
        g > 120 &&
        b > 110 &&
        (Math.max(r, g, b) - Math.min(r, g, b)) < 50;

      // MUCH LOWER skin influence
      const blend = isTooth ? 1.0 : 0.03;

      dx *= blend;
      dy *= blend;

      // 🛡️ EDGE FADE (LIP PROTECTION)
      const edgeFade = Math.min(
        (x - minX) / 20,
        (maxX - x) / 20,
        (y - minY) / 20,
        (maxY - y) / 20,
        1
      );

      dx *= edgeFade;
      dy *= edgeFade;

      // FINAL SAFETY (OPTIONAL BUT SMART)
      // Add clamp to avoid extreme warping:
      dx = Math.max(-4, Math.min(4, dx));
      dy = Math.max(-6, Math.min(6, dy));

      // 🔥 FIX 4: CORRECT DIAGNOSTIC LOG
      if (Math.abs(nx) < 0.05 && y === Math.floor(archMidY)) {
        console.log("✅ CENTER FORCE:", dx, dy);
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
