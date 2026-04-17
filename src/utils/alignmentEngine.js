/**
 * ALIGNMENT ENGINE: LOCAL MODE (SURGICAL PRECISION)
 * Coordinate-Locked Orthodontic Core for Orchestra Stabilizer
 */

const UPPER_ARCH_INDICES = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291];
const LOWER_ARCH_INDICES = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291];

/**
 * 🚀 Transformation pass optimized for Stabilized Local Context
 * @param {CanvasRenderingContext2D} ctx - The local stabilizer canvas
 * @param {Array} landmarks - Face landmarks (0-1 range)
 * @param {number} vW - Video width
 * @param {number} vH - Video height
 * @param {Object} anchor - {x, y} in video pixels representing stabilizer center
 */
function processArch(ctx, landmarks, vW, vH, indices, anchor) {
  const points = indices.map(i => ({ 
    x: (landmarks[i].x * vW) - anchor.x + (ctx.canvas.width / 2), 
    y: (landmarks[i].y * vH) - anchor.y + (ctx.canvas.height * 0.1)
  }));
  
  const xs = points.map(p => p.x), ys = points.map(p => p.y);

  const mouthW = Math.max(...xs) - Math.min(...xs);
  const padH = mouthW * 0.08;
  const padV = mouthW * 0.12;

  // 1. CALCULATE DYNAMIC BOUNDS
  const minX = Math.floor(Math.min(...xs)) - padH;
  const maxX = Math.ceil(Math.max(...xs)) + padH;
  const minY = Math.floor(Math.min(...ys)) - padV; 
  const maxY = Math.ceil(Math.max(...ys)) + padV;
  const boxW = maxX - minX, boxH = maxY - minY;
  
  if (boxW <= 0 || boxH <= 0) return;

  const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
  const archMidY = ys.reduce((s, p) => s + p, 0) / ys.length;

  // 👄 LIP SHIELD ANCHORS
  const lipUpperY = (landmarks[13].y * vH) - anchor.y + (ctx.canvas.width * 0.1);
  const lipLowerY = (landmarks[14].y * vH) - anchor.y + (ctx.canvas.width * 0.1);

  const safeX = Math.max(0, minX);
  const safeY = Math.max(0, minY);
  const safeW = Math.min(ctx.canvas.width - safeX, boxW);
  const safeH = Math.min(ctx.canvas.height - safeY, boxH);

  if (safeW <= 0 || safeH <= 0) return;

  const imageData = ctx.getImageData(safeX, safeY, safeW, safeH);
  const sourceData = new Uint8ClampedArray(imageData.data);
  const newData = new Uint8ClampedArray(sourceData);

  for (let y = 0; y < safeH; y++) {
    for (let x = 0; x < safeW; x++) {
      const globalY = y + safeY;
      const globalX = x + safeX;

      const i = (y * safeW + x) * 4;

      // 🧠 STEP 1: TEETH ISOLATION (LUMINOSITY + PROXIMITY)
      const r = sourceData[i], g = sourceData[i+1], b = sourceData[i+2];
      const lum = (r + g + b) / 3;
      
      // Strict Enamel Filter (Relaxed for natural variations)
      const isEnamel = (lum > 75 && lum < 240 && r > 85 && g > 80 && (r - b) < 65);
      if (!isEnamel) continue;

      // 👄 SKIN SHIELD: Scale strength to 0 near lips
      const distToLip = Math.min(Math.abs(globalY - lipUpperY), Math.abs(globalY - lipLowerY));
      const skinShield = Math.max(0, Math.min(1.0, (distToLip - 2) / 10));
      if (skinShield <= 0) continue;

      // 🧠 ARCH PHYSICS
      const dxRel = (globalX - centerX) / (safeW / 1.7);
      const curve = dxRel * dxRel;
      
      const targetY = archMidY + (safeH * 0.045) * curve;

      let dy = (targetY - globalY) * 1.5 * skinShield;
      dy += Math.sin(globalX * 0.05) * 0.4; 

      let dx = -dxRel * 2.8 * (1 - Math.abs(dxRel)) * skinShield;
      dx += (dx > 0 ? 0.3 : -0.3); 

      // 🎯 SAMPLING
      const sx = Math.max(0, Math.min(safeW - 1, x - dx));
      const sy = Math.max(0, Math.min(safeH - 1, y - dy));

      const x1 = Math.floor(sx), x2 = Math.min(x1 + 1, safeW - 1);
      const y1 = Math.floor(sy), y2 = Math.min(y1 + 1, safeH - 1);
      const tx = sx - x1, ty = sy - y1;

      const i11 = (y1 * safeW + x1) * 4, i21 = (y1 * safeW + x2) * 4;
      const i12 = (y2 * safeW + x1) * 4, i22 = (y2 * safeW + x2) * 4;

      for (let c = 0; c < 3; c++) {
        let v = sourceData[i11+c]*(1-tx)*(1-ty) + sourceData[i21+c]*tx*(1-ty) +
                sourceData[i12+c]*(1-tx)*ty + sourceData[i22+c]*tx*ty;
        
        // ✨ MICRO-CONTRAST (Professional Separations)
        if (lum > 95) v = (v - 128) * 1.08 + 128;
        newData[i + c] = Math.max(0, Math.min(255, v));
      }
      newData[i+3] = 255;
    }
  }

  imageData.data.set(newData);
  ctx.putImageData(imageData, safeX, safeY); 
}

export function applyAlignment(ctx, landmarks, w, h, options = {}) {
  const anchor = options.anchor || { x: w / 2, y: h / 2 };
  // Process Upper and Lower with the same surgical logic
  processArch(ctx, landmarks, w, h, UPPER_ARCH_INDICES, anchor);
  processArch(ctx, landmarks, w, h, LOWER_ARCH_INDICES, anchor);
}
