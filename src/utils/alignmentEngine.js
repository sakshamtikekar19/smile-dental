/**
 * ALIGNMENT ENGINE: GEOMETRIC PRECISION (V11)
 * Stencil-Masked Orthodontics for Zero-Glitch Facial Preservation.
 */

const INNER_LIP_INDICES = [
  78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, // Upper inner
  324, 318, 402, 317, 14, 87, 178, 88, 95          // Lower inner
];

export function applyProfessionalAlignment(ctx, landmarks, w, h) {
  console.log("✅ ALIGNMENT V11 GEOMETRIC START");

  if (!ctx || !landmarks) return;

  // 1. 🎭 STENCIL MASK GENERATION (Absolute Skin Protection)
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = w;
  maskCanvas.height = h;
  const mctx = maskCanvas.getContext("2d", { willReadFrequently: true });

  const mouthPath = new Path2D();
  INNER_LIP_INDICES.forEach((idx, i) => {
    const p = landmarks[idx];
    if (!p) return;
    const px = p.x * w;
    const py = p.y * h;
    if (i === 0) mouthPath.moveTo(px, py);
    else mouthPath.lineTo(px, py);
  });
  mouthPath.closePath();

  mctx.filter = "blur(8px)"; // Soft transition for dental-to-gum blending
  mctx.fillStyle = "white";
  mctx.fill(mouthPath);
  
  const maskData = mctx.getImageData(0, 0, w, h).data;

  // 🦷 ROI Calculation (Localized focus)
  const mouthIndices = [61, 291, 78, 95, 88, 178, 87, 14, 317, 402, 318, 324];
  let minX = w, minY = h, maxX = 0, maxY = 0;
  mouthIndices.forEach(i => {
    const px = landmarks[i].x * w;
    const py = landmarks[i].y * h;
    minX = Math.min(minX, px); minY = Math.min(minY, py);
    maxX = Math.max(maxX, px); maxY = Math.max(maxY, py);
  });

  const padX = (maxX - minX) * 0.25;
  const padY = (maxY - minY) * 0.40;
  minX = Math.max(0, minX - padX); maxX = Math.min(w, maxX + padX);
  minY = Math.max(0, minY - padY); maxY = Math.min(h, maxY + padY);

  const imageData = ctx.getImageData(0, 0, w, h);
  const src = new Uint8ClampedArray(imageData.data); 
  const dst = imageData.data;

  const centerX = (minX + maxX) / 2;
  const archMidY = (minY + maxY) / 2;
  const roiW = maxX - minX;
  const roiH = maxY - minY;

  const resScale = (w < 1000) ? 1.4 : 1.0;

  // 🧪 V11 GEOMETRIC LOOP
  for (let y = minY | 0; y < maxY; y++) {
    for (let x = minX | 0; x < maxX; x++) {

      const i = (y * w + x) * 4;

      // 🛡️ STENCIL PROTECTION CHECK
      const maskVal = maskData[i + 3] / 255;
      if (maskVal < 0.02) continue; // Hard skip for out-of-mouth pixels (Total Safety)

      const nx = (x - centerX) / (roiW / 2);

      // 🦷 TARGET ARCH (V11 Clinical Straightening)
      const curve = nx * nx;
      const targetY = archMidY + roiH * 0.07 * curve;

      // 🔥 V11 HIGH-VISIBILITY FORCES (Only inside stencil)
      let dx = -nx * roiW * 0.12 * resScale; 
      let dy = (targetY - y) * 1.2 * resScale;

      // Scale forces by stencil visibility (Invisible transition to lips)
      dx *= maskVal;
      dy *= maskVal;

      // 🎯 SOURCE COORD (High-Fidelity Bilinear)
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
  console.log("✅ ALIGNMENT V11 GEOMETRIC APPLIED");
}

export const applyAlignment = applyProfessionalAlignment;
