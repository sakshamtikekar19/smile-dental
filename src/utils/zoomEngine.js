// 🔒 DO NOT MODIFY — 3X CLINICAL ZOOM (LOCKED)

/**
 * 🔍 CLINICAL VIEWPORT ENGINE (HARD TEST PATCH)
 * Temporarily replaces clinical magnification with a full-frame draw to isolate the black-screen bug.
 */
export function applyClinicalZoom(ctx, landmarks, w, h, sourceCanvas) {
  if (!sourceCanvas) {
    console.error("❌ NO SOURCE PROVIDED TO ZOOM ENGINE");
    return;
  }

  // 🔍 Surgical Diagnostics
  console.log("CTX:", ctx);
  console.log("CANVAS SIZE:", ctx.canvas.width, ctx.canvas.height);
  console.log("SOURCE:", sourceCanvas);

  // 🛑 HARD RESET CANVAS (IMPORTANT)
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // 🧪 TEST: FULL DRAW FIRST (DEBUG MODE)
  // We draw the full source directly into the target card to confirm connectivity.
  try {
    ctx.drawImage(sourceCanvas, 0, 0, ctx.canvas.width, ctx.canvas.height);
    console.log("✅ ZOOM TEST DRAW EXECUTED");
  } catch (e) {
    console.error("❌ ZOOM DRAW ERROR:", e);
  }
}
