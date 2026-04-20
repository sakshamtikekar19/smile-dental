/**
 * ALIGNMENT ENGINE: MASTER V8 (HIGH-FIDELITY)
 * Orthodontics with Bilinear Interpolation for Texture Preservation.
 */

export function applyProfessionalAlignment(ctx, landmarks, w, h) {
  console.log("✅ ALIGNMENT MASTER START");

  if (!ctx || !landmarks) return;

  const imageData = ctx.getImageData(0, 0, w, h);
  const src = new Uint8ClampedArray(imageData.data); // LOCK SOURCE
  const dst = imageData.data;

  // 🦷 MOUTH ROI (Surgical Focus)
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

  // Balanced Padding (Focus on Smile Curve)
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

  // 🔥 MAIN LOOP (ROI ONLY)
  for (let y = minY | 0; y < maxY; y++) {
    for (let x = minX | 0; x < maxX; x++) {

      const i = (y * w + x) * 4;

      const r = src[i];
      const g = src[i + 1];
      const b = src[i + 2];

      const nx = (x - centerX) / (roiW / 2);

      // 🦷 TARGET ARCH (Natural Professional Curve)
      const curve = nx * nx;
      const targetY = archMidY + roiH * 0.08 * curve;

      // 🧠 CONTROLLED MOVEMENT (V8 Master Forces)
      let dx = -nx * roiW * 0.06;
      let dy = (targetY - y) * 0.8;

      // 🦷 TOOTH DETECTION (Stability Gate)
      const lum = (r + g + b) / 3;
      const isTooth = lum > 90 && r > g && r > b;

      if (isTooth) {
        dx *= 1.3;
        dy *= 1.2;
      }

      // 🛡️ EDGE FADE (15px Surgical Window)
      const edgeFade = Math.min(
        (x - minX) / 15,
        (maxX - x) / 15,
        (y - minY) / 15,
        (maxY - y) / 15,
        1
      );

      dx *= edgeFade;
      dy *= edgeFade;

      // 🎯 SOURCE COORD (Reverse Mapping)
      const sx = Math.max(0, Math.min(w - 2, x - dx));
      const sy = Math.max(0, Math.min(h - 2, y - dy));

      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = x0 + 1;
      const y1 = y0 + 1;

      const wx = sx - x0;
      const wy = sy - y0;

      // 🔥 BILINEAR INTERPOLATION (Texture Preservation)
      // Samples 4 neighboring pixels and blends for zero-artifact results
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
  console.log("✅ ALIGNMENT MASTER APPLIED");
}

// Compatibility Alias
export const applyAlignment = applyProfessionalAlignment;
