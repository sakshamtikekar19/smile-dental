// 🦷 REALISTIC DENTAL WHITENING ENGINE (MULTI-PASS CLIP PIPELINE)
// Optimized for clinical accuracy and stain neutralization

// FaceMesh indices for the inner contour of the lips (the exposed teeth area)
const UPPER_INNER_LIP = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308];
const LOWER_INNER_LIP = [308, 324, 318, 402, 317, 14, 87, 178, 88, 95, 78];

/**
 * 🚀 APPLY REALISTIC WHITENING
 * Uses multi-pass blend modes to neutralize yellow stains and boost enamel luminance.
 * @param {CanvasRenderingContext2D} ctx - The canvas context
 * @param {Array} landmarks - MediaPipe FaceMesh landmarks
 * @param {number} iw - Canvas width (pixels)
 * @param {number} ih - Canvas height (pixels)
 * @param {number} intensity - 0.0 (off) to 1.0 (max clinical white)
 */
export function applyWhitening(ctx, landmarks, iw, ih, intensity = 0.85) {
  if (!landmarks || landmarks.length === 0) return;

  ctx.save(); // Save the canvas state before we apply the mask

  // 1. ✂️ CREATE THE SURGICAL MASK (Clip to teeth only)
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
  // We use .slice().reverse() since the array starts at one corner and ends at another
  // but we need a continuous loop.
  // Actually, LOWER_INNER_LIP indices provided by user: [308, 324, 318, 402, 317, 14, 87, 178, 88, 95, 78]
  // UPPER_INNER_LIP ends at 308. LOWER_INNER_LIP starts at 308 and ends at 78.
  // This forms a perfect loop if we just append them.
  LOWER_INNER_LIP.forEach((idx) => {
     const pt = landmarks[idx];
     const x = pt.x <= 1 ? pt.x * iw : pt.x;
     const y = pt.y <= 1 ? pt.y * ih : pt.y;
     ctx.lineTo(x, y);
  });
  
  ctx.closePath();
  ctx.clip(); // CRITICAL: Everything we draw next ONLY happens inside this mouth shape

  // 2. 🧪 PASS 1: The "Anti-Yellow" Neutralizer
  // In color theory, Purple/Blue cancels out Yellow. 
  // We apply a very faint cool tint using the 'color' blend mode to selectively kill the yellow stains.
  ctx.globalCompositeOperation = "color";
  ctx.fillStyle = `rgba(200, 220, 255, ${intensity * 0.8})`; 
  ctx.fill();

  // 3. 💡 PASS 2: The "Luminance" Booster
  // 'soft-light' gently brightens midtones and highlights, but completely ignores pure blacks.
  // This makes the enamel gleam while leaving the dark gaps between the teeth perfectly intact!
  ctx.globalCompositeOperation = "soft-light";
  ctx.fillStyle = `rgba(255, 255, 255, ${intensity})`;
  ctx.fill();

  // 4. ✨ PASS 3: The "Enamel Polish" (Optional High-End Pop)
  // If intensity is pushed super high, we add a tiny bit of overlay to make it pop like a Hollywood smile.
  if (intensity > 0.7) {
      ctx.globalCompositeOperation = "overlay";
      ctx.fillStyle = `rgba(255, 255, 255, ${(intensity - 0.7) * 0.6})`;
      ctx.fill();
  }

  ctx.restore(); // Remove the mask and return canvas to normal
}

// Keep the old function name for compatibility if needed elsewhere, 
// aliasing the new logic to the old export name "applyWhitening".
export const applyProfessionalWhitening = applyWhitening;
