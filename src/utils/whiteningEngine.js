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

      const lum = (r + g + b) / 3;
      if (lum < 35) return; // skip deep gaps

      const edgeBoost = Math.abs(r - g) + Math.abs(g - b);
      if (edgeBoost > 60) return; // preserve tooth edges

      // 🧪 STEP 1 — Detect Interdental Regions (KEY FIX)
      // Horizontal edge detection to identify boundaries between teeth
      const rightIdx = i + 4;
      let isEdge = false;
      if (rightIdx < data.length) {
        const r2 = data[rightIdx], g2 = data[rightIdx + 1], b2 = data[rightIdx + 2];
        const lum2 = (r2 + g2 + b2) / 3;
        isEdge = Math.abs(lum - lum2) > 14;
      }

      // 🧪 STEP 2 — Tiered Cleaning (Plaque & Neutralization)
      let nr = r, ng = g, nb = b;
      const warm = (r + g) / 2 - b;

      if (isEdge && warm > 6) {
        // 🔥 INTERDENTAL BOOST (Stronger red reduction for shadows/plaque)
        nr *= 0.86;  
        ng *= 0.92;
        const avg = (nr + ng + nb) / 3;
        // Neutral ivory (NO blue shift)
        nr = nr * 0.90 + avg * 0.10;
        ng = ng * 0.90 + avg * 0.10;
        nb = nb * 0.92 + avg * 0.08;
      } else if (warm > 8) {
        // ✨ Normal Surface Cleaning
        nr *= 0.92;
        ng *= 0.96;
        const avg = (nr + ng + nb) / 3;
        nr = nr * 0.94 + avg * 0.06;
        ng = ng * 0.94 + avg * 0.06;
        nb = nb * 0.94 + avg * 0.06;
      }

      // ✨ STEP 4 — Balanced Whitening Lift (NO BLUE TINT)
      // Balanced lift prevents the "fake blue glow" common in simple whitening
      const wr = nr * 1.035;
      const wg = ng * 1.045;
      const wb = nb * 1.04;

      // 🎯 STEP 5 — Adaptive Blend (KEY FOR REALISM)
      const blend = isEdge ? 0.72 : 0.58;
      
      let fr = r * (1 - blend) + wr * blend;
      let fg = g * (1 - blend) + wg * blend;
      let fb = b * (1 - blend) + wb * blend;

      // ✨ STEP 6 — Micro Contrast (Restores anatomical separation)
      const contrast = 1.03;
      fr = (fr - 128) * contrast + 128;
      fg = (fg - 128) * contrast + 128;
      fb = (fb - 128) * contrast + 128;

      data[i]     = Math.max(0, Math.min(255, fr));
      data[i + 1] = Math.max(0, Math.min(255, fg));
      data[i + 2] = Math.max(0, Math.min(255, fb));
    });
  });

  ctx.putImageData(whiteningData, minX, minY);

  // 🔍 DEBUG VISUALIZATION (ID Labels Removed for Production)
  // drawAnatomicalLabels(ctx, teeth, minX, minY);
}
