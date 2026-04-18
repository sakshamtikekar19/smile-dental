// 🔒 DO NOT MODIFY — 3X CLINICAL ZOOM (LOCKED)

/**
 * 🔍 CLINICAL VIEWPORT ENGINE (Surgical Source Fix)
 * Magnifies the dental region exactly 3.0x for surgical inspection.
 * FIXED: Explicitly requires the REAL simulation source canvas.
 */
export function applyClinicalZoom(zoomCtx, landmarks, w, h, sourceCanvas) {
  if (!landmarks || landmarks.length === 0 || !w || !h) return;

  // 🔥 STEP 1 — FORCE REAL SOURCE
  const source = sourceCanvas;

  if (!source || source.width === 0) {
    console.error("❌ INVALID SOURCE CANVAS");
    return;
  }

  // 🧪 DEBUG (CONFIRM FIX)
  console.log("ZOOM SOURCE TAG:", source.id);
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

  const targetW = zoomCtx.canvas.width;
  const targetH = zoomCtx.canvas.height;
  
  // Clear background
  zoomCtx.fillStyle = "#09090b";
  zoomCtx.fillRect(0, 0, targetW, targetH);

  const scale = 3.0;
  const cx = targetW / 2;
  const cy = targetH / 2;
  const newW = boxW * scale;
  const newH = boxH * scale;

  // 🚀 FASTER + NO FAILURE POINT (Direct Draw)
  zoomCtx.imageSmoothingEnabled = false;

  zoomCtx.drawImage(
    source,
    minX, minY, boxW, boxH,       // Source region (must be from the REAL source)
    cx - newW / 2, cy - newH / 2, // Centered in clinical card
    newW, newH                    // Magnified target size
  );
}
