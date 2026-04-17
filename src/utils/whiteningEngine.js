// 🦷 ADVANCED ENAMEL SEGMENTATION ENGINE (PRODUCTION-GRADE)

/**
 * 🔥 STEP 1 — ENAMEL SEGMENTATION ENGINE
 * Clusters candidate pixels into connected components to isolate actual teeth.
 * Rejects isolated noise, skin reflections, and lip-line artifacts.
 */
function segmentEnamel(data, w, h) {
  const visited = new Uint8Array(w * h);
  const clusters = [];

  const getIdx = (x, y) => y * w + x;

  const isToothCandidate = (r, g, b) => {
    const lum = (r + g + b) / 3;
    if (lum < 40 || lum > 245) return false;

    // reject lips/gums (Surgical Rejection)
    if (r > g * 1.2 && r > b * 1.25) return false;

    // reject saturated skin
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max * 100;
    if (sat > 60) return false;

    return true;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = getIdx(x, y);
      if (visited[i]) continue;

      const pi = i * 4;
      const r = data[pi], g = data[pi+1], b = data[pi+2];

      if (!isToothCandidate(r, g, b)) continue;

      // 🔥 CLUSTERING (BFS/DFS Hybrid)
      const queue = [i];
      const cluster = [];
      visited[i] = 1;

      while (queue.length) {
        const cur = queue.pop();
        cluster.push(cur);

        const cx = cur % w;
        const cy = Math.floor(cur / w);

        const neighbors = [
          [cx+1, cy], [cx-1, cy],
          [cx, cy+1], [cx, cy-1]
        ];

        for (const [nx, ny] of neighbors) {
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;

          const ni = getIdx(nx, ny);
          if (visited[ni]) continue;

          const ni4 = ni * 4;
          const nr = data[ni4], ng = data[ni4+1], nb = data[ni4+2];

          if (!isToothCandidate(nr, ng, nb)) continue;

          visited[ni] = 1;
          queue.push(ni);
        }
      }

      // 🔥 FILTER NOISE (Process only valid tooth clusters > 120px)
      if (cluster.length > 120) {
        clusters.push(cluster);
      }
    }
  }

  return clusters;
}

/**
 * PRODUCTION-SAFE WHITENING PIPELINE (RE-ENGINEERED)
 * Moves from pixel-heuristics to Cluster-Based Enamel Segmentation.
 */
export function applyWhitening(ctx, landmarks, w, h) {
  if (!landmarks || landmarks.length === 0) return;

  // 🛡️ 1. Create Regional Capture
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

  const pad = 30; // Slightly larger pad for clustering context
  minX = Math.max(0, Math.floor(minX - pad));
  minY = Math.max(0, Math.floor(minY - pad));
  maxX = Math.min(w, Math.ceil(maxX + pad));
  maxY = Math.min(h, Math.ceil(maxY + pad));

  const boxW = maxX - minX;
  const boxH = maxY - minY;
  if (boxW <= 0 || boxH <= 0) return;

  const whiteningData = ctx.getImageData(minX, minY, boxW, boxH);
  const whit = whiteningData.data;

  // 🚀 STEP 2 — APPLY WHITENING ON CLUSTERS
  const clusters = segmentEnamel(whit, boxW, boxH);

  clusters.forEach(cluster => {
    cluster.forEach(idx => {
      const i = idx * 4;

      let r = whit[i], g = whit[i+1], b = whit[i+2];

      // skip deep gaps
      const lum = (r + g + b) / 3;
      if (lum < 35) return;

      // 🦷 EDGE PROTECTION
      const edgeBoost = Math.abs(r - g) + Math.abs(g - b);
      if (edgeBoost > 60) return;

      const warm = (r + g) / 2 - b;
      let nr = r, ng = g, nb = b;

      // 🔥 PLAQUE REMOVAL
      if (warm > 6) {
        nr *= 0.88; ng *= 0.93; 
        const avg = (nr + ng + nb) / 3;
        nr = nr * 0.90 + avg * 0.10;
        ng = ng * 0.90 + avg * 0.10;
        nb = nb * 0.90 + avg * 0.10;
      }

      // ✨ WHITENING LIFT
      const wr = nr * 1.035;
      const wg = ng * 1.05;
      const wb = nb * 1.045; 

      const blend = 0.58; 
      
      whit[i]     = r * (1 - blend) + wr * blend;
      whit[i + 1] = g * (1 - blend) + wg * blend;
      whit[i + 2] = b * (1 - blend) + wb * blend;
    });
  });

  ctx.putImageData(whiteningData, minX, minY);
}
