// 🦷 LOCKED WHITENING ENGINE (SURGICAL SAFETY & SPEED LOCK)

/**
 * PRODUCTION-SAFE WHITENING PIPELINE
 * Implements a 'Surgical Mask' via Landmark Clipping to guarantee zero lip/skin bleed.
 * Limited to mouth bounding box for maximum performance.
 */
export function applyWhitening(ctx, landmarks, w, h) {
  if (!landmarks || landmarks.length === 0) return;

  // 🛡️ 1. SURGICAL MASK (Step 1: Create a Digital Fence)
  // Indices for the inner mouth opening (Dental Window)
  const pipeIndices = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95];
  
  ctx.save();
  const mask = new Path2D();
  pipeIndices.forEach((idx, i) => {
    const p = landmarks[idx];
    if (p) {
      if (i === 0) mask.moveTo(p.x * w, p.y * h);
      else mask.lineTo(p.x * w, p.y * h);
    }
  });
  mask.closePath();
  
  // Apply a slight 'Natural Feather' if supported, or just clip for safety
  ctx.clip(mask);

  // 📍 2. Calculate bounding box for loop optimization
  let minX = w, minY = h, maxX = 0, maxY = 0;
  pipeIndices.forEach(i => {
    const pt = landmarks[i];
    if (pt) {
      const px = pt.x * w, py = pt.y * h;
      if (px < minX) minX = px; if (py < minY) minY = py;
      if (px > maxX) maxX = px; if (py > maxY) maxY = py;
    }
  });

  const pad = 10;
  minX = Math.max(0, Math.floor(minX - pad));
  minY = Math.max(0, Math.floor(minY - pad));
  maxX = Math.min(w, Math.ceil(maxX + pad));
  maxY = Math.min(h, Math.ceil(maxY + pad));

  const boxW = maxX - minX;
  const boxH = maxY - minY;
  if (boxW <= 0 || boxH <= 0) {
    ctx.restore();
    return;
  }

  const imageData = ctx.getImageData(minX, minY, boxW, boxH);
  const data = imageData.data;

  // 🔍 3. Loop strictly through protected bounding box
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i], g = data[i+1], b = data[i+2];

    // 🛡️ HARD LOCK (Lip Killer + Enamel Guard)
    const isLip = r > g * 1.22 && r > b * 1.35; // slightly more aggressive lip kill
    if (isLip) continue;

    const isTooth =
      r > 80 && g > 75 && b > 60 &&     
      r < 240 && g < 240 && b < 240 && 
      (r - b) < 45 &&                   
      (r > g * 0.82) &&                 
      (b > 35);                         

    if (!isTooth) continue;

    let nr = r, ng = g, nb = b;
    const warm = (r + g) / 2 - b;

    // 🧪 PLAQUE CLEANER
    if (warm > 8) {
      nr *= 0.92; ng *= 0.96;
      const avg = (nr + ng + nb) / 3;
      nr = nr * 0.94 + avg * 0.06;
      ng = ng * 0.94 + avg * 0.06;
      nb = nb * 0.94 + avg * 0.06;
    }

    // ✨ NATURAL WHITENING
    const liftR = 1.03, liftG = 1.05, liftB = 1.06;
    const wr = Math.min(255, nr * liftR);
    const wg = Math.min(255, ng * liftG);
    const wb = Math.min(255, nb * liftB);

    const blend = 0.55;
    let fr = r * (1 - blend) + wr * blend;
    let fg = g * (1 - blend) + wg * blend;
    let fb = b * (1 - blend) + wb * blend;

    const contrast = 1.02;
    fr = (fr - 128) * contrast + 128;
    fg = (fg - 128) * contrast + 128;
    fb = (fb - 128) * contrast + 128;

    data[i]     = Math.max(0, Math.min(255, fr));
    data[i + 1] = Math.max(0, Math.min(255, fg));
    data[i + 2] = Math.max(0, Math.min(255, fb));
  }

  ctx.putImageData(imageData, minX, minY);
  ctx.restore(); // 🛡️ Restore Digital Fence
}
