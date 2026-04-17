// 🦷 LOCKED WHITENING ENGINE (FEATHERED SURGICAL SAFETY)

/**
 * PRODUCTION-SAFE WHITENING PIPELINE
 * Implements a 'Feathered Surgical Mask' to eliminate patches and sharp edges.
 * Uses a blurred landmark path to smoothly blend whitening into natural enamel (Step 1).
 */
export function applyWhitening(ctx, landmarks, w, h) {
  if (!landmarks || landmarks.length === 0) return;

  // 🛡️ 1. Create the 'Natural Edge' Alpha Mask
  const pipeIndices = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95];
  
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = w; maskCanvas.height = h;
  const mctx = maskCanvas.getContext("2d");
  
  const maskPath = new Path2D();
  pipeIndices.forEach((idx, i) => {
    const p = landmarks[idx];
    if (p) {
      if (i === 0) maskPath.moveTo(p.x * w, p.y * h);
      else maskPath.lineTo(p.x * w, p.y * h);
    }
  });
  maskPath.closePath();

  // Draw blurred mask for soft blending (Step 3: Fix Mask Bleed)
  mctx.filter = "blur(4px)"; 
  mctx.fillStyle = "white";
  mctx.fill(maskPath);

  // 📍 2. Regional Optimization
  let minX = w, minY = h, maxX = 0, maxY = 0;
  pipeIndices.forEach(i => {
    const pt = landmarks[i];
    if (pt) {
      const px = pt.x * w, py = pt.y * h;
      if (px < minX) minX = px; if (py < minY) minY = py;
      if (px > maxX) maxX = px; if (py > maxY) maxY = py;
    }
  });

  const pad = 20;
  minX = Math.max(0, Math.floor(minX - pad));
  minY = Math.max(0, Math.floor(minY - pad));
  maxX = Math.min(w, Math.ceil(maxX + pad));
  maxY = Math.min(h, Math.ceil(maxY + pad));

  const boxW = maxX - minX;
  const boxH = maxY - minY;
  if (boxW <= 0 || boxH <= 0) return;

  const originalImageData = ctx.getImageData(minX, minY, boxW, boxH);
  const whiteningData = ctx.getImageData(minX, minY, boxW, boxH);
  const maskBuffer = mctx.getImageData(minX, minY, boxW, boxH).data;
  
  const orig = originalImageData.data;
  const whit = whiteningData.data;

  // 🔍 3. Surgical Whitening with Alpha Blending
  for (let i = 0; i < whit.length; i += 4) {
    const maskAlpha = maskBuffer[i + 3] / 255; // Use the blurred mask's alpha channel
    if (maskAlpha === 0) continue;

    let r = whit[i], g = whit[i+1], b = whit[i+2];

    // 🛡️ STEP 4: INTERDENTAL PROTECTION (Preserve natural depth)
    const lum = (r + g + b) / 3;
    if (lum < 70) continue;

    // 🛡️ STEP 1: REPLACE LIP + GUM PROTECTION
    const isLip = r > g * 1.18 && r > b * 1.25;
    const isGum = (r > 120 && g < 110 && b < 110); // pink/orange gums
    if (isLip || isGum) continue;

    // 🛡️ STEP 2: HARDEN TOOTH DETECTION
    const isTooth =
      r > 85 && g > 80 && b > 70 &&     // stricter brightness
      r < 235 && g < 235 && b < 235 &&  // avoid highlights
      (r - b) < 35 &&                   // tighter yellow targeting
      (g - b) < 25 &&                   // avoid greenish skin tones
      b > 60;                           // avoid dark gaps

    if (!isTooth) continue;

    let nr = r, ng = g, nb = b;
    const warm = (r + g) / 2 - b;

    // 🧪 CLEANER
    if (warm > 8) {
      nr *= 0.92; ng *= 0.96;
      const avg = (nr + ng + nb) / 3;
      nr = nr * 0.94 + avg * 0.06;
      ng = ng * 0.94 + avg * 0.06;
      nb = nb * 0.94 + avg * 0.06;
    }

    // ✨ STEP 5: BALANCED LIFT (REMOVE BLUE TINT)
    const wr = nr * 1.03;
    const wg = ng * 1.05;
    const wb = nb * 1.04; 

    const blend = 0.55 * maskAlpha; // Alpha-aware blending (The 'Natural Fix')
    
    whit[i]     = Math.max(0, Math.min(255, r * (1 - blend) + wr * blend));
    whit[i + 1] = Math.max(0, Math.min(255, g * (1 - blend) + wg * blend));
    whit[i + 2] = Math.max(0, Math.min(255, b * (1 - blend) + wb * blend));
  }

  ctx.putImageData(whiteningData, minX, minY);
}
