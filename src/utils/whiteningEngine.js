/**
 * WHITENING ENGINE: CLINICAL PRODUCTION
 * Morphological Enamel Reconstruction & Plaque Neutralization
 */

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/**
 * 🦷 Clinical Whitening with Rotation-Aware Landmark Sync
 * @param {CanvasRenderingContext2D} ctx - Local Stabilizer Context
 * @param {Array} landmarks - Global Face Landmarks
 * @param {number} vW - Video Width
 * @param {number} vH - Video Height
 * @param {Object} opts - { anchor: {x,y}, rotation: number }
 */
export function applyWhitening(ctx, landmarks, vW, vH, opts = {}) {
  const anchor = opts.anchor || { x: vW / 2, y: vH / 2 };
  const angRad = (opts.rotation || 0) * (Math.PI / 180);
  const cos = Math.cos(-angRad);
  const sin = Math.sin(-angRad);

  const canvasW = ctx.canvas.width;
  const canvasH = ctx.canvas.height;

  // 1. PROJECT LANDMARKS INTO ROTATED LOCAL SPACE
  const transform = (p) => {
    const dx = (p.x * vW) - anchor.x;
    const dy = (p.y * vH) - anchor.y;
    const rx = dx * cos - dy * sin;
    const ry = dx * sin + dy * cos;
    return {
      x: rx + canvasW / 2,
      y: ry + canvasH * 0.1
    };
  };

  const innerLipIndices = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95];
  const innerPts = innerLipIndices.map(i => transform(landmarks[i]));
  
  const midTop = transform(landmarks[13]);
  const midBottom = transform(landmarks[14]);
  const padding = (midBottom.y - midTop.y) * 0.35;
  const regionTop = midTop.y - padding;
  const regionBottom = midBottom.y + padding;

  const xs = innerPts.map(p => p.x), ys = innerPts.map(p => p.y);
  const minX = Math.floor(Math.min(...xs)) - 2, maxX = Math.ceil(Math.max(...xs)) + 2;
  const minY = Math.floor(Math.min(...ys)) - 2, maxY = Math.ceil(Math.max(...ys)) + 2;
  const boxW = maxX - minX, boxH = maxY - minY;

  if (boxW <= 0 || boxH <= 0 || boxW > 2000 || boxH > 2000) return;

  // 2. BUFFER ISOLATION
  const offCanvas = document.createElement("canvas");
  offCanvas.width = boxW; offCanvas.height = boxH;
  const octx = offCanvas.getContext("2d");
  octx.drawImage(ctx.canvas, minX, minY, boxW, boxH, 0, 0, boxW, boxH);
  
  const imageData = octx.getImageData(0, 0, boxW, boxH);
  const data = imageData.data;
  const sourceData = new Uint8ClampedArray(data);

  // --- CLINICAL FILTERS ---
  for (let y = 0; y < boxH; y++) {
    const globalY = minY + y;
    if (globalY < regionTop || globalY > regionBottom) continue;

    for (let x = 0; x < boxW; x++) {
      const idx = (y * boxW + x) * 4;
      const r = data[idx], g = data[idx+1], b = data[idx+2];
      const lum = (r + g + b) / 3;

      // ENAMEL DETECTION
      const isTooth = r > 85 && g > 80 && b > 65 && lum > 75 && lum < 225;
      if (!isTooth) continue;

      // EDGE PROTECTION (Interdental Shadows)
      const iL = ((y * boxW + Math.max(0, x - 1)) * 4);
      const iR = ((y * boxW + Math.min(boxW - 1, x + 1)) * 4);
      const lumL = (sourceData[iL] + sourceData[iL+1] + sourceData[iL+2])/3;
      const lumR = (sourceData[iR] + sourceData[iR+1] + sourceData[iR+2])/3;
      const edgeS = Math.abs(lumL - lumR);
      if (edgeS > 25 && edgeS < 90) continue; 

      // ARCH GRADIENT
      const distFromCenter = Math.abs(x - boxW / 2) / (boxW / 2);
      const gradient = 1.0 - (distFromCenter * 0.3);

      // TARTAR NEUTRALIZATION
      const warmS = (r + g) / 2 - b; 
      let nr = r, ng = g, nb = b;

      if (warmS > 10 && lum > 65 && lum < 180) {
        const cleanup = 0.12 * gradient;
        nr *= (1 - cleanup);
        ng *= (1 - cleanup * 0.5);
        const l = (nr + ng + nb) / 3;
        nr = nr * 0.9 + l * 0.1;
        ng = ng * 0.9 + l * 0.1;
        nb = nb * 0.9 + l * 0.1;
      }

      // STOCHIOMETRIC LIFT
      const blend = 0.55;
      const wr = nr * 1.03;
      const wg = ng * 1.05;
      const wb = nb * 1.07;

      data[idx]   = clamp(r * (1-blend) + wr * blend, 0, 255);
      data[idx+1] = clamp(g * (1-blend) + wg * blend, 0, 255);
      data[idx+2] = clamp(b * (1-blend) + wb * blend, 0, 255);
    }
  }

  octx.putImageData(imageData, 0, 0);

  // 3. SURGICAL CLIP & BLEND
  ctx.save();
  const path = new Path2D();
  path.moveTo(innerPts[0].x, innerPts[0].y);
  for (let i = 1; i < innerPts.length; i++) path.lineTo(innerPts[i].x, innerPts[i].y);
  path.closePath();

  ctx.clip(path);
  ctx.drawImage(offCanvas, minX, minY);
  ctx.restore();
}
