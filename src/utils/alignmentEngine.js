/**
 * ALIGNMENT ENGINE: PROFESSIONAL MOUTH-BOX MODE (V7)
 * Localized Orthodontic Core with Soft-Edge Blending.
 */

export function applyProfessionalAlignment(ctx, landmarks, w, h) {
  console.log("✅ ALIGNMENT V7 STARTED");

  if (!ctx || !landmarks) return;

  // 🦷 STEP 1: DEFINE MOUTH BOUNDARY (ROI)
  const mouthIndices = [61, 291, 78, 95, 88, 178, 87, 14, 317, 402, 318, 324];

  let minX = w, minY = h, maxX = 0, maxY = 0;

  mouthIndices.forEach(i => {
    const px = landmarks[i].x * w;
    const py = landmarks[i].y * h;

    minX = Math.min(minX, px);
    minY = Math.min(minY, py);
    maxX = Math.max(maxX, px);
    maxY = Math.max(maxY, py);
  });

  // Dynamic Padding (Professional Margin)
  const padX = (maxX - minX) * 0.25;
  const padY = (maxY - minY) * 0.35;

  minX = Math.max(0, minX - padX);
  maxX = Math.min(w, maxX + padX);
  minY = Math.max(0, minY - padY);
  maxY = Math.min(h, maxY + padY);

  console.log(`📍 MOUTH ROI: [${Math.floor(minX)}, ${Math.floor(minY)}] to [${Math.floor(maxX)}, ${Math.floor(maxY)}]`);

  const imageData = ctx.getImageData(0, 0, w, h);
  const src = new Uint8ClampedArray(imageData.data); // Source Copy
  const dst = imageData.data;                      // Destination Pointer

  // 🧠 STEP 2: CALIBRATE CENTER (ROI BASED)
  const centerX = (minX + maxX) / 2;
  const archMidY = (minY + maxY) / 2;

  // 🧠 LIP POSITIONS (for protection)
  const lipTopY = landmarks[13].y * h;
  const lipBottomY = landmarks[14].y * h;

  const boxW = maxX - minX;

  // 🧪 STEP 3: CONSTRAINED ORTHODONTIC LOOP (V7)
  for (let y = minY | 0; y < maxY; y++) {
    for (let x = minX | 0; x < maxX; x++) {

      const i = (y * w + x) * 4;

      const r = src[i], g = src[i + 1], b = src[i + 2];

      const nx = (x - centerX) / (boxW * 0.5);

      // 🦷 TARGET ARCH (Natural professional curve)
      const curve = nx * nx;
      const targetY = archMidY + (h * 0.06) * curve;

      // 🔥 CONTROLLED PROFESSIONAL FORCES (V7)
      let dx = -nx * (boxW * 0.08);         // Balanced horizontal pull
      let dy = (targetY - y) * 0.9;         // Surgical vertical lift

      // 🦷 TOOTH DETECTION (V7)
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

      // 🛡️ SKIN SHIELD (Minimum Flow)
      const distToLip = Math.min(
        Math.abs(y - lipTopY),
        Math.abs(y - lipBottomY)
      );
      const skinShield = Math.max(0.4, Math.min(1, distToLip / 25));

      dx *= skinShield;
      dy *= skinShield;

      // ✨ STEP 4: SOFT EDGE BLENDING (CRITICAL)
      // Linear falloff at box boundaries to prevent artifacts
      const edgeFadeX = Math.min(
        (x - minX) / 20,
        (maxX - x) / 20
      );
      const edgeFadeY = Math.min(
        (y - minY) / 20,
        (maxY - y) / 20
      );
      const edgeFade = Math.max(0, Math.min(1, Math.min(edgeFadeX, edgeFadeY)));

      dx *= edgeFade;
      dy *= edgeFade;

      // 🛑 LIMIT
      dx = Math.max(-35, Math.min(35, dx));
      dy = Math.max(-25, Math.min(25, dy));

      // 🎯 SAMPLING (Explicit Floor)
      const sx = Math.max(0, Math.min(w - 1, x - dx));
      const sy = Math.max(0, Math.min(h - 1, y - dy));

      const sx0 = Math.floor(sx);
      const sy0 = Math.floor(sy);
      const srcIdx = (sy0 * w + sx0) * 4;

      dst[i]     = src[srcIdx];
      dst[i + 1] = src[srcIdx + 1];
      dst[i + 2] = src[srcIdx + 2];
      dst[i + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  console.log("✅ ALIGNMENT V7 APPLIED");
}

// Compatibility Alias
export const applyAlignment = applyProfessionalAlignment;
