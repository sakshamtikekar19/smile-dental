// 🔒 DO NOT MODIFY — 3X CLINICAL ZOOM (LOCKED)

/**
 * 🔍 CLINICAL VIEWPORT ENGINE (Surgical Stability Fix)
 * Magnifies the dental region exactly 3.0x for surgical inspection.
 * Fixes the 'Black Image' bug by enforcing background clearance and source validation.
 */
export function applyClinicalZoom(ctx, landmarks, w, h, sourceCanvas = null) {
  if (!landmarks || landmarks.length === 0) return;

  // 1. Clear Viewport to prevent transparency/black-bleed
  const targetW = ctx.canvas.width;
  const targetH = ctx.canvas.height;
  ctx.fillStyle = "#09090b"; // zinc-950 (Clinical Dark)
  ctx.fillRect(0, 0, targetW, targetH);

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

  // 🧠 Expand box (Surgical framing)
  const padX = (maxX - minX) * 0.32;
  const padY = (maxY - minY) * 0.40;

  minX = Math.max(0, minX - padX);
  minY = Math.max(0, minY - padY);
  maxX = Math.min(w, maxX + padX);
  maxY = Math.min(h, maxY + padY);

  const boxW = maxX - minX;
  const boxH = maxY - minY;
  if (boxW <= 0 || boxH <= 0) return;

  // 🔍 3X ZOOM (Target Centered)
  const scale = 3.0;
  const zoomW = boxW * scale;
  const zoomH = boxH * scale;

  // 🎯 DIRECT DRAW
  if (!sourceCanvas) return; // Fail safe
  
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  
  ctx.drawImage(
    sourceCanvas,
    minX, minY, boxW, boxH,
    targetW / 2 - zoomW / 2,
    targetH / 2 - zoomH / 2,
    zoomW,
    zoomH
  );
}
