// 🦷 CLUSTERED TOOTH SEGMENTATION ENGINE
// Features flood-fill morphological clustering and per-tooth normalization.

const SMILE_INDICES = [
  61, 291, 78, 95, 88, 178, 87, 14,
  317, 402, 318, 324, 308, 415, 310,
  311, 312
];

/**
 * 🦷 Clinical Enamel Signature
 * Defines what a "tooth pixel" looks like in RGB space.
 */
function isToothPixel(r, g, b) {
  const lum = (r + g + b) / 3;
  const yellow = (r + g) / 2 - b;

  return (
    lum > 60 &&
    r > 70 && g > 65 && b > 50 &&
    yellow < 35 // Avoid gums/lips
  );
}

/**
 * 🧗 Stack-Based Flood Fill
 * Groups connected enamel pixels into "Tooth Clusters".
 */
function segmentTeeth(imageData) {
  const w = imageData.width;
  const h = imageData.height;
  const data = imageData.data;

  const clusters = [];
  const visited = new Uint8Array(w * h);

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const idx = py * w + px;
      if (visited[idx]) continue;

      const i = idx * 4;
      if (!isToothPixel(data[i], data[i+1], data[i+2])) {
        visited[idx] = 1;
        continue;
      }

      // Start new cluster (Flood Fill)
      const cluster = [];
      const stack = [[px, py]];
      
      while (stack.length > 0) {
        const [cx, cy] = stack.pop();
        const cIdx = cy * w + cx;
        
        if (visited[cIdx]) continue;
        
        const ci = cIdx * 4;
        if (isToothPixel(data[ci], data[ci+1], data[ci+2])) {
          visited[cIdx] = 1;
          cluster.push(cIdx);

          // Add neighbors
          if (cx > 0) stack.push([cx - 1, cy]);
          if (cx < w - 1) stack.push([cx + 1, cy]);
          if (cy > 0) stack.push([cx, cy - 1]);
          if (cy < h - 1) stack.push([cx, cy + 1]);
        } else {
          visited[cIdx] = 1;
        }
      }

      // Filter noise (Increased sensitivity to 50px as requested)
      if (cluster.length > 50) {
        clusters.push(cluster);
      }
    }
  }

  return clusters;
}

/**
 * 🧪 Per-Tooth Clinical Bleaching
 * Normalizes each tooth based on its specific average tone.
 */
function whitenClusters(imageData, clusters) {
  const d = imageData.data;

  clusters.forEach(cluster => {
    // 1. Calculate average tone of this specific tooth
    let avgR = 0, avgG = 0, avgB = 0;
    cluster.forEach(idx => {
      const i = idx * 4;
      avgR += d[i];
      avgG += d[i+1];
      avgB += d[i+2];
    });

    avgR /= cluster.length;
    avgG /= cluster.length;
    avgB /= cluster.length;

    const yellowShift = (avgR + avgG) / 2 - avgB;

    // 2. Apply targeted whitening
    cluster.forEach(idx => {
      const i = idx * 4;
      let r = d[i], g = d[i+1], b = d[i + 2];

      // 🟡 Remove yellow (Targeted blue boost)
      if (yellowShift > 5) {
        b += yellowShift * 0.4;
        r *= 0.97;
      }

      // ✨ Controlled whitening
      r *= 1.06;
      g *= 1.07;
      b *= 1.06;

      // 🛑 Anti-shine clamp
      d[i]     = Math.min(r, 235);
      d[i + 1] = Math.min(g, 235);
      d[i + 2] = Math.min(b, 235);
    });
  });
}

/**
 * 🚀 Ultimate Clustered Segmentation Engine
 */
export function applyUltraRealisticWhitening(ctx, landmarks, w, h, intensity = 0.8) {
  if (!landmarks || landmarks.length === 0) return;

  try {
      // 1. 📍 REGION CALCULATION
      let minX = w, minY = h, maxX = 0, maxY = 0;
      SMILE_INDICES.forEach(idx => {
        const p = landmarks[idx];
        if (!p) return;
        const x = p.x * w;
        const y = p.y * h;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      });

      const pad = 25;
      minX = Math.max(0, Math.floor(minX - pad));
      minY = Math.max(0, Math.floor(minY - pad));
      maxX = Math.min(w, Math.ceil(maxX + pad));
      maxY = Math.min(h, Math.ceil(maxY + pad));

      const boxW = maxX - minX;
      const boxH = maxY - minY;
      
      if (boxW <= 0 || boxH <= 0 || minX >= w || minY >= h) return;

      // 2. 🧬 THE SEGMENTATION PIPELINE
      const imgData = ctx.getImageData(minX, minY, boxW, boxH);
      
      // Step A: Group enamel into morphological clusters (teeth)
      const clusters = segmentTeeth(imgData);
      
      // Step B: Whitening each cluster independently
      whitenClusters(imgData, clusters);

      // 3. Stamp it perfectly back into place
      ctx.putImageData(imgData, minX, minY);

  } catch (error) {
      console.warn("Whitening engine safely skipped a dropped frame.");
  }
}

// ── Compatibility Aliases ───────────────────────────────────────────────────
export const applyWhitening = applyUltraRealisticWhitening;
export const applyProfessionalWhitening = applyUltraRealisticWhitening;
