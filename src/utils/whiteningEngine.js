// 🦷 ULTRA-REALISTIC WHITENING ENGINE (MULTI-PASS BLENDING)

// FaceMesh indices for the EXACT inner contour of the lips (the cookie-cutter shape)
const UPPER_INNER_LIP = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308];
const LOWER_INNER_LIP = [308, 324, 318, 402, 317, 14, 87, 178, 88, 95, 78];

/**
 * 🚀 High-Fidelity Clinical Whitening
 * Uses multi-pass composite operations within a surgical lip mask.
 * 
 * @param {CanvasRenderingContext2D} ctx - Main simulation context
 * @param {Array} landmarks - MediaPipe face mesh landmarks
 * @param {number} iw - Canvas width
 * @param {number} ih - Canvas height
 * @param {number} intensity - Whitening power (0.0 to 1.0)
 */
export function applyUltraRealisticWhitening(ctx, landmarks, iw, ih, intensity = 0.75) {
  if (!landmarks || landmarks.length === 0) return;

  // 1. ✂️ CREATE THE PIXEL-PERFECT MASK (Cookie-Cutter Shape)
  // This physically prevents any whitening from touching lips or skin
  ctx.save();
  ctx.beginPath();
  
  // Trace upper inner lip
  UPPER_INNER_LIP.forEach((idx, i) => {
    const pt = landmarks[idx];
    const x = pt.x <= 1 ? pt.x * iw : pt.x;
    const y = pt.y <= 1 ? pt.y * ih : pt.y;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  
  // Trace lower inner lip backwards to close the loop
  LOWER_INNER_LIP.forEach((idx) => {
     const pt = landmarks[idx];
     const x = pt.x <= 1 ? pt.x * iw : pt.x;
     const y = pt.y <= 1 ? pt.y * ih : pt.y;
     ctx.lineTo(x, y);
  });
  
  ctx.closePath();
  ctx.clip(); // 🔥 CRITICAL: Any subsequent drawing ONLY happens within this mouth shape

  // 2. 🧪 PASS 1: Selectively Neutralize Yellow (Kills Stain without losing texture)
  // We use the 'color' blend mode with a cool tint to selectively reduce yellow hue saturation.
  ctx.globalCompositeOperation = "color";
  // rgb(200, 220, 255) is a faint cool blue-violet to cancel yellow stains.
  ctx.fillStyle = `rgba(200, 220, 255, ${intensity * 0.72})`;
  ctx.fill();

  // 3. 💡 PASS 2: The non-linear "Texture-Safe" Brightness Boost
  // 'soft-light' gently brightens midtones and highlights while preserving depth.
  ctx.globalCompositeOperation = "soft-light";
  ctx.fillStyle = `rgba(255, 255, 255, ${intensity})`; 
  ctx.fill();

  // 4. ✨ PASS 3: The "Polished Gleam" (High-End Pop for intensity > 0.7)
  if (intensity > 0.7) {
      ctx.globalCompositeOperation = "overlay";
      // Gently brightens the bright areas even further for a polished, wet look
      ctx.fillStyle = `rgba(255, 255, 255, ${(intensity - 0.7) * 0.35})`;
      ctx.fill();
  }

  // Restore the canvas state (Removes the surgical mask)
  ctx.restore(); 
}

// ── Compatibility Aliases ───────────────────────────────────────────────────
export const applyWhitening = applyUltraRealisticWhitening;
export const applyProfessionalWhitening = applyUltraRealisticWhitening;
