// 🔒 DO NOT MODIFY — 3X CLINICAL ZOOM (LOCKED)

/**
 * 🔍 BULLETPROOF CLINICAL ZOOM (PIXEL COPY — NO drawImage)
 * Magnifies the dental region exactly 3.0x using direct memory mapping.
 * FIXED: Bypasses GPU-compositor artifacts by reading raw pixel buffers.
 */
export function applyClinicalZoom(ctx, landmarks, w, h, sourceCanvas) {
  if (!sourceCanvas) return;

  // 🛡️ MOBILE FIX: Disable smoothing to prevent blur artifacts on mobile decoding
  ctx.imageSmoothingEnabled = false;

  const srcCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
  const dstW = ctx.canvas.width;
  const dstH = ctx.canvas.height;

  // Read pixels directly
  let srcData;
  try {
    srcData = srcCtx.getImageData(0, 0, w, h);
  } catch {
    return;
  }

  // 🔍 Compute mouth bounding box (Surgical Focus)
  const mouthIndices = [61, 291, 78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312];

  let minX = w, minY = h, maxX = 0, maxY = 0;
  mouthIndices.forEach(i => {
    const p = landmarks[i];
    if (!p) return;
    const x = p.x * w, y = p.y * h;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  });

  const padX = (maxX - minX) * 0.32;
  const padY = (maxY - minY) * 0.38;

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

  // 🔁 PIXEL MAPPING (Surgical Backward Sampling)
  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {

      const sx = (x - offsetX) / scale + minX;
      const sy = (y - offsetY) / scale + minY;

      const ix = Math.floor(sx);
      const iy = Math.floor(sy);

      if (ix >= 0 && ix < w && iy >= 0 && iy < h) {
        const si = (iy * w + ix) * 4;
        const di = (y * dstW + x) * 4;

        dst[di]     = src[si];
        dst[di + 1] = src[si + 1];
        dst[di + 2] = src[si + 2];
        dst[di + 3] = 255; 
      } else {
        // Clinical card background (zinc-950)
        const di = (y * dstW + x) * 4;
        dst[di] = 9;   
        dst[di+1] = 9; 
        dst[di+2] = 11;
        dst[di+3] = 255;
      }
    }
  }

  ctx.putImageData(dstData, 0, 0);
}
