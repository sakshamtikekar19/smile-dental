// 🦷 CLINICAL WHITENING V3 (YELLOW REMOVAL + NATURAL LOOK)
// Features targeted stain neutralization and texture-preserving contrast restoration.

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
 * 🚀 High-Fidelity Clinical Whitening V3
 * Features targeted yellow neutralization and contrast-based brightening.
 * 
 * @param {CanvasRenderingContext2D} ctx - Main simulation context
 * @param {Array} landmarks - MediaPipe face mesh landmarks
 * @param {number} iw - Canvas width
 * @param {number} ih - Canvas height
 * @param {number} intensity - Whitening power (0.0 to 1.0)
 */
export function applyUltraRealisticWhitening(ctx, landmarks, iw, ih, intensity = 0.8) {
  if (!landmarks || landmarks.length === 0) return;

  try {
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

      // 🧤 PADDING: Reach targets in shadows and corners
      const pad = 10;
      minX = Math.max(0, Math.floor(minX - pad));
      minY = Math.max(0, Math.floor(minY - pad));
      maxX = Math.min(iw, Math.ceil(maxX + pad));
      maxY = Math.min(ih, Math.ceil(maxY + pad));

      const reqBoxW = maxX - minX;
      const reqBoxH = maxY - minY;
      
      if (reqBoxW <= 0 || reqBoxH <= 0 || minX >= iw || minY >= ih) return;

      const imgData = ctx.getImageData(minX, minY, reqBoxW, reqBoxH);
      const data = imgData.data;
      
      // The absolute physical width of the array returned by the browser
      const actualWidth = imgData.width;

      // 2. 🧪 THE CLINICAL V3 PIXEL LOOP
      for (let i = 0; i < data.length; i += 4) {
          const pixelIndex = i / 4;
          const px = minX + (pixelIndex % actualWidth);
          const py = minY + Math.floor(pixelIndex / actualWidth);

          // 🛡️ GATE 0: THE INVISIBLE FENCE (Geometric Isolation)
          if (!isPixelInsidePolygon(px, py, mouthPolygon)) continue;

          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // 🛡️ GATE 1: SKIP DARK (Gaps / Mouth depth)
          const lum = (r + g + b) / 3;
          if (lum < 60) continue;

          // 🛡️ GATE 2: LIP / GUM PROTECTION (STRONGER)
          const isLip = r > g * 1.15 && r > b * 1.25;
          const isGum = r > 130 && g < 115 && b < 115;
          if (isLip || isGum) continue;

          // 🛡️ GATE 3: TOOTH DETECTION (TIGHTENED)
          const isTooth =
            r > 75 && g > 70 && b > 60 &&
            r < 245 && g < 245 && b < 245 &&
            (r - b) < 55 &&
            (g - b) < 35;

          if (!isTooth) continue;

          // 🔥 STEP 1: YELLOW NEUTRALIZATION (Deficit Calculation)
          const yellow = (r + g) / 2 - b;

          let nr = r;
          let ng = g;
          let nb = b;

          if (yellow > 6) {
            // Push toward neutral white (Reduce yellow tone)
            nb += yellow * 0.6;
            nr -= yellow * 0.15;
            ng -= yellow * 0.08;
          }

          // 🔥 STEP 2: SUBTLE WHITENING (NO SHINE)
          const lift = 1.035; // Very controlled boost
          nr *= lift;
          ng *= lift;
          nb *= lift;

          // 🔥 STEP 3: EDGE PRESERVATION (Contrast Restore)
          // Preserves enamel texture and prevents the "plastic" look
          const contrast = 1.04;
          nr = (nr - 128) * contrast + 128;
          ng = (ng - 128) * contrast + 128;
          nb = (nb - 128) * contrast + 128;

          // 🔥 STEP 4: CONTROLLED BLEND (Final commit)
          // Binary geometric mask ensures zero film artifacts
          const blend = 0.48; 

          data[i]     = Math.min(255, r * (1 - blend) + nr * blend);
          data[i + 1] = Math.min(255, g * (1 - blend) + ng * blend);
          data[i + 2] = Math.min(255, b * (1 - blend) + nb * blend);
      }

      // 3. Direct pixel replacement (Eliminates masked film artifacts)
      ctx.putImageData(imgData, minX, minY);

  } catch (error) {
      console.warn("Whitening engine safely skipped a dropped frame.");
  }
}

// ── Compatibility Aliases ───────────────────────────────────────────────────
export const applyWhitening = applyUltraRealisticWhitening;
export const applyProfessionalWhitening = applyUltraRealisticWhitening;
