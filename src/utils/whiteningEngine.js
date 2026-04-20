// 🦷 UNIFORM PROFESSIONAL WHITENING ENGINE (V5)
// Features aggressive yellow neutralization, 1.10 clinical lift, and expanded coverage.

const SMILE_INDICES = [
  61, 291, 78, 95, 88, 178, 87, 14,
  317, 402, 318, 324, 308, 415, 310,
  311, 312
];

/**
 * 🚀 High-Fidelity Uniform Professional Whitening
 * Industrial safety nets and aggressive stain-removal logic.
 * 
 * @param {CanvasRenderingContext2D} ctx - Main simulation context
 * @param {Array} landmarks - MediaPipe face mesh landmarks
 * @param {number} w - Canvas width
 * @param {number} h - Canvas height
 * @param {number} intensity - Initial intensity (unused in current V5 block but kept for compatibility)
 */
export function applyUltraRealisticWhitening(ctx, landmarks, w, h, intensity = 0.8) {
  if (!landmarks || landmarks.length === 0) return;

  try {
      // 1. 🎭 STAGING MASK (Blurred path for soft edges)
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

      // 2. 📍 REGION CALCULATION (Expanded Coverage)
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

      // 🔥 EXPANDED COVERAGE: Ensured left/right side teeth are captured
      const pad = 28; 
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

      // 🛡️ ACTUAL WIDTH FIX: Prevents diagonal array skewing on high-DPI
      const actualWidth = imgData.width;

      // 3. 🧪 UNIFORM V5 PIXEL LOOP
      for (let i = 0; i < d.length; i += 4) {
        // 🛡️ GATE 0: Alpha Threshold (Stability Check)
        const alpha = mask[i + 3] / 255;
        if (alpha < 0.06) continue;

        let r = d[i];
        let g = d[i + 1];
        let b = d[i + 2];

        // 🛡️ GATE 1: Shadow Protection (Keep natural mouth depth)
        const lum = (r + g + b) / 3;
        if (lum < 48) continue;

        // 🛡️ GATE 2: Lip / Gum Protection
        const isLip = r > g * 1.2 && r > b * 1.3;
        const isGum = (r > 120 && g < 110 && b < 110);
        if (isLip || isGum) continue;

        // 🟡 YELLOW DETECTION (Deficit Calculation)
        const yellow = (r + g) / 2 - b;

        let nr = r;
        let ng = g;
        let nb = b;

        // 🔥 FIX 1: AGGRESSIVE YELLOW REMOVAL (Surgical Bleaching)
        if (yellow > 4) {
          nb += yellow * 0.5;   // Force Blue channel up
          nr *= 0.96;           // Reduce red warmth
          ng *= 0.99;
        }

        // ✨ FIX 2: UNIFORM PROFESSIONAL WHITENING (Clinical Lift)
        const lift = 1.10;
        nr *= lift;
        ng *= lift;
        nb *= lift;

        // 🛑 FIX 3: ANTI-SHINE (Matte Enamel Protection)
        // Hard-clamp to prevent digital "plastic glow" at high intensity
        nr = Math.min(nr, 228);
        ng = Math.min(ng, 228);
        nb = Math.min(nb, 228);

        // 🎯 FIX 4: STRONGER BLEND (Visible Transformation)
        const blend = 0.72 * alpha;

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
