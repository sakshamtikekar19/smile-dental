/**
 * ALIGNMENT ENGINE: GEOMETRIC PRECISION (V15 - Dynamic Scale)
 * Mask sizes dynamically adjust to camera distance to prevent zero-warp.
 */

const INNER_LIP_INDICES = [
  78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, // Upper inner
  324, 318, 402, 317, 14, 87, 178, 88, 95          // Lower inner
];

export function applyProfessionalAlignment(ctx, landmarks, w, h) {
  if (!landmarks || landmarks.length === 0) return;

  // 1. MEASURE THE MOUTH FIRST (To know how far away the user is)
  const mouthIndices = [61, 291, 78, 13, 14, 308];
  let minX = w, minY = h, maxX = 0, maxY = 0;
  mouthIndices.forEach(i => {
    const px = landmarks[i].x * w, py = landmarks[i].y * h;
    minX = Math.min(minX, px); minY = Math.min(minY, py);
    maxX = Math.max(maxX, px); maxY = Math.max(maxY, py);
  });

  const roiW = maxX - minX;
  const roiH = maxY - minY;

  // 2. 🎭 THE DYNAMIC INNER-FEATHERED MASK
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = w; maskCanvas.height = h;
  const mctx = maskCanvas.getContext("2d", { willReadFrequently: true });

  mctx.fillStyle = "black";
  mctx.fillRect(0, 0, w, h);

  const mouthPath = new Path2D();
  INNER_LIP_INDICES.forEach((idx, i) => {
    const px = landmarks[idx].x * w;
    const py = landmarks[idx].y * h;
    if (i === 0) mouthPath.moveTo(px, py);
    else mouthPath.lineTo(px, py);
  });
  mouthPath.closePath();

  mctx.save();
  mctx.clip(mouthPath); 
  
  mctx.fillStyle = "white";
  mctx.fill(mouthPath);

  // 🔥 FIX 1: DYNAMIC SCALING
  // Instead of a hard 35px, the mask thickness is exactly 30% of the mouth height.
  // If you move away from the camera, the mask shrinks to fit!
  const dynamicStroke = Math.max(6, roiH * 0.30); 
  const dynamicBlur = Math.max(4, roiH * 0.15);

  mctx.filter = `blur(${dynamicBlur}px)`;
  mctx.strokeStyle = "black";
  mctx.lineWidth = dynamicStroke; 
  mctx.stroke(mouthPath);
  
  mctx.restore();

  const maskData = mctx.getImageData(0, 0, w, h).data;

  // 3. ROI SURGICAL BOUNDING BOX
  const padX = roiW * 0.25, padY = roiH * 0.40;
  minX = Math.max(0, minX - padX); maxX = Math.min(w, maxX + padX);
  minY = Math.max(0, minY - padY); maxY = Math.min(h, maxY + padY);

  const imageData = ctx.getImageData(0, 0, w, h);
  const src = new Uint8ClampedArray(imageData.data); 
  const dst = imageData.data;

  const centerX = (minX + maxX) / 2, archMidY = (minY + maxY) / 2;
  const resScale = (w < 1000) ? 1.4 : 1.0;

  // 🧪 V15 LOOP: Dynamic Warping
  for (let y = minY | 0; y < maxY; y++) {
    for (let x = minX | 0; x < maxX; x++) {
      
      const i = (y * w + x) * 4;
      const maskVal = maskData[i] / 255; 
      
      if (maskVal < 0.05) continue; // Safe skip

      const nx = (x - centerX) / (roiW / 2);
      const curve = nx * nx;
      const targetY = archMidY + roiH * 0.04 * curve;

      // 🔥 FIX 2: Restored Warp Forces
      // Bumped dx slightly so the alignment is visible but doesn't cause catfish lips.
      let dx = -nx * roiW * 0.06 * resScale * maskVal; 
      let dy = (targetY - y) * 0.7 * resScale * maskVal;

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
      // Preserve alpha
      dst[i + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  console.log("✅ ALIGNMENT V15 (DYNAMIC SCALE) APPLIED");
}

export const applyAlignment = applyProfessionalAlignment;
