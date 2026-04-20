// 🦷 "INVISIBLE FENCE" WHITENING ENGINE
// Uses a Ray-Casting algorithm (Gate 0) for absolute geometric protection.
// Confines whitening strictly within the anatomical mouth opening defined by FaceMesh.

const UPPER_INNER_LIP = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308];
const LOWER_INNER_LIP = [308, 324, 318, 402, 317, 14, 87, 178, 88, 95, 78];

/**
 * 🛡️ RAY-CASTING ALGORITHM
 * Returns true ONLY if the pixel (px, py) is strictly inside the polygon.
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
 * 🚀 High-Fidelity Clinical Whitening with Geometric Protection
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
  const innerMouthIndices = [...UPPER_INNER_LIP, ...LOWER_INNER_LIP];

  innerMouthIndices.forEach(idx => {
      const pt = landmarks[idx];
      const x = pt.x <= 1 ? pt.x * iw : pt.x;
      const y = pt.y <= 1 ? pt.y * ih : pt.y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
  });

  minX = Math.max(0, Math.floor(minX));
  minY = Math.max(0, Math.floor(minY));
  maxX = Math.min(iw, Math.ceil(maxX));
  maxY = Math.min(ih, Math.ceil(maxY));
  
  const boxW = maxX - minX;
  const boxH = maxY - minY;
  if (boxW <= 0 || boxH <= 0) return;

  // 🛡️ 2. Map the exact FaceMesh inner lip points to screen coordinates for the Fence
  const mouthPolygon = innerMouthIndices.map(idx => ({
      x: landmarks[idx].x <= 1 ? landmarks[idx].x * iw : landmarks[idx].x,
      y: landmarks[idx].y <= 1 ? landmarks[idx].y * ih : landmarks[idx].y
  }));

  // 3. Extract the raw pixel data
  const imgData = ctx.getImageData(minX, minY, boxW, boxH);
  const data = imgData.data;

  // 4. 🧪 THE GATING PIPELINE: Geometry, Shadows, and Flesh
  for (let i = 0; i < data.length; i += 4) {
      // 📍 Calculate the absolute X, Y coordinate of the current pixel
      const pixelIndex = i / 4;
      const px = minX + (pixelIndex % boxW);
      const py = minY + Math.floor(pixelIndex / boxW);

      // 🛑 GATE 0: THE INVISIBLE FENCE (Geometric Protection)
      // If the pixel is mathematically outside the lips, skip it instantly.
      if (!isPixelInsidePolygon(px, py, mouthPolygon)) continue;

      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      // 🛑 GATE 1: Gap Protector (Preserves interdental depth)
      if (lum < 80) continue; 

      // 🛑 GATE 2: Flesh Protector (Internal protection for gums/tongue)
      // Tighter 1.15 ratio for maximum clinical precision
      if (r > g * 1.15 && r > b * 1.15) continue;

      // ✅ PIXEL PASSED ALL GATES. Apply whitening math.

      // COLOR UNIFICATION: Noise reduction 
      const cleanR = r + (lum - r) * (intensity * 0.85);
      const cleanG = g + (lum - g) * (intensity * 0.85);
      const cleanB = b + (lum - b) * (intensity * 0.85);

      // CLINICAL TINT: Microscopic cool blue lift (+6)
      const finalB = cleanB + (6 * intensity); 
      
      // LUMINANCE LIFT: Texture-safe brightening boost
      const liftCurve = (lum / 255); 
      const brightMultiplier = 1.0 + (intensity * 0.25 * liftCurve);

      data[i]     = Math.min(255, cleanR * brightMultiplier);
      data[i + 1] = Math.min(255, cleanG * brightMultiplier);
      data[i + 2] = Math.min(255, finalB * brightMultiplier);
  }

  // 5. 🚀 DIRECT PIXEL REPLACEMENT
  // Confined perfectly to the lip polygon by Gate 0.
  ctx.putImageData(imgData, minX, minY);
}

// ── Compatibility Aliases ───────────────────────────────────────────────────
export const applyWhitening = applyUltraRealisticWhitening;
export const applyProfessionalWhitening = applyUltraRealisticWhitening;
