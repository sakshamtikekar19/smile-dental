// 🦷 CLEAN, STABLE WHITENING ENGINE
// Features simplified clinical math for zero-artifact stability and natural results.

const SMILE_INDICES = [
  61, 291, 78, 95, 88, 178, 87, 14,
  317, 402, 318, 324, 308, 415, 310,
  311, 312
];

/**
 * 🚀 High-Fidelity Clean & Stable Whitening
 * Simplified clinical logic for production reliability.
 * 
 * @param {CanvasRenderingContext2D} ctx - Main simulation context
 * @param {Array} landmarks - MediaPipe face mesh landmarks
 * @param {number} w - Canvas width
 * @param {number} h - Canvas height
 * @param {number} intensity - Initial intensity (unused in current stable block but kept for compatibility)
 */
export function applyUltraRealisticWhitening(ctx, landmarks, w, h, intensity = 0.8) {
  if (!landmarks || landmarks.length === 0) return;

  try {
      // 1. 🎭 STAGING MASK (Blurred path)
      const maskCanvas = document.createElement("canvas");
      maskCanvas.width = w;
      maskCanvas.height = h;
      const mctx = maskCanvas.getContext("2d", { willReadFrequently: true });

      const path = new Path2D();
      SMILE_INDICES.forEach((idx, i) => {
        const p = landmarks[idx];
        if (!p) return;
        const x = p.x * w;
        const y = p.y * h;
        if (i === 0) path.moveTo(x, y);
        else path.lineTo(x, y);
      });
      path.closePath();

      mctx.filter = "blur(6px)";
      mctx.fillStyle = "white";
      mctx.fill(path);

      // 2. 📍 REGION CALCULATION
      let minX = w, minY = h, maxX = 0, maxY = 0;
      SMILE_INDICES.forEach(idx => {
        const p = landmarks[idx];
        if (!p) return;
        const x = p.x * w;
        const y = p.y * h;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      });

      const pad = 25;
      minX = Math.max(0, Math.floor(minX - pad));
      minY = Math.max(0, Math.floor(minY - pad));
      maxX = Math.min(w, Math.ceil(maxX + pad));
      maxY = Math.min(h, Math.ceil(maxY + pad));

      const boxW = maxX - minX;
      const boxH = maxY - minY;
      
      if (boxW <= 0 || boxH <= 0 || minX >= w || minY >= h) return;

      const imgData = ctx.getImageData(minX, minY, boxW, boxH);
      const mask = mctx.getImageData(minX, minY, boxW, boxH).data;
      const d = imgData.data;

      // 3. 🧪 CLEAN / STABLE PIXEL LOOP
      for (let i = 0; i < d.length; i += 4) {
        const alpha = mask[i + 3] / 255;
        if (alpha < 0.08) continue; // Slightly tighter alpha gate for stability

        let r = d[i];
        let g = d[i + 1];
        let b = d[i + 2];

        const lum = (r + g + b) / 3;

        // 🔒 Skip dark gaps (Keep natural depth)
        if (lum < 50) continue;

        // 🔒 Skip lips/gums
        if (r > g * 1.2 && r > b * 1.3) continue;

        // 🟡 Detect yellow
        const yellow = (r + g) / 2 - b;

        let nr = r;
        let ng = g;
        let nb = b;

        // 👉 ONLY FIX YELLOW (Main correction)
        if (yellow > 5) {
          nb += yellow * 0.25;  // Neutralize yellow tone
        }

        // 👉 LIGHT WHITENING (No shine)
        nr *= 1.05;
        ng *= 1.06;
        nb *= 1.05;

        // 👉 Clamp highlights to avoid digital gloss / shine
        nr = Math.min(nr, 235);
        ng = Math.min(ng, 235);
        nb = Math.min(nb, 235);

        // 👉 Smooth blend (Clinical weighting)
        const blend = 0.65 * alpha;

        d[i]     = r * (1 - blend) + nr * blend;
        d[i + 1] = g * (1 - blend) + ng * blend;
        d[i + 2] = b * (1 - blend) + nb * blend;
      }

      ctx.putImageData(imgData, minX, minY);

  } catch (error) {
      console.warn("Whitening engine safely skipped a dropped frame.");
  }
}

// ── Compatibility Aliases ───────────────────────────────────────────────────
export const applyWhitening = applyUltraRealisticWhitening;
export const applyProfessionalWhitening = applyUltraRealisticWhitening;
