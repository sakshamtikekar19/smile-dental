// 🦷 HYBRID "BEST OF BOTH WORLDS" WHITENING ENGINE
// Combines pixel-surgical gap protection with surgical Lip-Masking.

const UPPER_INNER_LIP = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308];
const LOWER_INNER_LIP = [308, 324, 318, 402, 317, 14, 87, 178, 88, 95, 78];

/**
 * 🚀 High-Fidelity Hybrid Clinical Whitening
 * 
 * @param {CanvasRenderingContext2D} ctx - Main simulation context
 * @param {Array} landmarks - MediaPipe face mesh landmarks
 * @param {number} iw - Canvas width
 * @param {number} ih - Canvas height
 * @param {number} intensity - Whitening power (0.0 to 1.0)
 */
export function applyUltraRealisticWhitening(ctx, landmarks, iw, ih, intensity = 0.8) {
  if (!landmarks || landmarks.length === 0) return;

  // 1. Calculate the exact boundaries of the mouth (with safety padding)
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

  // 🛡️ Safety Padding (Increased to 25px for drift stability)
  const pad = 25;
  minX = Math.max(0, Math.floor(minX - pad));
  minY = Math.max(0, Math.floor(minY - pad));
  maxX = Math.min(iw, Math.ceil(maxX + pad));
  maxY = Math.min(ih, Math.ceil(maxY + pad));
  
  const boxW = maxX - minX;
  const boxH = maxY - minY;
  if (boxW <= 0 || boxH <= 0) return;

  // 2. Extract the raw pixel data
  let imgData = ctx.getImageData(minX, minY, boxW, boxH);
  let data = imgData.data;

  // 3. 🧪 THE PIXEL MATH: Protect shadows, Neutralize yellow, Boost luminance
  for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];
      
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      // 🛑 GAP PROTECTOR: Ensures shadows stay dark for realistic 3D depth
      let gapProtection = 1.0; 
      if (lum < 40) {
          continue; // Deep shadow: Do absolutely nothing
      } else if (lum < 85) {
          gapProtection = (lum - 40) / 45; // Smooth transition for soft shadows
      }

      const activeIntensity = intensity * gapProtection; 

      // NEUTRALIZE YELLOW: Lift the blue channel to match Red/Green
      const rgAvg = (r + g) / 2;
      let newB = b + ((rgAvg - b) * (activeIntensity * 0.9)); 
      
      // LUMINANCE LIFT: Brighten midtones and highlights (dialed down for realism)
      const liftCurve = (lum / 255); 
      const brightMultiplier = 1.0 + (activeIntensity * 0.32 * liftCurve);

      data[i] = Math.min(255, r * brightMultiplier);
      data[i + 1] = Math.min(255, g * brightMultiplier);
      data[i + 2] = Math.min(255, newB * brightMultiplier);
  }

  // 4. Put the processed pixels onto an invisible Staging Canvas
  const stageCanvas = document.createElement('canvas');
  stageCanvas.width = boxW;
  stageCanvas.height = boxH;
  const stageCtx = stageCanvas.getContext('2d');
  stageCtx.putImageData(imgData, 0, 0);

  // 5. ✂️ THE MASK: Create the Cookie-Cutter shape on the main canvas
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
  ctx.clip(); // 🔥 Physically blocks any pixels outside the lips

  // 6. Stamp the highly-detailed staging canvas through the cookie cutter
  ctx.drawImage(stageCanvas, minX, minY);
  
  ctx.restore(); 
}

// ── Compatibility Aliases ───────────────────────────────────────────────────
export const applyWhitening = applyUltraRealisticWhitening;
export const applyProfessionalWhitening = applyUltraRealisticWhitening;
