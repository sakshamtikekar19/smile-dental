// 🦷 ANATOMICAL ENAMEL SEGMENTATION (CLINICAL HARDENING)

/**
 * 🔥 STEP 1 — ENAMEL SEGMENTATION (Hardened)
 * Clusters candidate pixels into connected components to isolate actual teeth.
 * @param {Uint8ClampedArray} data - Pixel data
 * @param {number} w - Width
 * @param {number} h - Height
 * @param {Object} mouthBox - Geometric guard {minX, minY, maxX, maxY}
 */
function segmentEnamel(data, w, h, mouthBox = null) {
  const visited = new Uint8Array(w * h);
  const clusters = [];
  const getIdx = (x, y) => y * w + x;

  const isToothCandidate = (r, g, b, x, y) => {
    // 🛡️ GEOMETRIC GUARD: Reject any pixel physically outside the lips
    if (mouthBox) {
      if (x < mouthBox.minX || x > mouthBox.maxX || y < mouthBox.minY || y > mouthBox.maxY) return false;
    }

    const lum = (r + g + b) / 3;
    if (lum < 40 || lum > 245) return false;

    // Reject red-dominant surfaces (Lips, Gums)
    if (r > g * 1.15 && r > b * 1.20) return false; 

    // 🛡️ SATURATION GUARD: Enamel is neutral; skin/lips are vibrant
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max * 100;
    if (sat > 35) return false; // Hardened threshold (was 60)

    return true;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = getIdx(x, y);
      if (visited[i]) continue;
      const pi = i * 4;
      const r = data[pi], g = data[pi+1], b = data[pi+2];

      if (!isToothCandidate(r, g, b, x, y)) continue;

      const queue = [i], cluster = [];
      visited[i] = 1;
      while (queue.length) {
        const cur = queue.pop();
        cluster.push(cur);
        const cx = cur % w, cy = Math.floor(cur / w);
        [[cx+1, cy], [cx-1, cy], [cx, cy+1], [cx, cy-1]].forEach(([nx, ny]) => {
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) return;
          const ni = getIdx(nx, ny);
          if (visited[ni]) return;
          const ni4 = ni * 4;
          const nr = data[ni4], ng = data[ni4+1], nb = data[ni4+2];

          // 🔥 EDGE BREAKER (Surgical) - DON'T connect across teeth gaps
          const edge = Math.abs(nr - data[cur * 4]); 
          if (edge > 25) return;

          if (isToothCandidate(nr, ng, nb, nx, ny)) {
            visited[ni] = 1; queue.push(ni);
          }
        });
      }
      if (cluster.length > 120) clusters.push(cluster);
    }
  }
  return clusters;
}

/**
 * 🚀 STEP 2 — CALCULATE CLUSTER CENTERS
 */
function getClusterCenter(cluster, w) {
  let sumX = 0, sumY = 0;
  cluster.forEach(idx => {
    sumX += idx % w;
    sumY += Math.floor(idx / w);
  });
  return { x: sumX / cluster.length, y: sumY / cluster.length };
}

/**
 * 🚀 STEP 3 — SPLIT UPPER / LOWER ARCHES
 */
function splitUpperLower(clusters, w, h) {
  const centers = clusters.map(c => ({ cluster: c, center: getClusterCenter(c, w) }));
  const midY = h * 0.5;
  const upper = [], lower = [];
  centers.forEach(obj => {
    if (obj.center.y < midY) upper.push(obj);
    else lower.push(obj);
  });
  return { upper, lower };
}

/**
 * 🚀 STEP 4 — SORT LEFT TO RIGHT
 */
function sortLeftToRight(arr) {
  return arr.sort((a, b) => a.center.x - b.center.x);
}

/**
 * 🚀 STEP 5 — ASSIGN ANATOMICAL TOOTH IDs
 */
function assignToothIDs(upper, lower) {
  const labeled = [];
  const upperSorted = sortLeftToRight(upper);
  const lowerSorted = sortLeftToRight(lower);

  const assign = (arr, prefix) => {
    const n = arr.length;
    const mid = Math.floor(n / 2);
    arr.forEach((obj, i) => {
      let id;
      if (i < mid) id = `${prefix}${mid - i}`; // Left side
      else id = `${prefix}${i - mid + 1}`;     // Right side
      labeled.push({ id, cluster: obj.cluster, center: obj.center });
    });
  };

  assign(upperSorted, "U");
  assign(lowerSorted, "L");
  return labeled;
}

/**
 * 🚀 STEP 6 — DEBUG VISUALIZATION
 */
