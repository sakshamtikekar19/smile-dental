/**
 * Fixed braces geometry: robust dual-arch placement using MediaPipe landmarks.
 */

const INNER_LIP_UPPER = 13;
const INNER_LIP_LOWER = 14;

// Upper arch tooth-face landmarks (left→right)
const UPPER_ARCH_IDX = [308, 415, 310, 311, 312, 13, 82, 81, 80, 191, 78];
// Lower arch tooth-face landmarks (left→right)  
const LOWER_ARCH_IDX = [324, 318, 402, 317, 14, 87, 178, 88, 95];

export const BRACKET_SIDE_PX = 7.5;

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function lm(landmarks, idx, iw, ih) {
  const p = landmarks?.[idx];
  if (!p || typeof p.x !== 'number') return null;
  return { x: p.x * iw, y: p.y * ih, z: p.z ?? 0 };
}

/**
 * Build a parabolic path y = a(x - h)^2 + k passing through the midpoint apex 
 * and endpoints defined by the bracket row.
 */
function calculateParabolicPath(studs, isUpper, mouthOpen, steps = 12) {
  if (!studs || studs.length < 2) return [];
  
  const xMin = studs[0].x;
  const xMax = studs[studs.length - 1].x;
  const width = Math.max(xMax - xMin, 1);
  const midX = (xMin + xMax) / 2;
  
  // Apex 'k' is the peak of the curve. Endpoints are at 'y_ends'.
  // a = (y_ends - k) / (width/2)^2
  const yEnds = (studs[0].y + studs[studs.length - 1].y) / 2;
  
  // Mandate 2: Force distinct smile curvature even on flat landmarks
  const minSag = Math.max(12, width * 0.12);
  const sagPlex = Math.min(width * 0.08 + mouthOpen * 0.12, 60);
  const k = isUpper ? yEnds - Math.max(minSag, sagPlex) : yEnds + Math.max(minSag, sagPlex);
  
  const a = (yEnds - k) / Math.pow(width / 2, 2);
  
  const path = [];
  // Extend slightly beyond endpoints to wrap behind molars
  const padding = 12;
  let _paraSafe = 0;
  for (let i = 0; i <= steps; i++) {
    if (++_paraSafe > 1000) break;
    const x = (xMin - padding) + (i / steps) * (width + padding * 2);
    const y = a * Math.pow(x - midX, 2) + k;
    path.push({ x, y });
  }
  return path;
}

/**
 * Mandate 3: Enamel-Centroid Snap
 * Refines a landmark-based (x, y) by finding the local center of mass of enamel.
 */
function findEnamelCentroid(startX, startY, pixelData, iw, ih, radius = 18) {
  let sumX = 0, sumY = 0, count = 0;
  const x0 = clamp(Math.floor(startX - radius), 0, iw - 1);
  const x1 = clamp(Math.ceil(startX + radius), 0, iw - 1);
  const y0 = clamp(Math.floor(startY - radius), 0, ih - 1);
  const y1 = clamp(Math.ceil(startY + radius), 0, ih - 1);

  // Safe-Mode: scan every 3rd pixel if radius is large to reduce iterations by 9x
  const step = radius > 14 ? 3 : (radius > 10 ? 2 : 1);

  let _centroidSafe = 0;
  for (let y = y0; y <= y1; y += step) {
    for (let x = x0; x <= x1; x += step) {
      if (++_centroidSafe > 10000) break;
      const idx = (Math.floor(y) * iw + Math.floor(x)) * 4;
      const r = pixelData[idx], g = pixelData[idx+1], b = pixelData[idx+2];
      
      // Enamel detection: Light, low-saturation pixels
      const lum = 0.2126*r + 0.7152*g + 0.0722*b;
      const maxC = Math.max(r, g, b), minC = Math.min(r, g, b);
      const sat = maxC === 0 ? 0 : (maxC - minC) / maxC;

      // We look for "tooth-colored" pixels
      if (lum > 140 && sat < 0.28) {
        sumX += x;
        sumY += y;
        count++;
      }
    }
  }

  if (count < 10) return { x: startX, y: startY }; // Fallback
  const res = { x: sumX / count, y: sumY / count };
  // Help GC
  sumX = null; sumY = null;
  return res;
}

