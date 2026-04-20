// 🦷 ULTIMATE, PRODUCTION-READY WHITENING ENGINE
// Features industrial safety nets, inverse luminance lift, and plaque-targeted bleaching.

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
 * 🚀 Ultimate High-Fidelity Clinical Whitening
 * Industrial safety nets and advanced inverse-lift logic.
 * 
 * @param {CanvasRenderingContext2D} ctx - Main simulation context
 * @param {Array} landmarks - MediaPipe face mesh landmarks
 * @param {number} iw - Canvas width
 * @param {number} ih - Canvas height
 * @param {number} intensity - Whitening power (0.0 to 1.0)
 */
export function applyUltraRealisticWhitening(ctx, landmarks, iw, ih, intensity = 0.8) {
  // 🛡️ SAFETY NET 1: Ensure FaceMesh actually found a face
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

      // 🧤 Bounding Box Padding: Reach targets in shadows and corners
      const pad = 10;
      minX = Math.max(0, Math.floor(minX - pad));
      minY = Math.max(0, Math.floor(minY - pad));
      maxX = Math.min(iw, Math.ceil(maxX + pad));
      maxY = Math.min(ih, Math.ceil(maxY + pad));

      const boxW = maxX - minX;
      const boxH = maxY - minY;
      
      // 🛡️ SAFETY NET 2: Prevent Canvas API crash if mouth box is invalid
      if (boxW <= 0 || boxH <= 0 || minX >= iw || minY >= ih) return;

      const imgData = ctx.getImageData(minX, minY, boxW, boxH);
      const data = imgData.data;

      // 2. 🧪 THE HARD FIX: PLAQUE TARGETING & ANTI-FAKE MATH
      for (let i = 0; i < data.length; i += 4) {
          const pixelIndex = i / 4;
          const px = minX + (pixelIndex % boxW);
          const py = minY + Math.floor(pixelIndex / boxW);

          // 🛡️ FENCE: If pixel is outside the lips, skip it instantly
          if (!isPixelInsidePolygon(px, py, mouthPolygon)) continue;

          let r = data[i];
          let g = data[i + 1];
          let b = data[i + 2];
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;

          // 🛑 Shadow Protection (Absolute baseline for depth)
          if (lum < 25) continue;

          // 🛑 Flesh Protector (Internal protection for gums/tongue)
          // 1.15 G-ratio and 1.25 B-ratio for surgical precision
          if (r > g * 1.15 && r > b * 1.25) continue;

          // 🧬 PLAQUE DETECTOR: Yellow plaque lacks blue relative to green
          const isPlaque = (r > 90 && g > 90 && b < g - 15);

          // Dynamic Process Intensity for Shadows
          let processIntensity = intensity;
          if (lum < 60 && !isPlaque) {
              processIntensity = intensity * ((lum - 25) / 35); 
          }

          // --- PIXEL BLEACHING ---

          // 1. 🧪 PLAQUE KILLER: Force Blue channel up based on green level
          let newB = b;
          if (isPlaque) {
              newB = b + (g - b) * processIntensity * 1.3; 
          }

          // 2. 🎨 ENAMEL NORMALIZATION: Pulled toward grayscale luminance
          let cleanR = r + (lum - r) * processIntensity * 0.8;
          let cleanG = g + (lum - g) * processIntensity * 0.8;
          let cleanB = newB + (lum - newB) * processIntensity * 0.8;

          // 🦷 PREMIUM IVORY FINISH (+10R, +8G, +5B)
          cleanR += 10 * processIntensity;
          cleanG += 8 * processIntensity;
          cleanB += 5 * processIntensity;

          // 3. 💡 INVERSE LUMINANCE LIFT: Prevents over-bright glow
          // Safely lifts midtones while capping highlights using the inverse curve
          const inverseLift = (255 - lum) / 255; 
          const brightnessCap = 1.0 + (processIntensity * 0.25 * inverseLift);

          data[i]     = Math.min(255, cleanR * brightnessCap);
          data[i + 1] = Math.min(255, cleanG * brightnessCap);
          data[i + 2] = Math.min(255, cleanB * brightnessCap);
      }

      // 3. Direct pixel replacement (Eliminates masked film artifacts)
      ctx.putImageData(imgData, minX, minY);

  } catch (error) {
      // 🛡️ SAFETY NET 3: Silent recovery from frame corruption
      console.warn("Whitening engine safely skipped a dropped frame.");
  }
}

// ── Compatibility Aliases ───────────────────────────────────────────────────
export const applyWhitening = applyUltraRealisticWhitening;
export const applyProfessionalWhitening = applyUltraRealisticWhitening;
