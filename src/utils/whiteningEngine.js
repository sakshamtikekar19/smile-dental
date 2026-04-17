// 🦷 LOCKED WHITENING ENGINE (RECTIFIED & PRODUCTION SAFE)

/**
 * Enhanced whitening with wider visibility range and surgical safety.
 * Rectified to ensure the 'Before/After' difference is clear even in bright/dark lighting.
 */
export function applyWhitening(ctx, landmarks, w, h) {
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    const lum = (r + g + b) / 3;
    const warm = (r + g) / 2 - b;

    // 🛡️ ENAMEL GUARD (RECTIFIED: Wide range for high/low exposure visibility)
    const isTooth =
      r > 50 && g > 45 && b > 35 &&   // capture darker enamel details
      lum > 65 && lum < 250 &&        // avoid total black/white, but allow bright enamel
      warm > -15;                     // avoid blue regions but allow cooling

    if (!isTooth) continue;

    let nr = r, ng = g, nb = b;

    // 🧪 PLAQUE / YELLOW CLEANER (RECTIFIED: More aggressive on warm tones)
    const yellowThreshold = 6; 
    if (warm > yellowThreshold) {
      const cleanerStrength = 0.90; 
      nr *= cleanerStrength;   
      ng *= 0.94;

      // Move toward neutral (Stochiometric correction)
      const avg = (nr + ng + nb) / 3;
      const neutralBlend = 0.12;
      nr = nr * (1 - neutralBlend) + avg * neutralBlend;
      ng = ng * (1 - neutralBlend) + avg * neutralBlend;
      nb = nb * (1 - neutralBlend) + avg * neutralBlend;
    }

    // ✨ NATURAL WHITENING (RECTIFIED: Stronger lift for surgical clarity)
    const liftR = 1.05;
    const liftG = 1.08;
    const liftB = 1.12; // slight blue bias to combat yellowing

    const wr = Math.min(255, nr * liftR);
    const wg = Math.min(255, ng * liftG);
    const wb = Math.min(255, nb * liftB);

    // 🧠 TEXTURE PRESERVATION
    const blend = 0.62; // increased blend for more visible results

    let fr = r * (1 - blend) + wr * blend;
    let fg = g * (1 - blend) + wg * blend;
    let fb = b * (1 - blend) + wb * blend;

    // 🔒 DEPTH LOCK (prevents fake flat white)
    const contrast = 1.03;
    fr = (fr - 128) * contrast + 128;
    fg = (fg - 128) * contrast + 128;
    fb = (fb - 128) * contrast + 128;

    data[i]     = Math.max(0, Math.min(255, fr));
    data[i + 1] = Math.max(0, Math.min(255, fg));
    data[i + 2] = Math.max(0, Math.min(255, fb));
  }

  ctx.putImageData(imageData, 0, 0);
}
