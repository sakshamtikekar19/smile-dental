// 🦷 ULTIMATE, PRODUCTION-READY WHITENING ENGINE (FIXED)
// Features industrial safety nets and absolute width calculation to prevent array skewing.

const UPPER_INNER_LIP = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308];
const LOWER_INNER_LIP = [308, 324, 318, 402, 317, 14, 87, 178, 88, 95, 78];

// Mathematical fence to prevent lip bleed (Ray-Casting)
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

export function applyUltraRealisticWhitening(ctx, landmarks, iw, ih, intensity = 0.8) {
  // 🛡️ SAFETY NET: Ensure FaceMesh actually found a face
  if (!landmarks || landmarks.length === 0) return;

  try {
      // 1. Map the exact inner lip polygon
      const mouthPolygon = [...UPPER_INNER_LIP, ...LOWER_INNER_LIP].map(idx => ({
          x: landmarks[idx].x <= 1 ? landmarks[idx].x * iw : landmarks[idx].x,
          y: landmarks[idx].y <= 1 ? landmarks[idx].y * ih : landmarks[idx].y
      }));

      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      mouthPolygon.forEach(pt => {
          if (pt.x < minX) minX = pt.x;
          if (pt.x > maxX) maxX = pt.x;
          if (pt.y < minY) minY = pt.y;
          if (pt.y > maxY) maxY = pt.y;
      });

      // ADD PADDING: Reach the extreme left and right teeth safely
      minX = Math.max(0, Math.floor(minX - 10));
      minY = Math.max(0, Math.floor(minY - 10));
      maxX = Math.min(iw, Math.ceil(maxX + 10));
      maxY = Math.min(ih, Math.ceil(maxY + 10));

      const reqBoxW = maxX - minX;
      const reqBoxH = maxY - minY;
      
      // Prevent Canvas API crash if mouth box is invalid
      if (reqBoxW <= 0 || reqBoxH <= 0 || minX >= iw || minY >= ih) return;

      // Extract raw image data
      let imgData = ctx.getImageData(minX, minY, reqBoxW, reqBoxH);
      let data = imgData.data;
      
      // 🔥 THE FIX: Get the absolute physical width of the array returned by the browser
      const actualWidth = imgData.width;

      // 2. 🧪 TRIPLE-GATE PIXEL LOOP
      for (let i = 0; i < data.length; i += 4) {
          // 🔥 THE FIX: Use actualWidth to prevent diagonal array skewing!
          const pixelIndex = i / 4;
          const px = minX + (pixelIndex % actualWidth);
          const py = minY + Math.floor(pixelIndex / actualWidth);

          // GATE 0: Geometric Fence (Skip if outside lips)
          if (!isPixelInsidePolygon(px, py, mouthPolygon)) continue;

          let r = data[i];
          let g = data[i + 1];
          let b = data[i + 2];
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;

          // GATE 1: Deep Shadow Protection
          if (lum < 25) continue;

          // GATE 2: Flesh Protector (Backup check for gums/tongue)
          if (r > g * 1.15 && r > b * 1.25) continue;

          // PLAQUE DETECTOR
          const isPlaque = (r > 90 && g > 90 && b < g - 15);

          // SOFT SHADOW LOGIC
          let processIntensity = intensity;
          if (lum < 60 && !isPlaque) {
              processIntensity = intensity * ((lum - 25) / 35); 
          }

          // --- BLEACHING & NORMALIZATION ---

          // 1. Plaque Killer
          let newB = b;
          if (isPlaque) {
              newB = b + (g - b) * processIntensity * 1.3; 
          }

          // 2. Color Unification
          let cleanR = r + (lum - r) * processIntensity * 0.8;
          let cleanG = g + (lum - g) * processIntensity * 0.8;
          let cleanB = newB + (lum - newB) * processIntensity * 0.8;

          // Natural Ivory Warmth
          cleanR += 10 * processIntensity;
          cleanG += 8 * processIntensity;
          cleanB += 5 * processIntensity;

          // 3. Inverse Luminance Lift (Anti-Glow)
          const inverseLift = (255 - lum) / 255; 
          const brightnessCap = 1.0 + (processIntensity * 0.25 * inverseLift);

          data[i] = Math.min(255, cleanR * brightnessCap);
          data[i + 1] = Math.min(255, cleanG * brightnessCap);
          data[i + 2] = Math.min(255, cleanB * brightnessCap);
      }

      // 3. Stamp it perfectly back into place
      ctx.putImageData(imgData, minX, minY);

  } catch (error) {
      console.warn("Whitening engine safely skipped a dropped frame.");
  }
}

// ── Compatibility Aliases ───────────────────────────────────────────────────
export const applyWhitening = applyUltraRealisticWhitening;
export const applyProfessionalWhitening = applyUltraRealisticWhitening;
