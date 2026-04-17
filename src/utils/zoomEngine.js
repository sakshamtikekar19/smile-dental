// 🔒 DO NOT MODIFY — 3X CLINICAL ZOOM (LOCKED)

/**
 * 🔍 CLINICAL VIEWPORT ENGINE (Step 3: Direct Draw / Speed Fix)
 * Magnifies the dental region exactly 3.0x for surgical inspection.
 * Uses Direct Draw to eliminate the overhead of temporary buffer canvases.
 */
export function applyClinicalZoom(ctx, landmarks, w, h, sourceCanvas = null) {
  if (!landmarks || landmarks.length === 0) return;

  // 🦷 Whole Smile Landmark Set (Includes mouth corners 61 & 291)
  const mouthIndices = [61, 291, 78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312];
  
  let minX = w, minY = h, maxX = 0, maxY = 0;
  mouthIndices.forEach(i => {
    const pt = landmarks[i];
    if (!pt) return;
    const x = pt.x * w, y = pt.y * h;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  });

  // 🧠 Expand box (Step 4 refined: include teeth fully)
  const padX = (maxX - minX) * 0.28;
  const padY = (maxY - minY) * 0.35;

  minX = Math.max(0, minX - padX);
  minY = Math.max(0, minY - padY);
  maxX = Math.min(w, maxX + padX);
  maxY = Math.min(h, maxY + padY);

  const boxW = maxX - minX;
  const boxH = maxY - minY;
  if (boxW <= 0 || boxH <= 0) return;

  // 🔍 3X ZOOM (Target Centered)
  const scale = 3.0;
  const targetW = ctx.canvas.width;
  const targetH = ctx.canvas.height;
  const zoomW = boxW * scale;
  const zoomH = boxH * scale;

  // 🎯 STEP 3: DIRECT DRAW (Using the provided source or the ctx itself)
  // No temporary canvas creation (Massive performance boost)
  ctx.drawImage(
    sourceCanvas || ctx.canvas,
    minX, minY, boxW, boxH,
    targetW / 2 - zoomW / 2,
    targetH / 2 - zoomH / 2,
    zoomW,
    zoomH
  );
}