function drawAnatomicalLabels(ctx, teeth, offsetX, offsetY) {
  ctx.save();
  ctx.fillStyle = "#D4AF37"; // Gold for clinical professionalism
  ctx.strokeStyle = "black";
  ctx.lineWidth = 2;
  ctx.font = "bold 11px Inter, sans-serif";
  ctx.textAlign = "center";
  
  teeth.forEach(t => {
    const dx = t.center.x + offsetX;
    const dy = t.center.y + offsetY;
    ctx.strokeText(t.id, dx, dy);
    ctx.fillText(t.id, dx, dy);
  });
  ctx.restore();
}

/**
 * PRODUCTION-SAFE ANATOMICAL WHITENING PIPELINE
 */
export function applyWhitening(ctx, landmarks, w, h) {
  if (!landmarks || landmarks.length === 0) return;

  // 1. Define Processing Region
  const pipeIndices = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95];
  let minX = w, minY = h, maxX = 0, maxY = 0;
  pipeIndices.forEach(i => {
    const pt = landmarks[i];
    if (pt) {
      const px = pt.x * w, py = pt.y * h;
      if (px < minX) minX = px; if (py < minY) minY = py;
      if (px > maxX) maxX = px; if (py > maxY) maxY = py;
    }
  });

  const pad = 30;
  minX = Math.max(0, Math.floor(minX - pad));
  minY = Math.max(0, Math.floor(minY - pad));
  maxX = Math.min(w, Math.ceil(maxX + pad));
  maxY = Math.min(h, Math.ceil(maxY + pad));

  const boxW = maxX - minX, boxH = maxY - minY;
  if (boxW <= 0 || boxH <= 0) return;

  // 🛡️ 2. Build Geometric Mouth Guard (GMB)
  // Indices: 61 (L-corner), 291 (R-corner), 13 (U-Lip), 14 (L-Lip)
  const l61 = landmarks[61], r291 = landmarks[291], u13 = landmarks[13], l14 = landmarks[14];
  const mouthBox = {
    minX: (l61.x * w - minX),
    maxX: (r291.x * w - minX),
    minY: (u13.y * h - minY) - 10, // Small vertical safety buffer
    maxY: (l14.y * h - minY) + 12
  };

  const whiteningData = ctx.getImageData(minX, minY, boxW, boxH);
  const data = whiteningData.data;

  // 🧠 ANATOMICAL PIPELINE
  const clusters = segmentEnamel(data, boxW, boxH, mouthBox);
  const { upper, lower } = splitUpperLower(clusters, boxW, boxH);
  const teeth = assignToothIDs(upper, lower);

  teeth.forEach(tooth => {
    tooth.cluster.forEach(idx => {
      const i = idx * 4;
      let r = data[i], g = data[i+1], b = data[i+2];

      // 🧠 COLOR ANALYSIS
      const lum = (r + g + b) / 3;
      if (lum < 35) return; // skip deep gaps
      
      const warm = (r + g) / 2 - b;

      // 🎯 STRONGER YELLOW DETECTION (Production Grade)
      const isYellow = warm > 6;   // lower threshold catches more stains

      let nr = r, ng = g, nb = b;

      // 🧪 STEP 1: REAL STAIN REMOVAL (NOT BRIGHTENING)
      if (isYellow) {
        // reduce red dominance (yellow/orange source)
        nr *= 0.88;
        ng *= 0.94;

        // 🎯 NORMALIZE TOWARD IVORY (NOT white/blue)
        const target = 210; // ivory enamel base tone
        nr = nr * 0.85 + target * 0.15;
        ng = ng * 0.88 + target * 0.12;
        nb = nb * 0.92 + target * 0.08;
      }

      // ✨ STEP 2 — VERY SUBTLE LIFT (NO SHINE)
      const wr = nr * 1.015;
      const wg = ng * 1.02;
      const wb = nb * 1.015;

      // 🎯 STEP 3 — CALIBRATED BLEND (ANTI-PLASTIC)
      // Maintaining texture and depth while neutralizing stains
      const blend = 0.42; 
      
      data[i]     = Math.max(0, Math.min(255, r * (1 - blend) + wr * blend));
      data[i + 1] = Math.max(0, Math.min(255, g * (1 - blend) + wg * blend));
      data[i + 2] = Math.max(0, Math.min(255, b * (1 - blend) + wb * blend));
    });
  });

  ctx.putImageData(whiteningData, minX, minY);

  // 🔍 DEBUG VISUALIZATION (ID Labels Removed for Production)
  // drawAnatomicalLabels(ctx, teeth, minX, minY);
}
