/**
 * ALIGNMENT ENGINE: THE SOLID-STATE MATRIX (V19)
 * Solves Laptop Pink Bleed (Nearest Neighbor) & Mobile Tearing (Integer Matrix).
 */

const INNER_LIP_INDICES = [
  78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, // Upper inner
  324, 318, 402, 317, 14, 87, 178, 88, 95          // Lower inner
];

// 🧠 The Mathematical Fence (Ray-Casting Algorithm)
function isPixelInsidePolygon(px, py, polygon) {
    let isInside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        let xi = polygon[i].x, yi = polygon[i].y;
        let xj = polygon[j].x, yj = polygon[j].y;
        let intersect = ((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
        if (intersect) isInside = !isInside;
    }
    return isInside;
}

export function applyProfessionalAlignment(ctx, landmarks, w, h) {
  console.log("✅ ALIGNMENT V19 (SOLID-STATE MATRIX) START");
  
  if (!landmarks || landmarks.length === 0) return;

  const imageData = ctx.getImageData(0, 0, w, h);
  const src = new Uint8ClampedArray(imageData.data); 
  const dst = imageData.data;
  
  // 🔥 Force absolute array synchronization for multi-device stability
  const actualW = imageData.width;
  const actualH = imageData.height;

  const mouthPolygon = [];
  INNER_LIP_INDICES.forEach((idx) => {
    mouthPolygon.push({
      x: landmarks[idx].x * actualW,
      y: landmarks[idx].y * actualH
    });
  });

  const mouthIndices = [61, 291, 78, 13, 14, 308];
  let minX = actualW, minY = actualH, maxX = 0, maxY = 0;
  mouthIndices.forEach(i => {
    const px = landmarks[i].x * actualW, py = landmarks[i].y * actualH;
    minX = Math.min(minX, px); minY = Math.min(minY, py);
    maxX = Math.max(maxX, px); maxY = Math.max(maxY, py);
  });

  // Tighter padding for focused orthodontic pass
  const padX = (maxX - minX) * 0.15, padY = (maxY - minY) * 0.20;
  minX = Math.max(0, Math.floor(minX - padX)); 
  maxX = Math.min(actualW, Math.ceil(maxX + padX));
  minY = Math.max(0, Math.floor(minY - padY)); 
  maxY = Math.min(actualH, Math.ceil(maxY + padY));

  const centerX = (minX + maxX) / 2;
  const archMidY = (minY + maxY) / 2;
  const roiW = maxX - minX;
  const roiH = maxY - minY;

  // 🧪 V19 LOOP: Solid-State Nearest Neighbor (No-Bleed Architecture)
  for (let y = minY; y < maxY; y++) {
    for (let x = minX; x < maxX; x++) {
      
      // 🛑 GATE 0: Geometric Fence
      if (!isPixelInsidePolygon(x, y, mouthPolygon)) continue;

      const i = (y * actualW + x) * 4;

      // 🔥 GATE 1: Destination Flesh Protector (R > G/B 1.12x)
      if (src[i] > src[i+1]*1.12 && src[i] > src[i+2]*1.12) continue;

      const nx = (x - centerX) / (roiW / 2);
      const ny = (y - archMidY) / (roiH / 2);
      
      // Radial Mask Calculation
      const dist = Math.sqrt(nx * nx + ny * ny);
      if (dist > 1.0) continue; 

      // 🔥 FIX 1: Cosine Falloff (Smooth, clinical physics)
      const falloff = Math.cos(dist * Math.PI / 2);

      // Physics Vectors
      let dx = nx * roiW * 0.04 * falloff; 
      let dy = Math.abs(nx) * roiH * 0.05 * falloff; 

      // 🔥 FIX 2: NEAREST NEIGHBOR ROUNDING (Kills Mobile Tearing & Pink Bleed)
      // Strict Integer Mapping: No color blending allowed.
      let sx = Math.round(x + dx);
      let sy = Math.round(y + dy);

      // Safe Array Bounding
      sx = Math.max(0, Math.min(actualW - 1, sx));
      sy = Math.max(0, Math.min(actualH - 1, sy));

      // 🛑 GATE 2: Geometric Source Denial
      if (!isPixelInsidePolygon(sx, sy, mouthPolygon)) continue;

      const si = (sy * actualW + sx) * 4;

      // 🔥 GATE 3: Source Flesh Protector
      if (src[si] > src[si+1]*1.12 && src[si] > src[si+2]*1.12) continue;

      // 🔥 SOLID PIXEL COPY: 100% Solid-State Transmission
      dst[i] = src[si];
      dst[i+1] = src[si+1];
      dst[i+2] = src[si+2];
      dst[i+3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  console.log("✅ ALIGNMENT V19 (SOLID-STATE) APPLIED");
}

export const applyAlignment = applyProfessionalAlignment;
