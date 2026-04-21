/**
 * ALIGNMENT ENGINE: PROFESSIONAL STABILIZED (V9)
 * Clinical-Grade Orthodontics with Non-Linear Damping and Skin Protection.
 */

export function applyProfessionalAlignment(ctx, landmarks, w, h) {
  console.log("✅ ALIGNMENT V9 STABILIZED START");

  if (!ctx || !landmarks) return;

  const imageData = ctx.getImageData(0, 0, w, h);
  const src = new Uint8ClampedArray(imageData.data); 
  const dst = imageData.data;

  // 🦷 MOUTH ROI (Localized focus for stability)
  const mouthIndices = [61, 291, 78, 95, 88, 178, 87, 14, 317, 402, 318, 324];

  let minX = w, minY = h, maxX = 0, maxY = 0;

  mouthIndices.forEach(i => {
    const x = landmarks[i].x * w;
    const y = landmarks[i].y * h;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  });

  // Balanced Padding (Ensures zero-clipping of lateral teeth)
  const padX = (maxX - minX) * 0.2;
  const padY = (maxY - minY) * 0.3;

  minX = Math.max(0, minX - padX);
  maxX = Math.min(w, maxX + padX);
  minY = Math.max(0, minY - padY);
  maxY = Math.min(h, maxY + padY);

  const centerX = (minX + maxX) / 2;
  const archMidY = (minY + maxY) / 2;

  const roiW = maxX - minX;
  const roiH = maxY - minY;

  // 🧪 V9 STABILIZED LOOP
  for (let y = minY | 0; y < maxY; y++) {
    for (let x = minX | 0; x < maxX; x++) {

      const i = (y * w + x) * 4;

      const r = src[i];
      const g = src[i + 1];
      const b = src[i + 2];

      const nx = (x - centerX) / (roiW / 2);

      // 🦷 TARGET ARCH (V9 - Flatter Clinical Curve)
      const curve = nx * nx;
      const targetY = archMidY + roiH * 0.05 * curve;

      // 🧠 V9 DAMPENED FORCES (Prevents lip-smear glitches)
      let dx = -nx * roiW * 0.04;    // Subtle horizontal pull
      let dy = (targetY - y) * 0.5;  // Stabilized vertical lift

      // 🛡️ SKIN PROTECTION GATE (Color-Based Masking)
      const isLip = r > g * 1.35 && r > b * 1.35; // Strong red tint detection
      const isSkin = r > 105 && g > 65 && b > 45 && (r - g) > 15; // Basic flesh detection
      
      let forceMult = 1.0;
      if (isLip || isSkin) {
        forceMult = 0.2; // Aggressively drop force on soft tissue
      } else {
        // Boost for enamel pixels (Brightness/Croma Check)
        const lum = (r + g + b) / 3;
        if (lum > 90 && r > g && r > 110) {
          forceMult = 1.3; 
        }
      }

      dx *= forceMult;
      dy *= forceMult;

      // ✨ ULTRA-SMOOTH EDGE FADE (35px squared window)
      let edgeFade = Math.min(
        (x - minX) / 35,
        (maxX - x) / 35,
        (y - minY) / 35,
        (maxY - y) / 35,
        1
      );
      edgeFade = Math.max(0, edgeFade);
      edgeFade *= edgeFade; // Non-linear falloff for seamless blending

      dx *= edgeFade;
      dy *= edgeFade;

      // 🎯 SOURCE COORD (High-Fidelity Bilinear Mapping)
      const sx = Math.max(0, Math.min(w - 2, x - dx));
      const sy = Math.max(0, Math.min(h - 2, y - dy));

      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = x0 + 1;
      const y1 = y0 + 1;

      const wx = sx - x0;
      const wy = sy - y0;

      for (let c = 0; c < 3; c++) {
        const c00 = src[(y0 * w + x0) * 4 + c];
        const c10 = src[(y0 * w + x1) * 4 + c];
        const c01 = src[(y1 * w + x0) * 4 + c];
        const c11 = src[(y1 * w + x1) * 4 + c];

        const value =
          c00 * (1 - wx) * (1 - wy) +
          c10 * wx * (1 - wy) +
          c01 * (1 - wx) * wy +
          c11 * wx * wy;

        dst[i + c] = value;
      }

      dst[i + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  console.log("✅ ALIGNMENT V9 STABILIZED APPLIED");
}

export const applyAlignment = applyProfessionalAlignment;