/**
 * Build bracket anchor row from landmark indices.
 * Returns sorted-by-x array of { x, y, ang, wMult, hMult, depthOpacity, scaleZ }
 */
function buildArchAnchors(landmarks, iw, ih, indices, lipMidY, isUpper, mouthOpen, pixelData) {
  const raw = indices
    .map(idx => lm(landmarks, idx, iw, ih))
    .filter(p => p !== null);

  if (raw.length < 3) return null;

  // Sort by x (left to right)
  raw.sort((a, b) => a.x - b.x);

  // Separate upper/lower strictly by lip midline
  const archPts = isUpper
    ? raw.filter(p => p.y <= lipMidY + 4)
    : raw.filter(p => p.y >= lipMidY - 4);

  if (archPts.length < 3) return null;

  // Mandate 3: Refine each bracket position to the physical enamel centroid
  const refined = archPts.map(p => {
    if (pixelData) {
      const c = findEnamelCentroid(p.x, p.y, pixelData, iw, ih);
      return { x: c.x, y: c.y, z: p.z };
    }
    return p;
  });

  return buildAnchorsFromRow(refined, iw, ih, isUpper, mouthOpen);
}

function buildAnchorsFromRow(row, iw, ih, isUpper, mouthOpen) {
  if (!row || row.length < 2) return null;
  const n = row.length;
  const cx = (row[0].x + row[n-1].x) / 2;
  const halfW = Math.max((row[n-1].x - row[0].x) / 2, 1);

  return row.map((p, i) => {
    // Tangent angle for dental alignment
    const prev = row[Math.max(0, i-1)];
    const next = row[Math.min(n-1, i+1)];
    const ang = Math.atan2(next.y - prev.y, next.x - prev.x);

    // Perspective: brackets near center are slightly larger
    const edgeFrac = Math.abs(p.x - cx) / halfW;
    const perspective = clamp(1 - edgeFrac * 0.25, 0.65, 1.0);

    return {
      x: clamp(p.x, 4, iw - 4),
      y: clamp(p.y, 4, ih - 4),
      ang,
      wMult: perspective,
      hMult: perspective * 0.88,
      depthOpacity: clamp(1 - edgeFrac * 0.2, 0.7, 1.0),
      scaleZ: perspective,
    };
  });
}

/**
 * Main entry point: build complete braces pack from landmarks.
 */
export function buildBracesPack(landmarks, iw, ih, oval, pixelData = null) {
  if (!landmarks?.length) return null;

  const lipU = lm(landmarks, INNER_LIP_UPPER, iw, ih);
  const lipL = lm(landmarks, INNER_LIP_LOWER, iw, ih);
  if (!lipU || !lipL) return null;

  const mouthOpen = Math.abs(lipL.y - lipU.y);
  if (mouthOpen < 5) return null;

  const lipMidY = (lipU.y + lipL.y) / 2;

  // Build upper arch
  const upperAnchors = buildArchAnchors(landmarks, iw, ih, UPPER_ARCH_IDX, lipMidY, true, mouthOpen, pixelData);
  if (!upperAnchors || upperAnchors.length < 2) return null;

  const upperStuds = upperAnchors.map(a => ({ x: a.x, y: a.y }));

  // Build lower arch
  const lowerAnchors = buildArchAnchors(landmarks, iw, ih, LOWER_ARCH_IDX, lipMidY, false, mouthOpen, pixelData);
  const lowerStuds = lowerAnchors ? lowerAnchors.map(a => ({ x: a.x, y: a.y })) : [];

  // Mandate 2: Build true mathematical parabolic wires
  const wireSamplesUpper = calculateParabolicPath(upperStuds, true, mouthOpen);
  const wireSamplesLower = lowerStuds.length >= 2
    ? calculateParabolicPath(lowerStuds, false, mouthOpen)
    : [];

  const res = {
    upperAnchors,
    lowerAnchors: lowerAnchors ?? [],
    upperStuds,
    lowerStuds,
    wireSamplesUpper,
    wireSamplesLower,
    mouthOpen,
    baseW: BRACKET_SIDE_PX,
    baseH: BRACKET_SIDE_PX,
  };

  // Explicitly clear references to the heavy pixel buffer
  pixelData = null; 
  return res;
}

export { lm as landmarkToPx };
