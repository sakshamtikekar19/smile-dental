/**
 * ALIGNMENT ENGINE: VISIBLE FORCE MODE (V6)
 * Coordination-Locked Orthodontic Core with Minimum-Flow Shielding.
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

  // 🛡️ ANCHOR: True Facial Midline (Landmark 13)
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
  
  // ✅ SEPARATE BUFFERS (CRITICAL for transformation)
  const src = new Uint8ClampedArray(imageData.data); // Source Copy
  const dst = imageData.data;                      // Destination Pointer

  // 2. 🧪 VISIBLE FORCE ORTHODONTIC LOOP (V6)
  for (let y = 0; y < safeH; y++) {
    for (let x = 0; x < safeW; x++) {
      const i = (y * safeW + x) * 4;

      const r = src[i], g = src[i + 1], b = src[i + 2];
      const globalX = x; // Relative to crop
      const globalY = y;

      // ✅ NORMALIZED POSITION (Relative to Midline)
      const nx = (globalX - centerX) / (boxW * 0.5);

      // ✅ PARABOLIC TARGET (V6 - 0.07 Curve)
      const curve = nx * nx;
      const targetY = archMidY + (boxH * 0.07) * curve;

      // ✅ STRONG BUT CONTROLLED FORCES (V6)
      let dx = -nx * (boxW * 0.22);         // BIG horizontal movement
      let dy = (targetY - globalY) * 1.6;   // Stronger vertical lift

      // ✅ TOOTH DETECTION (V6 Improved)
      const lum = (r + g + b) / 3;
      const isTooth =
        lum > 90 &&              // Bright enough
        r > b &&                 // Not bluish
        (r - g) < 35 &&          // Avoid lips
        (r - b) < 55;            // Avoid dental reds

      if (isTooth) {
        dx *= 1.5;
        dy *= 1.3;
      } else {
        dx *= 0.6;  // Protect gums/lips (dampened but not killed)
        dy *= 0.5;
      }

      // ✅ MINIMUM FLOW SKIN SHIELD (V6 - Never kill movement)
      const distToLip = Math.min(
        Math.abs(globalY - lipTopY),
        Math.abs(globalY - lipBottomY)
      );
      // 🔥 FIX: Minimum force of 0.4 ensures visible movement at edges
      const skinShield = Math.max(0.4, Math.min(1, distToLip / 25));

      dx *= skinShield;
      dy *= skinShield;

      // ✅ FORCE CLAMPING (Increased for V6)
      dx = Math.max(-35, Math.min(35, dx));
      dy = Math.max(-25, Math.min(25, dy));

      // 🧪 DEBUG: Trace center-point force once per frame
      if (Math.abs(x - centerX) < 0.5 && Math.abs(y - archMidY) < 0.5) {
        // console.log("ORTHO V6 DEBUG [DX, DY]:", dx, dy);
      }

      // ✅ SAFE SAMPLING (Explicit Floor)
      const sx = Math.max(0, Math.min(safeW - 1, x - dx));
      const sy = Math.max(0, Math.min(safeH - 1, y - dy));

      const sx0 = Math.floor(sx);
      const sy0 = Math.floor(sy);
      const srcIdx = (sy0 * safeW + sx0) * 4;

      dst[i]     = src[srcIdx];
      dst[i + 1] = src[srcIdx + 1];
      dst[i + 2] = src[srcIdx + 2];
      dst[i + 3] = 255;
    }
  }

  // ctx.putImageData already writes to safeX/safeY from the modified buffer pointer
  ctx.putImageData(imageData, safeX, safeY); 
}

export function applyAlignment(ctx, landmarks, w, h, options = {}) {
  const anchor = options.anchor || { x: w / 2, y: h / 2 };
  processArch(ctx, landmarks, w, h, UPPER_ARCH_INDICES, anchor);
  processArch(ctx, landmarks, w, h, LOWER_ARCH_INDICES, anchor);
}
