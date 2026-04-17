// 🔒 DO NOT MODIFY — 3X CLINICAL ZOOM (LOCKED)

/**
 * Applies a 3x magnified view of the dental region directly onto the provided context.
 * Useful for clinical diagnostic views where the mouth is the primary focus.
 */
export function applyClinicalZoom(ctx, landmarks, w, h) {
  if (!landmarks || landmarks.length === 0) return;

  // 🦷 Use inner mouth landmarks (MediaPipe)
  const mouthIndices = [
    78, 95, 88, 178, 87, 14, 317, 402,
    318, 324, 308, 415, 310, 311, 312
  ];

  let minX = w, minY = h, maxX = 0, maxY = 0;

  // 📍 Get bounding box of mouth
  mouthIndices.forEach(i => {
    const pt = landmarks[i];
    if (!pt) return;

    const x = pt.x * w;
    const y = pt.y * h;

    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  });

  // 🧠 Expand box slightly (include teeth fully)
  const padX = (maxX - minX) * 0.25;
  const padY = (maxY - minY) * 0.35;

  minX = Math.max(0, minX - padX);
  minY = Math.max(0, minY - padY);
  maxX = Math.min(w, maxX + padX);
  maxY = Math.min(h, maxY + padY);

  const boxW = maxX - minX;
  const boxH = maxY - minY;

  if (boxW <= 0 || boxH <= 0) return;

  // 📸 Extract region
  const imageData = ctx.getImageData(minX, minY, boxW, boxH);

  // 🧪 Create temp canvas (safe, isolated)
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = boxW;
  tempCanvas.height = boxH;

  const tctx = tempCanvas.getContext("2d");
  tctx.putImageData(imageData, 0, 0);

  // 🧷 Clear original region
  ctx.clearRect(minX, minY, boxW, boxH);

  // 🔍 3X ZOOM (center anchored)
  const scale = 3.0;

  const cx = minX + boxW / 2;
  const cy = minY + boxH / 2;

  const newW = boxW * scale;
  const newH = boxH * scale;

  // 🎯 Draw zoomed image centered
  ctx.drawImage(
    tempCanvas,
    0, 0, boxW, boxH,
    cx - newW / 2,
    cy - newH / 2,
    newW,
    newH
  );
}
