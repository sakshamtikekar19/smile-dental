// 🦷 DENTAL AESTHETIC MASTERING ENGINE
// Features morphological clinical logic: translucency, micro-contrast, and lighting normalization.

const SMILE_INDICES = [
  61, 291, 78, 95, 88, 178, 87, 14,
  317, 402, 318, 324, 308, 415, 310,
  311, 312
];

/**
 * 🚀 High-Fidelity Aesthetic Mastering
 * Professional morphological logic with horizontal lighting balance.
 * 
 * @param {CanvasRenderingContext2D} ctx - Main simulation context
 * @param {Array} landmarks - MediaPipe face mesh landmarks
 * @param {number} w - Canvas width
 * @param {number} h - Canvas height
 * @param {number} intensity - Initial intensity (unused in current mastering block but kept for compatibility)
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

      // 🛡️ ACTUAL WIDTH FIX: Prevents diagonal array skewing on high-DPI
      const actualWidth = imgData.width;

      // 3. 🧪 AESTHETIC MASTERING LOOP
      for (let i = 0; i < d.length; i += 4) {
        const alpha = mask[i + 3] / 255;
        if (alpha < 0.05) continue;

        let r = d[i];
        let g = d[i + 1];
        let b = d[i + 2];

        const lum = (r + g + b) / 3;

        // 🔒 SKIP DARK GAPS (Keep natural depth)
        if (lum < 45) continue;

        // 🔒 SKIP LIPS / GUMS
        if (r > g * 1.2 && r > b * 1.3) continue;

        // --- 🎯 CORE TRANSFORMATION ---
        const yellow = (r + g) / 2 - b;

        let nr = r;
        let ng = g;
        let nb = b;

        // 🧪 BLEACHING: Targeted yellow neutralization
        if (yellow > 6) {
          nb += yellow * 0.35;
          nr *= 0.96;
          ng *= 0.98;
        }

        // ⚖️ NORMALIZE BASE (Base unification)
        const avg = (nr + ng + nb) / 3;
        nr = nr * 0.92 + avg * 0.08;
        ng = ng * 0.92 + avg * 0.08;
        nb = nb * 0.92 + avg * 0.08;

        // ✨ INITIAL LIFT
        const baseLift = 1.08;
        nr *= baseLift;
        ng *= baseLift;
        nb *= baseLift;

        // --- 🧬 DENTAL AESTHETICS (The "Mastering" Suite) ---

        // 1. 🧬 ENAMEL MICRO-CONTRAST: Adds natural enamel depth
        const contrast = 1.06;
        const mid = 128;
        nr = (nr - mid) * contrast + mid;
        ng = (ng - mid) * contrast + mid;
        nb = (nb - mid) * contrast + mid;

        // 2. ✨ EDGE TRANSLUCENCY: Adds cool tone to incisal edges
        if (lum > 180 && alpha > 0.3) {
          nb *= 1.04;
          nr *= 0.98;
        }

        // 3. 🟡 INTERDENTAL DEPTH: Prevents "white slab" look by preserving tiny shadows
        if (lum < 80 && lum > 45) {
          nr *= 0.97;
          ng *= 0.97;
          nb *= 0.97;
        }

        // 4. ⚖️ CENTER BALANCE FIX: Horizontal lighting normalization
        // Ensures uniform whitening even if the user has uneven side-lighting
        const xRatio = ((i / 4) % actualWidth) / actualWidth;
        const sideBoost = 1 + (0.08 * (0.5 - xRatio));
        nr *= sideBoost;
        ng *= sideBoost;
        nb *= sideBoost;

        // 5. 🌟 ANTI-SHINE CONTROL: Hard-caps highlights for matte finish
        nr = Math.min(nr, 235);
        ng = Math.min(ng, 235);
        nb = Math.min(nb, 235);

        // --- 🧠 FINAL CLINICAL BLEND ---
        const blend = 0.72 * alpha;

        d[i]     = Math.min(255, r * (1 - blend) + nr * blend);
        d[i + 1] = Math.min(255, g * (1 - blend) + ng * blend);
        d[i + 2] = Math.min(255, b * (1 - blend) + nb * blend);
      }

      ctx.putImageData(imgData, minX, minY);

  } catch (error) {
      console.warn("Whitening engine safely skipped a dropped frame.");
  }
}

// ── Compatibility Aliases ───────────────────────────────────────────────────
export const applyWhitening = applyUltraRealisticWhitening;
export const applyProfessionalWhitening = applyUltraRealisticWhitening;
