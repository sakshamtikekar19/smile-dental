// 🦷 "STRICT PIXEL-TO-PIXEL" WHITENING ENGINE
// Removes canvas masking to eliminate "film" artifacts.
// Uses strict gating to isolate enamel pixels based on luminance and color-dominance.

const UPPER_INNER_LIP = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308];
const LOWER_INNER_LIP = [308, 324, 318, 402, 317, 14, 87, 178, 88, 95, 78];

/**
 * 🚀 High-Fidelity Strict Gating Engine
 * 
 * @param {CanvasRenderingContext2D} ctx - Main simulation context
 * @param {Array} landmarks - MediaPipe face mesh landmarks
 * @param {number} iw - Canvas width
 * @param {number} ih - Canvas height
 * @param {number} intensity - Whitening power (0.0 to 1.0)
 */
export function applyUltraRealisticWhitening(ctx, landmarks, iw, ih, intensity = 0.8) {
  if (!landmarks || landmarks.length === 0) return;

  // 1. Calculate a TIGHT bounding box strictly around the mouth opening
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  const innerMouthPoints = [...UPPER_INNER_LIP, ...LOWER_INNER_LIP];

  innerMouthPoints.forEach(idx => {
      const pt = landmarks[idx];
      const x = pt.x <= 1 ? pt.x * iw : pt.x;
      const y = pt.y <= 1 ? pt.y * ih : pt.y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
  });

  // No padding here. We want it as tight to the teeth as possible.
  minX = Math.max(0, Math.floor(minX));
  minY = Math.max(0, Math.floor(minY));
  maxX = Math.min(iw, Math.ceil(maxX));
  maxY = Math.min(ih, Math.ceil(maxY));
  
  const boxW = maxX - minX;
  const boxH = maxY - minY;
  if (boxW <= 0 || boxH <= 0) return;

  // 2. Extract the raw pixel data
  const imgData = ctx.getImageData(minX, minY, boxW, boxH);
  const data = imgData.data;

  // 3. 🧪 STRICT PIXEL-TO-PIXEL GATING
  for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Calculate true human-eye luminance
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      // 🛑 GATE 1: The Gap/Shadow Protector (High threshold for mobile clarity)
      if (lum < 80) continue; 

      // 🛑 GATE 2: The Flesh Protector (Lips, Gums, Skin)
      // Tighter 1.15 ratio for enhanced skin protection as requested.
      if (r > g * 1.15 && r > b * 1.15) continue;

      // ✅ IF IT PASSED THE GATES, IT IS A TOOTH PIXEL. Apply Whitening.

      // COLOR UNIFICATION: Pull colors toward a clean grayscale base
      const cleanR = r + (lum - r) * (intensity * 0.85);
      const cleanG = g + (lum - g) * (intensity * 0.85);
      const cleanB = b + (lum - b) * (intensity * 0.85);

      // CLINICAL TINT: Add a microscopic cool blue lift (+6)
      const finalB = cleanB + (6 * intensity); 
      
      // LUMINANCE LIFT: Smooth brightening boost
      const liftCurve = (lum / 255); 
      const brightMultiplier = 1.0 + (intensity * 0.25 * liftCurve);

      // Apply and clamp
      data[i]     = Math.min(255, cleanR * brightMultiplier);
      data[i + 1] = Math.min(255, cleanG * brightMultiplier);
      data[i + 2] = Math.min(255, finalB * brightMultiplier);
  }

  // 4. 🚀 DIRECT PIXEL REPLACEMENT
  // Eliminates anti-aliased lip "films" by avoiding canvas masks.
  ctx.putImageData(imgData, minX, minY);
}

// ── Compatibility Aliases ───────────────────────────────────────────────────
export const applyWhitening = applyUltraRealisticWhitening;
export const applyProfessionalWhitening = applyUltraRealisticWhitening;
