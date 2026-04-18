// 🔒 DO NOT MODIFY — 3X CLINICAL ZOOM (LOCKED)

/**
 * 🔍 CLINICAL VIEWPORT ENGINE (Forced Source Logic)
 * Magnifies the dental region exactly 3.0x for surgical inspection.
 * FIXED: Implements the 'Yes—force it' source-of-truth logic.
 */
export function applyClinicalZoom(ctx, landmarks, w, h, sourceCanvas = null) {
  if (!landmarks || landmarks.length === 0 || !w || !h) return;

  // 🔥 STEP 1 — FORCE CORRECT SOURCE
  // As requested: Replace legacy source logic completely.
  const source = ctx.canvas;

  if (!source || source.width === 0) {
    console.warn("Zoom failed: invalid source");
    return;
  }

  // 🔍 Diagnostic Logging
  console.log("ZOOM SOURCE:", source.width, source.height);

  // Dental focus indices
  const mouthIndices = [61, 291, 78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312];
  let minX = w, minY = h, maxX = 0, maxY = 0;
  mouthIndices.forEach(i => {
    const pt = landmarks[i];
    if (!pt) return;
    const x = pt.x * w, y = pt.y * h;
    if (x < minX) minX = x; if (y < minY) minY = y;
    if (x > maxX) maxX = x; if (y > maxY) maxY = y;
  });

  const padX = (maxX - minX) * 0.32;
  const padY = (maxY - minY) * 0.38;
  minX = Math.max(0, minX - padX);
  minY = Math.max(0, minY - padY);
  maxX = Math.min(w, maxX + padX);
  maxY = Math.min(h, maxY + padY);

  const boxW = maxX - minX;
  const boxH = maxY - minY;
  console.log("ZOOM BOX:", boxW, boxH);
  console.log("ZOOM DRAW:", minX, minY, maxX, maxY);

  if (boxW < 20 || boxH < 20) {
    console.warn("Zoom skipped: invalid region");
    return;
  }

  const targetW = ctx.canvas.width;
  const targetH = ctx.canvas.height;
  const scale = 3.0;
  const cx = targetW / 2;
  const cy = targetH / 2;
  const newW = boxW * scale;
  const newH = boxH * scale;

  // 🚀 STEP 3 — FORCE BUFFER POPULATION
  const buffer = document.createElement("canvas");
  buffer.width = w;
  buffer.height = h;

  const bctx = buffer.getContext("2d", { willReadFrequently: true });
  
  // ALWAYS draw something from the forced source
  bctx.drawImage(source, 0, 0, w, h);

  // Surgical Clarity
  ctx.imageSmoothingEnabled = false;

  // RENDER: Draw scaled region from buffer back to ctx
  ctx.drawImage(
    buffer,
    minX, minY, boxW, boxH,
    cx - newW / 2, cy - newH / 2,
    newW, newH
  );
}
