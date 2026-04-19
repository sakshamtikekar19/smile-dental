// 🔒 PERMANENT MAX STABILITY ZOOM ENGINE (HARDENED)

/**
 * 🔍 HARDENED CLINICAL ZOOM ENGINE
 * Uses GPU-accelerated drawImage with surgical source validation.
 * Ensures vertical/horizontal stability regardless of browser environment.
 */
export function applyClinicalZoom(ctx, landmarks, w, h, sourceCanvas) {
  if (!landmarks || !sourceCanvas) return;

  // 🛡️ HARD SOURCE VALIDATION
  if (sourceCanvas.width === 0 || sourceCanvas.height === 0) return;

  const targetW = ctx.canvas.width;
  const targetH = ctx.canvas.height;

  // 🧼 CLEAR Viewport (Pure Black)
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, targetW, targetH);

  // Focus indices (Lips and Mouth boundaries)
  const mouthIndices = [61, 291, 78, 95, 88, 178, 87, 14, 317, 402, 318, 324];

  let minX = w, minY = h, maxX = 0, maxY = 0;

  for (let i of mouthIndices) {
    const pt = landmarks[i];
    if (!pt) continue;

    const x = pt.x * w;
    const y = pt.y * h;

    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  // 🧠 SURGICAL PADDING (25% X, 30% Y)
  const padX = (maxX - minX) * 0.25;
  const padY = (maxY - minY) * 0.30;

  minX = Math.max(0, minX - padX);
  minY = Math.max(0, minY - padY);
  maxX = Math.min(w, maxX + padX);
  maxY = Math.min(h, maxY + padY);

  const boxW = maxX - minX;
  const boxH = maxY - minY;

  // 🚫 INVALID REGION GUARD
  if (boxW < 20 || boxH < 20) return;

  const scale = 3.0;
  const newW = boxW * scale;
  const newH = boxH * scale;

  const dx = (targetW - newW) / 2;
  const dy = (targetH - newH) / 2;

  // 🎯 CRISP RENDER (NO MOBILE BLUR)
  ctx.imageSmoothingEnabled = false;

  ctx.drawImage(
    sourceCanvas,
    minX, minY, boxW, boxH,
    dx, dy, newW, newH
  );
}
