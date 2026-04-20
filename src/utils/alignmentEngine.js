/**
 * ALIGNMENT ENGINE: PRODUCTION-SAFE MODE (V5)
 * Coordination-Locked Orthodontic Core with Facial Midline Anchoring.
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

  // 🛡️ ANCHOR FIX: True Facial Midline (Landmark 13)
  const globalMidX = landmarks[13].x * vW;
  const globalMidY = landmarks[13].y * vH;
  const localMidX = globalMidX - anchor.x + (ctx.canvas.width / 2);
  const localMidY = globalMidY - anchor.y + (ctx.canvas.height * 0.1);

  // Bounds for local crop
  const safeX = Math.max(0, minX);
  const safeY = Math.max(0, minY);
  const safeW = Math.min(ctx.canvas.width - safeX, boxW);
  const safeH = Math.min(ctx.canvas.height - safeY, boxH);

  if (safeW <= 0 || safeH <= 0) return;

  // Center coordinates relative to the safe crop
  const centerX = localMidX - safeX;
  const archMidY = localMidY - safeY;

  // 👄 LIP SHIELD ANCHORS (Relative to safe crop)
  const lipTopY = (landmarks[13].y * vH) - anchor.y + (ctx.canvas.height * 0.1) - safeY;
  const lipBottomY = (landmarks[14].y * vH) - anchor.y + (ctx.canvas.height * 0.1) - safeY;

  const imageData = ctx.getImageData(safeX, safeY, safeW, safeH);
  const src = new Uint8ClampedArray(imageData.data);
  const dst = new Uint8ClampedArray(src);

  // 2. 🧪 PRODUCTION-SAFE ORTHODONTIC LOOP
  for (let y = 0; y < safeH; y++) {
    for (let x = 0; x < safeW; x++) {
      const i = (y * safeW + x) * 4;

      const r = src[i], g = src[i + 1], b = src[i + 2];
      const globalX = x; // Relative to crop
      const globalY = y;

      // ✅ NORMALIZED POSITION (Relative to Midline)
      const nx = (globalX - centerX) / (boxW * 0.5);

      // ✅ PARABOLIC TARGET (Stabilized)
      const curve = nx * nx;
      const targetY = archMidY + (boxH * 0.07) * curve;

      // ✅ CONTROLLED FORCES (V5)
      let dy = (targetY - globalY) * 1.2;   // Optimized for stability
      let dx = -nx * (boxW * 0.12);         // Stronger horizontal pull

      // ✅ TOOTH DETECTION (Refined)
      const lum = (r + g + b) / 3;
      const isTooth =
        lum > 90 &&              // Bright enough
        r > b &&                 // Not bluish
        (r - g) < 35 &&          // Avoid gums/lips
        (r - b) < 55;            // Avoid non-dental reds

      if (isTooth) {
        dx *= 1.5;
        dy *= 1.3;
      } else {
        dx *= 0.6;  // Protect gums/lips
        dy *= 0.5;
      }

      // ✅ STRONGER SKIN SHIELD (20px transition)
      const distToLip = Math.min(
        Math.abs(globalY - lipTopY),
        Math.abs(globalY - lipBottomY)
      );
      const skinShield = Math.max(0, Math.min(1, distToLip / 20));

      dx *= skinShield;
      dy *= skinShield;

      // ✅ FORCE CLAMPING (Avoid distortion)
      dx = Math.max(-18, Math.min(18, dx));
      dy = Math.max(-14, Math.min(14, dy));

      // ✅ SAFE SAMPLING (Direct)
      const sx = Math.max(0, Math.min(safeW - 1, x - dx));
      const sy = Math.max(0, Math.min(safeH - 1, y - dy));

      const srcIdx = ((sy | 0) * safeW + (sx | 0)) * 4;

      dst[i]     = src[srcIdx];
      dst[i + 1] = src[srcIdx + 1];
      dst[i + 2] = src[srcIdx + 2];
      dst[i + 3] = 255;
    }
  }

  imageData.data.set(dst);
  ctx.putImageData(imageData, safeX, safeY); 
}

export function applyAlignment(ctx, landmarks, w, h, options = {}) {
  const anchor = options.anchor || { x: w / 2, y: h / 2 };
  processArch(ctx, landmarks, w, h, UPPER_ARCH_INDICES, anchor);
  processArch(ctx, landmarks, w, h, LOWER_ARCH_INDICES, anchor);
}
