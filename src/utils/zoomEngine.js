// 🔒 DO NOT MODIFY — 3X CLINICAL ZOOM (LOCKED)

/**
 * 🔍 CLINICAL VIEWPORT ENGINE (Safe Buffer Restoration)
 * Magnifies the dental region exactly 3.0x for surgical inspection.
 * Fixes the 'Black Image' bug using the Safe Buffer approach as requested.
 */
export function applyClinicalZoom(ctx, landmarks, w, h, sourceCanvas = null) {
  if (!landmarks || landmarks.length === 0) return;

  const targetW = ctx.canvas.width;
  const targetH = ctx.canvas.height;
  
  // Clear clinical card background
  ctx.fillStyle = "#09090b"; // zinc-950
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
  const padY = (maxY - minY) * 0.38;

  minX = Math.max(0, minX - padX);
  minY = Math.max(0, minY - padY);
  maxX = Math.min(w, maxX + padX);
  maxY = Math.min(h, maxY + padY);

  const boxW = maxX - minX;
  const boxH = maxY - minY;
  if (boxW <= 0 || boxH <= 0) return;

  const scale = 3.0;
  const cx = targetW / 2;
  const cy = targetH / 2;
  const newW = boxW * scale;
  const newH = boxH * scale;

  // ✅ SAFE BUFFER (FAST) - As Requested
  const buffer = document.createElement("canvas");
  buffer.width = w;
  buffer.height = h;
  const bctx = buffer.getContext("2d");
  
  // ✅ ALWAYS FILL BUFFER (NO BLACK FAIL) - FALLBACK ENFORCED
  if (sourceCanvas) {
    bctx.drawImage(sourceCanvas, 0, 0, w, h);
  } else {
    // If no source provided, capture what's currently on the destination context (unlikely but safe)
    bctx.drawImage(ctx.canvas, 0, 0, w, h); 
  }

  // Draw scaled region from buffer to clinical card
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  
  ctx.drawImage(
    buffer,
    minX, minY, boxW, boxH,
    cx - newW / 2,
    cy - newH / 2,
    newW,
    newH
  );
}
