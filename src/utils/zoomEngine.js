// 🔒 DIAGNOSTIC ZOOM ENGINE (HARD FIX)

export function applyClinicalZoom(ctx, landmarks, w, h, sourceCanvas) {
  if (!landmarks || !sourceCanvas) return;

  const targetW = ctx.canvas.width;
  const targetH = ctx.canvas.height;

  // 🧼 CLEAR (Zinc-950/Black Base)
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, targetW, targetH);

  // 🧪 TEST: Draw full image first
  // If you still see black after this -> the source canvas is broken (GPU lockout)
  ctx.drawImage(sourceCanvas, 0, 0, targetW, targetH);
}
