// 🦷 LOCKED WHITENING ENGINE (RECTIFIED & PRODUCTION SAFE)

/**
 * PRODUCTION-SAFE WHITENING PIPELINE
 * Rectified to ensure visibility in all lighting conditions.
 * Uses a feathered alpha mask to smoothly blend whitening into natural enamel.
 */
export function applyWhitening(ctx, landmarks, w, h) {
  if (!landmarks || landmarks.length === 0) return;

  // 🛡️ 1. Create the 'Natural Edge' Alpha Mask
  const pipeIndices = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95];
  
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = w; maskCanvas.height = h;
  const mctx = maskCanvas.getContext("2d");
  
  const maskPath = new Path2D();
  pipeIndices.forEach((idx, i) => {
    const p = landmarks[idx];
    if (p) {
      if (i === 0) maskPath.moveTo(p.x * w, p.y * h);
      else maskPath.lineTo(p.x * w, p.y * h);
    }
  });
  maskPath.closePath();

  // Draw blurred mask for soft blending (Step 4: Reduce mask bleed to 3px)
  mctx.filter = "blur(3px)"; 
  mctx.fillStyle = "white";
  mctx.fill(maskPath);

  // 📍 2. Regional Optimization
  let minX = w, minY = h, maxX = 0, maxY = 0;
  pipeIndices.forEach(i => {
    const pt = landmarks[i];
    if (pt) {
      const px = pt.x * w, py = pt.y * h;
      if (px < minX) minX = px; if (py < minY) minY = py;
      if (px > maxX) maxX = px; if (py > maxY) maxY = py;
    }
  });

  const pad = 20;
  minX = Math.max(0, Math.floor(minX - pad));
  minY = Math.max(0, Math.floor(minY - pad));
  maxX = Math.min(w, Math.ceil(maxX + pad));
  maxY = Math.min(h, Math.ceil(maxY + pad));

  const boxW = maxX - minX;
  const boxH = maxY - minY;
  if (boxW <= 0 || boxH <= 0) return;

  const whiteningData = ctx.getImageData(minX, minY, boxW, boxH);
  const maskBuffer = mctx.getImageData(minX, minY, boxW, boxH).data;
  const whit = whiteningData.data;

  // 🔍 3. Surgical Whitening with Alpha Blending
  for (let i = 0; i < whit.length; i += 4) {
    const maskAlpha = maskBuffer[i + 3] / 255; 
    if (maskAlpha === 0) continue;

    let r = whit[i], g = whit[i+1], b = whit[i+2];

    // 🛡️ STEP 1: INTERDENTAL CLEANING (Protect deep gaps but clean plaque)
    const lum = (r + g + b) / 3;
    if (lum < 35) continue; 

    // 🛡️ STEP 3: HARDER GUM REJECTION (Pink/Red dominance check)
    const isLip = r > g * 1.18 && r > b * 1.25;
    const isGum = (r > 115 && g < 115 && b < 115) || (r > 140 && (r - g) > 25);
    if (isLip || isGum) continue;

    // 🛡️ STEP 2: HARDEN TOOTH DETECTION
    const isTooth =
      r > 70 && g > 65 && b > 55 &&     
      r < 245 && g < 245 && b < 245 &&  
      (r - b) < 50 &&                   
      (g - b) < 32 &&                   
      b > 45;                           

    if (!isTooth) continue;

    let nr = r, ng = g, nb = b;
    const warm = (r + g) / 2 - b;

    // 🧪 STEP 2: STRONGER PLAQUE REMOVAL
    if (warm > 6) {
      nr *= 0.88; ng *= 0.93; 
      const avg = (nr + ng + nb) / 3;
      nr = nr * 0.90 + avg * 0.10;
      ng = ng * 0.90 + avg * 0.10;
      nb = nb * 0.90 + avg * 0.10;
    }

    // ✨ STEP 5: FINAL LIFT (NATURAL ENAMEL)
    const wr = nr * 1.035;
    const wg = ng * 1.05;
    const wb = nb * 1.045; 

    const blend = 0.60 * maskAlpha; 
    
    whit[i]     = Math.max(0, Math.min(255, r * (1 - blend) + wr * blend));
    whit[i + 1] = Math.max(0, Math.min(255, g * (1 - blend) + wg * blend));
    whit[i + 2] = Math.max(0, Math.min(255, b * (1 - blend) + wb * blend));
  }

    const blend = 0.60 * maskAlpha; // Increased blend slightly for visibility
    
    whit[i]     = Math.max(0, Math.min(255, r * (1 - blend) + wr * blend));
    whit[i + 1] = Math.max(0, Math.min(255, g * (1 - blend) + wg * blend));
    whit[i + 2] = Math.max(0, Math.min(255, b * (1 - blend) + wb * blend));
  }

  ctx.putImageData(whiteningData, minX, minY);
}
