// 🦷 "COLOR-CORRECTION MASTERING" WHITENING ENGINE
// Features deficit-based bleaching, sin-wave luminance lifts, and anatomical geometric isolation.

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
 * 🚀 High-Fidelity Color-Correction Mastering
 * Features sine-wave lifts and deficit-based bleaching logic.
 * 
 * @param {CanvasRenderingContext2D} ctx - Main simulation context
 * @param {Array} landmarks - MediaPipe face mesh landmarks
 * @param {number} iw - Canvas width
 * @param {number} ih - Canvas height
 * @param {number} intensity - Whitening power (0.0 to 1.0)
 */
export function applyUltraRealisticWhitening(ctx, landmarks, iw, ih, intensity = 0.8) {
  // 🛡️ SAFETY NET: Ensure FaceMesh found a face
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

      // 🧤 PADDING: Safely reach extreme left and right teeth
      const pad = 10;
      minX = Math.max(0, Math.floor(minX - pad));
      minY = Math.max(0, Math.floor(minY - pad));
      maxX = Math.min(iw, Math.ceil(maxX + pad));
      maxY = Math.min(ih, Math.ceil(maxY + pad));

      const reqBoxW = maxX - minX;
      const reqBoxH = maxY - minY;
      
      // Prevent Canvas crash if mouth box is invalid
      if (reqBoxW <= 0 || reqBoxH <= 0 || minX >= iw || minY >= ih) return;

      // Extract raw image data
      const imgData = ctx.getImageData(minX, minY, reqBoxW, reqBoxH);
      const data = imgData.data;
      
      // The absolute physical width of the array returned by the browser
      const actualWidth = imgData.width;

      // 2. 🧪 THE COLOR-CORRECTION LOOP
      for (let i = 0; i < data.length; i += 4) {
          const pixelIndex = i / 4;
          const px = minX + (pixelIndex % actualWidth);
          const py = minY + Math.floor(pixelIndex / actualWidth);

          // 🛡️ GATE 0: THE INVISIBLE FENCE (Geometric Isolation)
          if (!isPixelInsidePolygon(px, py, mouthPolygon)) continue;

          let r = data[i];
          let g = data[i + 1];
          let b = data[i + 2];
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;

          // 🛑 GATE 1: Deep Shadow Protection
          if (lum < 20) continue;

          // 🛑 GATE 2: Flesh Protector (Strict red-dominance check for gums/tongue)
          if (r > g * 1.15 && r > b * 1.15) continue;

          // --- 🎯 STAIN NEUTRALIZATION (Deficit-Based) ---
          const rgAvg = (r + g) / 2.0;
          const blueDeficit = Math.max(0, rgAvg - b);

          // Forcefully lift the Blue channel to chemically neutralize the yellow staining
          const newB = b + (blueDeficit * intensity * 1.2); 

          // --- 🎨 ENAMEL UNIFICATION ---
          const newLum = 0.299 * r + 0.587 * g + 0.114 * newB;
          
          let cleanR = r + (newLum - r) * (intensity * 0.65);
          let cleanG = g + (newLum - g) * (intensity * 0.65);
          let cleanB = newB + (newLum - newB) * (intensity * 0.65);

          // 🦷 Clinical Ivory Warmth (+8R, +6G, +3B)
          cleanR += 8 * intensity;
          cleanG += 6 * intensity;
          cleanB += 3 * intensity;

          // --- 💡 GENTLE LUMINANCE LIFT (Sine-Wave Modeling) ---
          // Creates a natural taper for shadows and highlights targeting mid-tones specifically
          const liftCurve = Math.sin(Math.PI * (newLum / 255)); 
          const brightMultiplier = 1.0 + (intensity * 0.12 * liftCurve);

          // Apply and clamp
          data[i]     = Math.min(255, cleanR * brightMultiplier);
          data[i + 1] = Math.min(255, cleanG * brightMultiplier);
          data[i + 2] = Math.min(255, cleanB * brightMultiplier);
      }

      // 3. Stamp it perfectly back into place
      ctx.putImageData(imgData, minX, minY);

  } catch (error) {
      console.warn("Whitening engine safely skipped a dropped frame.");
  }
}

// ── Compatibility Aliases ───────────────────────────────────────────────────
export const applyWhitening = applyUltraRealisticWhitening;
export const applyProfessionalWhitening = applyUltraRealisticWhitening;
