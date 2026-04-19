export function applyClinicalZoom(ctx, landmarks, iw, ih, sourceImage) {
  if (!sourceImage) return;

  const targetW = ctx.canvas.width;
  const targetH = ctx.canvas.height;

  // 1. Fill base dark UI
  ctx.fillStyle = "#09090b";
  ctx.fillRect(0, 0, targetW, targetH);

  // 2. BYPASS THE CROP: Draw the raw, unzoomed snapshot directly to the screen
  ctx.drawImage(sourceImage, 0, 0, targetW, targetH);
  
  console.log("🚨 DEBUG 4 - Frame Painted to UI Context");
}
