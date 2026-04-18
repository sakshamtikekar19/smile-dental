// 🔒 DO NOT MODIFY — 3X CLINICAL ZOOM (LOCKED)

/**
 * 🔍 CLINICAL VIEWPORT ENGINE (Hardened Safe-Buffer)
 * Magnifies the dental region exactly 3.0x for surgical inspection.
 * FIXED: Implements the 7-Point Surgical Fix to eliminate 'Black Screen' artifacts.
 */
export function applyClinicalZoom(ctx, landmarks, w, h, sourceCanvas = null) {
  if (!landmarks || landmarks.length === 0 || !w || !h) return;

  // 1. SOURCE OF TRUTH FIX (CRITICAL)
  // Always draw from the FINAL rendered canvas (post-whitening/alignment)
  const source = sourceCanvas && sourceCanvas.width ? sourceCanvas : ctx.canvas;

  // 3. FORCE VALID FRAME CHECK
  if (!source || source.width === 0 || source.height === 0) {
    console.warn("Zoom skipped: invalid source");
    return;
  }

  console.log("ZOOM SOURCE:", source.width, source.height);

  const targetW = ctx.canvas.width;
  const targetH = ctx.canvas.height;
  
  // Clear clinical card background (zinc-950)
  ctx.fillStyle = "#09090b";
  ctx.fillRect(0, 0, targetW, targetH);

  // 🦷 Dental Focus Landmarks
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

  // 🧠 Expand box (Surgical Framing)
  const padX = (maxX - minX) * 0.32;
  const padY = (maxY - minY) * 0.38;

  minX = Math.max(0, minX - padX);
  minY = Math.max(0, minY - padY);
  maxX = Math.min(w, maxX + padX);
  maxY = Math.min(h, maxY + padY);

  const boxW = maxX - minX;
  const boxH = maxY - minY;

  // 4. SAFE REGION GUARD
  if (boxW < 20 || boxH < 20) {
    console.warn("Zoom skipped: invalid region");
    return;
  }

  const scale = 3.0;
  const cx = targetW / 2;
  const cy = targetH / 2;
  const newW = boxW * scale;
  const newH = boxH * scale;

  // 5. REMOVE EMPTY BUFFER ISSUE
  // Ensure buffer always has pixels using the surgical Safe Buffer
  const buffer = document.createElement("canvas");
  buffer.width = w;
  buffer.height = h;

  const bctx = buffer.getContext("2d", { willReadFrequently: true });
  
  // ALWAYS draw something from the confirmed valid source
  bctx.drawImage(source, 0, 0, w, h);

  // 7. SHARPNESS FIX (Surgical Clarity)
  ctx.imageSmoothingEnabled = false;

  // 6. RENDER FIX (IMPORTANT)
  // Ensure this line executes AFTER the buffer has been fully populated
  ctx.drawImage(
    buffer,
    minX, minY, boxW, boxH,
    cx - newW / 2,
    cy - newH / 2,
    newW,
    newH
  );
}
