// 🦷 ANATOMICAL ENAMEL SEGMENTATION & IDENTIFICATION ENGINE

/**
 * 🔥 STEP 1 — ENAMEL SEGMENTATION
 * Clusters candidate pixels into connected components to isolate actual teeth.
 */
function segmentEnamel(data, w, h) {
  const visited = new Uint8Array(w * h);
  const clusters = [];
  const getIdx = (x, y) => y * w + x;

  const isToothCandidate = (r, g, b) => {
    const lum = (r + g + b) / 3;
    if (lum < 40 || lum > 245) return false;
    if (r > g * 1.2 && r > b * 1.25) return false; // reject lips/gums
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max * 100;
    if (sat > 60) return false; // reject saturated skin
    return true;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = getIdx(x, y);
      if (visited[i]) continue;
      const pi = i * 4;
      if (!isToothCandidate(data[pi], data[pi+1], data[pi+2])) continue;

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
          if (isToothCandidate(data[ni4], data[ni4+1], data[ni4+2])) {
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

  const whiteningData = ctx.getImageData(minX, minY, boxW, boxH);
  const data = whiteningData.data;

  // 🧠 ANATOMICAL PIPELINE
  const clusters = segmentEnamel(data, boxW, boxH);
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

      const warm = (r + g) / 2 - b;
      let nr = r, ng = g, nb = b;

      // 🔥 PLAQUE REMOVAL
      if (warm > 6) {
        nr *= 0.88; ng *= 0.93;
        const avg = (nr + ng + nb) / 3;
        nr = nr * 0.90 + avg * 0.10;
        ng = ng * 0.90 + avg * 0.10;
        nb = nb * 0.94 + avg * 0.06; // Neutralized blue lift
      }

      // ✨ WHITENING LIFT
      const wr = nr * 1.035, wg = ng * 1.05, wb = nb * 1.045;
      const blend = 0.58;
      
      data[i]     = r * (1 - blend) + wr * blend;
      data[i + 1] = g * (1 - blend) + wg * blend;
      data[i + 2] = b * (1 - blend) + wb * blend;
    });
  });

  ctx.putImageData(whiteningData, minX, minY);

  // 🔍 DEBUG VISUALIZATION (ID Labels)
  drawAnatomicalLabels(ctx, teeth, minX, minY);
}
