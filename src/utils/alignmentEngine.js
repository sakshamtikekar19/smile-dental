/**
 * ALIGNMENT ENGINE: FULL-CANVAS V6 (WHOLE FRAME)
 * Production-Safe Orthodontic Core with Zero-Clipping Architecture.
 */

export function applyProfessionalAlignment(ctx, landmarks, w, h) {
  console.log("✅ ALIGNMENT FUNCTION STARTED");

  if (!ctx || !landmarks) return;

  const imageData = ctx.getImageData(0, 0, w, h);
  const src = new Uint8ClampedArray(imageData.data); // IMPORTANT COPY
  const dst = imageData.data;

  const safeW = w;
  const safeH = h;

  // 🧠 TRUE FACE CENTER (NOT BOX CENTER)
  const centerX = landmarks[13].x * w;
  const archMidY = landmarks[13].y * h;

  // 🧠 LIP POSITIONS (for protection)
  const lipTopY = landmarks[13].y * h;
  const lipBottomY = landmarks[14].y * h;

  for (let y = 0; y < safeH; y++) {
    for (let x = 0; x < safeW; x++) {

      const i = (y * safeW + x) * 4;

      const r = src[i];
      const g = src[i + 1];
      const b = src[i + 2];

      const nx = (x - centerX) / (safeW * 0.5);

      // 🦷 TARGET ARCH (natural curve)
      const curve = nx * nx;
      const targetY = archMidY + (safeH * 0.06) * curve;

      // 🔥 STRONG VISIBLE MOVEMENT
      let dx = -nx * (safeW * 0.22);
      let dy = (targetY - y) * 1.6;

      // 🦷 TOOTH DETECTION (stable)
      const lum = (r + g + b) / 3;
      const isTooth =
        lum > 85 &&
        r > b &&
        (r - g) < 40 &&
        (r - b) < 60;

      if (isTooth) {
        dx *= 1.5;
        dy *= 1.3;
      } else {
        dx *= 0.6;
        dy *= 0.5;
      }

      // 🛡️ SKIN SHIELD (FIXED — never zero)
      const distToLip = Math.min(
        Math.abs(y - lipTopY),
        Math.abs(y - lipBottomY)
      );

      const skinShield = Math.max(0.4, Math.min(1, distToLip / 25));

      dx *= skinShield;
      dy *= skinShield;

      // 🛑 LIMIT (avoid distortion)
      dx = Math.max(-35, Math.min(35, dx));
      dy = Math.max(-25, Math.min(25, dy));

      // 🎯 SAMPLING
      const sx = Math.max(0, Math.min(safeW - 1, x - dx));
      const sy = Math.max(0, Math.min(safeH - 1, y - dy));

      const sx0 = Math.floor(sx);
      const sy0 = Math.floor(sy);

      const srcIdx = (sy0 * safeW + sx0) * 4;

      dst[i]     = src[srcIdx];
      dst[i + 1] = src[srcIdx + 1];
      dst[i + 2] = src[srcIdx + 2];
      dst[i + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  console.log("✅ ALIGNMENT APPLIED TO CANVAS");
}

// Compatibility Alias
export const applyAlignment = applyProfessionalAlignment;
