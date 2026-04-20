// 🦷 "REFINED, NATURAL" WHITENING ENGINE
// Optimized for molar coverage, targeted plaque removal, and textured clinical realism.

const UPPER_INNER_LIP = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308];
const LOWER_INNER_LIP = [308, 324, 318, 402, 317, 14, 87, 178, 88, 95, 78];

/**
 * 🛡️ RAY-CASTING ALGORITHM
 * Mathematically confines the simulation to the anatomical mouth opening.
 */
function isPixelInsidePolygon(px, py, polygon) {
    let isInside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        let xi = polygon[i].x, yi = polygon[i].y;
        let xj = polygon[j].x, yj = polygon[j].y;
        let intersect = ((yi > py) !== (yj > py)) && 
                        (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
        if (intersect) isInside = !isInside;
    }
    return isInside;
}

/**
 * 🚀 High-Fidelity Refined Natural Whitening
 * 
 * @param {CanvasRenderingContext2D} ctx - Main simulation context
 * @param {Array} landmarks - MediaPipe face mesh landmarks
 * @param {number} iw - Canvas width
 * @param {number} ih - Canvas height
 * @param {number} intensity - Whitening power (0.0 to 1.0)
 */
export function applyUltraRealisticWhitening(ctx, landmarks, iw, ih, intensity = 0.8) {
  if (!landmarks || landmarks.length === 0) return;

  // 1. Map the exact inner lip polygon
  const mouthPolygon = [...UPPER_INNER_LIP, ...LOWER_INNER_LIP].map(idx => ({
      x: landmarks[idx].x <= 1 ? landmarks[idx].x * iw : landmarks[idx].x,
      y: landmarks[idx].y <= 1 ? landmarks[idx].y * ih : landmarks[idx].y
  }));

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  mouthPolygon.forEach(pt => {
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
  });

  // 🛡️ Bounding Box Padding: Ensures full capture of mouth corners
  const pad = 8;
  minX = Math.max(0, Math.floor(minX - pad));
  minY = Math.max(0, Math.floor(minY - pad));
  maxX = Math.min(iw, Math.ceil(maxX + pad));
  maxY = Math.min(ih, Math.ceil(maxY + pad));

  const boxW = maxX - minX;
  const boxH = maxY - minY;
  if (boxW <= 0 || boxH <= 0) return;

  const imgData = ctx.getImageData(minX, minY, boxW, boxH);
  const data = imgData.data;

  // 2. 🧪 THE REFINED PIXEL MATH
  for (let i = 0; i < data.length; i += 4) {
      const pixelIndex = i / 4;
      const px = minX + (pixelIndex % boxW);
      const py = minY + Math.floor(pixelIndex / boxW);

      // FENCE (Gate 0): Skip pixels outside the lips
      if (!isPixelInsidePolygon(px, py, mouthPolygon)) continue;

      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      // 🛑 FIX 1: Shadow Reach (Back Teeth)
      // Threshold lowered to 35 to capture molars sitting in shadows.
      if (lum < 35) continue; 

      // Smooth fade for deep shadows to maintain 3D depth
      let shadowFade = 1.0;
      if (lum < 70) {
          shadowFade = (lum - 35) / 35; 
      }

      // Flesh Protector (Backup check for gums/tongue)
      if (r > g * 1.15 && r > b * 1.15) continue;

      // --- PIXEL CONFIRMED AS ENAMEL ---

      // 🛑 FIX 2: Targeted Anti-Plaque Neutralization
      // Target yellow pigments (R/G high, Blue low)
      let targetB = b;
      if (r > b && g > b) {
          const rgAverage = (r + g) / 2;
          // Chemically neutralize yellow by lifting blue toward the R/G average
          targetB = b + (rgAverage - b) * (intensity * 0.95); 
      }

      // Smooth color toward natural ivory (65% intensity for texture preservation)
      let cleanR = r + (lum - r) * (intensity * 0.65);
      let cleanG = g + (lum - g) * (intensity * 0.65);
      let cleanB = targetB + (lum - targetB) * (intensity * 0.65);

      // Organic Warmth Injection (+8R, +4G, +1B)
      cleanR += 8 * intensity;
      cleanG += 4 * intensity;
      cleanB += 1 * intensity;

      // 🛑 FIX 3: Natural Brightness (Reduced fake glow)
      // Multiplier reduced from 0.25 to 0.12 to preserve texture over raw brightness.
      const liftMultiplier = 1.0 + (intensity * 0.12 * shadowFade * (lum / 255));

      data[i]     = Math.min(255, cleanR * liftMultiplier);
      data[i + 1] = Math.min(255, cleanG * liftMultiplier);
      data[i + 2] = Math.min(255, cleanB * liftMultiplier);
  }

  // 3. Direct pixel commitment (No masking film)
  ctx.putImageData(imgData, minX, minY);
}

// ── Compatibility Aliases ───────────────────────────────────────────────────
export const applyWhitening = applyUltraRealisticWhitening;
export const applyProfessionalWhitening = applyUltraRealisticWhitening;
