// 🦷 "COLOR UNIFIED" WHITENING ENGINE
// Reduces webcam noise via RGB-to-Luminance unification and adds organic ivory tinting.

const UPPER_INNER_LIP = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308];
const LOWER_INNER_LIP = [308, 324, 318, 402, 317, 14, 87, 178, 88, 95, 78];

/**
 * 🚀 High-Fidelity Color-Unified Whitening
 * 
 * @param {CanvasRenderingContext2D} ctx - Main simulation context
 * @param {Array} landmarks - MediaPipe face mesh landmarks
 * @param {number} iw - Canvas width
 * @param {number} ih - Canvas height
 * @param {number} intensity - Whitening power (0.0 to 1.0)
 */
export function applyUltraRealisticWhitening(ctx, landmarks, iw, ih, intensity = 0.8) {
  if (!landmarks || landmarks.length === 0) return;

  // 1. Calculate boundaries (with 25px safety padding for drift)
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  const allLipPoints = [...UPPER_INNER_LIP, ...LOWER_INNER_LIP];

  allLipPoints.forEach(idx => {
      const pt = landmarks[idx];
      const x = pt.x <= 1 ? pt.x * iw : pt.x;
      const y = pt.y <= 1 ? pt.y * ih : pt.y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
  });

  const pad = 25;
  minX = Math.max(0, Math.floor(minX - pad));
  minY = Math.max(0, Math.floor(minY - pad));
  maxX = Math.min(iw, Math.ceil(maxX + pad));
  maxY = Math.min(ih, Math.ceil(maxY + pad));
  
  const boxW = maxX - minX;
  const boxH = maxY - minY;
  if (boxW <= 0 || boxH <= 0) return;

  // 2. Extract pixel data
  let imgData = ctx.getImageData(minX, minY, boxW, boxH);
  let data = imgData.data;

  // 3. 🧪 THE PIXEL MATH: Color Unification, Shadow Protection, Luminance Lift
  for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];
      
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      // 🛑 GAP PROTECTOR: 3D depth preservation
      let gapProtection = 1.0; 
      if (lum < 40) {
          continue; 
      } else if (lum < 85) {
          gapProtection = (lum - 40) / 45;
      }

      const activeIntensity = intensity * gapProtection; 

      // 🎨 COLOR UNIFICATION: Kills chromatic aberration/webcam noise
      // Pull RGB tightly toward clean grayscale luminance base
      let cleanR = r + (lum - r) * (activeIntensity * 0.95);
      let cleanG = g + (lum - g) * (activeIntensity * 0.95);
      let cleanB = b + (lum - b) * (activeIntensity * 0.95);

      // 🦷 NATURAL IVORY TINT: Microscopic clinical warmth
      cleanR += 4 * activeIntensity; 
      cleanG += 1 * activeIntensity; 
      
      // 💡 LUMINANCE LIFT: Safe brightening
      const liftCurve = (lum / 255); 
      const brightMultiplier = 1.0 + (activeIntensity * 0.30 * liftCurve);

      data[i]     = Math.min(255, cleanR * brightMultiplier);
      data[i + 1] = Math.min(255, cleanG * brightMultiplier);
      data[i + 2] = Math.min(255, cleanB * brightMultiplier);
  }

  // 4. Staging
  const stageCanvas = document.createElement('canvas');
  stageCanvas.width = boxW;
  stageCanvas.height = boxH;
  const stageCtx = stageCanvas.getContext('2d');
  stageCtx.putImageData(imgData, 0, 0);

  // 5. ✂️ THE MASK: Cookie-Cutter (Internal Lip Path)
  ctx.save();
  ctx.beginPath();
  
  UPPER_INNER_LIP.forEach((idx, i) => {
    const pt = landmarks[idx];
    const x = pt.x <= 1 ? pt.x * iw : pt.x;
    const y = pt.y <= 1 ? pt.y * ih : pt.y;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  
  LOWER_INNER_LIP.forEach((idx) => {
     const pt = landmarks[idx];
     const x = pt.x <= 1 ? pt.x * iw : pt.x;
     const y = pt.y <= 1 ? pt.y * ih : pt.y;
     ctx.lineTo(x, y);
  });
  
  ctx.closePath();
  ctx.clip(); // 🔥 Surgical Precision

  // 6. Stamp
  ctx.drawImage(stageCanvas, minX, minY);
  
  ctx.restore(); 
}

// ── Compatibility Aliases ───────────────────────────────────────────────────
export const applyWhitening = applyUltraRealisticWhitening;
export const applyProfessionalWhitening = applyUltraRealisticWhitening;
