/**
 * ALIGNMENT ENGINE: GEOMETRIC PRECISION (V13)
 * Inner-Feathered Masking for Seamless Blending & Zero Face Glitch.
 */

const INNER_LIP_INDICES = [
  78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, // Upper inner
  324, 318, 402, 317, 14, 87, 178, 88, 95          // Lower inner
];

export function applyProfessionalAlignment(ctx, landmarks, w, h) {
  if (!landmarks || landmarks.length === 0) return;

  // 1. 🎭 THE INNER-FEATHERED MASK
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = w; maskCanvas.height = h;
  const mctx = maskCanvas.getContext("2d", { willReadFrequently: true });

  // Start with a totally black (0% warp) canvas to protect the face
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
  // 🔥 CRITICAL: Clip the canvas. Nothing drawn after this can EVER leave the mouth.
  mctx.clip(mouthPath); 

  // Fill the inside with white (100% warp)
  mctx.fillStyle = "white";
  mctx.fill(mouthPath);

  // Feather the inner edge. We draw a blurred black line on the boundary.
  // Because the canvas is clipped, the blur only spreads INWARD, fading the warp to 0 smoothly.
  mctx.filter = "blur(6px)";
  mctx.strokeStyle = "black";
  mctx.lineWidth = 12; 
  mctx.stroke(mouthPath);
  
  mctx.restore();

  const maskData = mctx.getImageData(0, 0, w, h).data;

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

  // 🧪 V13 LOOP: Smooth, Tapered Warping
  for (let y = minY | 0; y < maxY; y++) {
    for (let x = minX | 0; x < maxX; x++) {
      
      const i = (y * w + x) * 4;
      
      // Grab the warp strength from our feathered mask (0.0 to 1.0)
      const maskVal = maskData[i] / 255; 
      
      // If mask is effectively zero (outside mouth or deep in the feathered edge), skip processing
      if (maskVal < 0.02) continue; 

      const nx = (x - centerX) / (roiW / 2);
      const curve = nx * nx;
      const targetY = archMidY + roiH * 0.07 * curve;

      // 🎯 MULTIPLY BY MASK: The warp automatically reduces to 0 smoothly at the lip line!
      let dx = -nx * roiW * 0.12 * resScale * maskVal; 
      let dy = (targetY - y) * 1.2 * resScale * maskVal;

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
  console.log("✅ ALIGNMENT V13 (INNER-FEATHERED) APPLIED");
}

export const applyAlignment = applyProfessionalAlignment;
