// 🔒 DO NOT MODIFY — 3X CLINICAL ZOOM (LOCKED)

/**
 * 🔍 CLINICAL VIEWPORT ENGINE (Robust Direct-Draw)
 * Magnifies the dental region exactly 3.0x for surgical inspection.
 * Fixes the 'Black Image' bug by using Direct-Draw from sourceCanvas to bypass buffer allocation issues.
 */
export function applyClinicalZoom(ctx, landmarks, w, h, sourceCanvas = null) {
  if (!landmarks || landmarks.length === 0 || !w || !h) return;

  const targetW = ctx.canvas.width;
  const targetH = ctx.canvas.height;
  
  // 1. Clear clinical card background (zinc-950)
  ctx.fillStyle = "#09090b";
  ctx.fillRect(0, 0, targetW, targetH);

  // 🦷 Dental Focus Landmarks (Lips and Corners)
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
  if (boxW <= 0 || boxH <= 0) return;

  const scale = 3.0;
  const cx = targetW / 2;
  const cy = targetH / 2;
  const newW = boxW * scale;
  const newH = boxH * scale;

  // 🚀 DIRECT-DRAW RESOLUTION (Fixes Black Screen)
  // We draw directly from the simulation canvas (sourceCanvas) into the clinical card viewport.
  const source = sourceCanvas || ctx.canvas; // Fallback to itself if missing
  
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  try {
    ctx.drawImage(
      source,
      minX, minY, boxW, boxH,       // Source region from simulation
      cx - newW / 2, cy - newH / 2, // Centered in clinical card
      newW, newH                    // Magnified target size
    );
  } catch (e) {
    console.warn("Clinical Zoom Draw Error:", e);
  }
}
