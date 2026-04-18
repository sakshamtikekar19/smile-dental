// 🔒 DO NOT MODIFY — CPU-SYNCHRONIZED CLINICAL ZOOM (LOCKED)

/**
 * 🔍 CPU-SYNCHRONIZED PIXEL MAPPING
 * Magnifies the dental region exactly 3.0x using raw memory mapping.
 * FIXED: Bypasses mobile GPU compositor failures by handling magnification in RAM.
 */
export function applyClinicalZoom(ctx, landmarks, w, h, sourceCanvas) {
  if (!landmarks || !sourceCanvas) return;

  const srcCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
  const dstW = ctx.canvas.width;
  const dstH = ctx.canvas.height;

  // 🛡️ CAPTURE SOURCE DATA (Synchronous Memory Lock)
  let srcData;
  try {
    srcData = srcCtx.getImageData(0, 0, w, h);
  } catch {
    return;
  }

  // 🔍 Compute mouth bounding box (Surgical Focus)
  const mouthIndices = [61, 291, 78, 95, 88, 178, 87, 14, 317, 402, 318, 324];
  let minX = w, minY = h, maxX = 0, maxY = 0;

  for (let i of mouthIndices) {
    const pt = landmarks[i];
    if (!pt) continue;
    const x = pt.x * w, y = pt.y * h;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  // 🧠 SURGICAL PADDING (25% X, 30% Y)
  const padX = (maxX - minX) * 0.25;
  const padY = (maxY - minY) * 0.30;

  minX = Math.max(0, Math.floor(minX - padX));
  minY = Math.max(0, Math.floor(minY - padY));
  maxX = Math.min(w, Math.ceil(maxX + padX));
  maxY = Math.min(h, Math.ceil(maxY + padY));

  const boxW = maxX - minX;
  const boxH = maxY - minY;
  if (boxW <= 0 || boxH <= 0) return;

  const scale = 3.0;

  // Initialize destination buffer
  const dstData = ctx.createImageData(dstW, dstH);
  const src = srcData.data;
  const dst = dstData.data;

  // Calculate centered viewport metrics
  const newW = boxW * scale;
  const newH = boxH * scale;
  const offsetX = Math.floor((dstW - newW) / 2);
  const offsetY = Math.floor((dstH - newH) / 2);

  // 🔁 PIXEL MAPPING (Manual Backward Sampling in RAM)
  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      const di = (y * dstW + x) * 4;

      // Map back to source coordinates
      const sx = (x - offsetX) / scale + minX;
      const sy = (y - offsetY) / scale + minY;

      const ix = Math.floor(sx);
      const iy = Math.floor(sy);

      if (ix >= 0 && ix < w && iy >= 0 && iy < h) {
        const si = (iy * w + ix) * 4;
        dst[di]     = src[si];
        dst[di + 1] = src[si + 1];
        dst[di + 2] = src[si + 2];
        dst[di + 3] = src[si + 3];
      } else {
        // Clinical card background (Pure Black)
        dst[di] = 0;   
        dst[di + 1] = 0; 
        dst[di + 2] = 0;
        dst[di + 3] = 255;
      }
    }
  }

  // 🎯 PUSH DATA TO VIEWPORT (Zero GPU Sampling)
  ctx.putImageData(dstData, 0, 0);
}
