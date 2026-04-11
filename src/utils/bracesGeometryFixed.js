/**
 * Fixed braces geometry: robust dual-arch placement using MediaPipe landmarks.
 */

const INNER_LIP_UPPER = 13;
const INNER_LIP_LOWER = 14;
const INNER_LIP_LEFT  = 78;
const INNER_LIP_RIGHT = 308;

// Upper arch tooth-face landmarks (left→right)
const UPPER_ARCH_IDX = [308, 415, 310, 311, 312, 13, 82, 81, 80, 191, 78];
// Lower arch tooth-face landmarks (left→right)  
const LOWER_ARCH_IDX = [324, 318, 402, 317, 14, 87, 178, 88, 95];

// Bracket size relative to image width
export const BRACKET_SIDE_PX = 7.5; 

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function lm(landmarks, idx, iw, ih) {
  const p = landmarks?.[idx];
  if (!p || typeof p.x !== 'number') return null;
  return { x: p.x * iw, y: p.y * ih, z: p.z ?? 0 };
}

/**
 * Mandate 3: Clean Parabolic Geometry
 * Calculates y = a(x - h)^2 + k passing through left corner, right corner, and dipping to lower center.
 */
function getParabolicY(x, left, right, apex) {
  const midX = (left.x + right.x) / 2;
  const width = Math.max(right.x - left.x, 1);
  // Apex is at (midX, apex.y)
  const a = (left.y - apex.y) / Math.pow(left.x - midX, 2);
  return a * Math.pow(x - midX, 2) + apex.y;
}

/**
 * Build a parabolic path for the wire samples.
 */
function calculateParabolicPath(studs, isUpper, mouthOpen, steps = 18) {
  if (!studs || studs.length < 2) return [];
  const xMin = studs[0].x;
  const xMax = studs[studs.length - 1].x;
  const width = Math.max(xMax - xMin, 1);
  const midX = (xMin + xMax) / 2;
  const yEnds = (studs[0].y + studs[studs.length - 1].y) / 2;
  
  // Force distinct curvature
  const minSag = Math.max(12, width * 0.12);
  const sagPlex = Math.min(width * 0.08 + mouthOpen * 0.12, 60);
  const k = isUpper ? yEnds - Math.max(minSag, sagPlex) : yEnds + Math.max(minSag, sagPlex);
  const a = (yEnds - k) / Math.pow(width / 2, 2);
  
  const path = [];
  const padding = 15;
  for (let i = 0; i <= steps; i++) {
    const x = (xMin - padding) + (i / steps) * (width + padding * 2);
    const y = a * Math.pow(x - midX, 2) + k;
    path.push({ x, y });
  }
  return path;
}

/**
 * Build bracket anchor row using Parabolic Fallback (Mandate 3).
 */
function buildArchAnchors(landmarks, iw, ih, indices, lipMidY, isUpper, mouthOpen) {
  const leftCorner  = lm(landmarks, INNER_LIP_LEFT, iw, ih);
  const rightCorner = lm(landmarks, INNER_LIP_RIGHT, iw, ih);
  const lowerCenter = lm(landmarks, INNER_LIP_LOWER, iw, ih);
  const upperCenter = lm(landmarks, INNER_LIP_UPPER, iw, ih);

  if (!leftCorner || !rightCorner || !lowerCenter || !upperCenter) return null;

  const raw = indices.map(idx => lm(landmarks, idx, iw, ih)).filter(Boolean);
  if (raw.length < 2) return null;
  raw.sort((a, b) => a.x - b.x);

  const xMin = raw[0].x;
  const xMax = raw[raw.length - 1].x;
  const count = raw.length;

  // Apex for the parabolic spacing
  const apex = isUpper ? upperCenter : lowerCenter;

  const anchors = [];
  for (let i = 0; i < count; i++) {
    // Mandate 3: Space brackets evenly along the parabolic curve
    const x = xMin + (i / Math.max(count - 1, 1)) * (xMax - xMin);
    const y = getParabolicY(x, leftCorner, rightCorner, apex);
    
    // Tangent for rotation
    const xNext = x + 1;
    const yNext = getParabolicY(xNext, leftCorner, rightCorner, apex);
    const ang = Math.atan2(yNext - y, xNext - x);

    // Perspective
    const midX = (xMin + xMax) / 2;
    const halfW = (xMax - xMin) / 2;
    const edgeFrac = Math.abs(x - midX) / Math.max(halfW, 1);
    const perspective = clamp(1 - edgeFrac * 0.22, 0.7, 1.0);

    anchors.push({
      x: clamp(x, 4, iw - 4),
      y: clamp(y, 4, ih - 4),
      ang,
      wMult: perspective,
      hMult: perspective * 0.88,
      depthOpacity: clamp(1 - edgeFrac * 0.2, 0.7, 1.0),
      scaleZ: perspective,
    });
  }

  // Mandate 2: Explicitly sort anchors by X
  anchors.sort((a, b) => a.x - b.x);
  return anchors;
}


/**
 * Main entry point: build complete braces pack from landmarks.
 */
export function buildBracesPack(landmarks, iw, ih, oval) {
  if (!landmarks?.length) return null;

  const lipU = lm(landmarks, INNER_LIP_UPPER, iw, ih);
  const lipL = lm(landmarks, INNER_LIP_LOWER, iw, ih);
  if (!lipU || !lipL) return null;

  const mouthOpen = Math.abs(lipL.y - lipU.y);
  // Threshold of 5 was too strict for small (384px) images — use 2
  if (mouthOpen < 2) return null;

  const lipMidY = (lipU.y + lipL.y) / 2;

  // Build upper arch
  const upperAnchors = buildArchAnchors(landmarks, iw, ih, UPPER_ARCH_IDX, lipMidY, true, mouthOpen);
  if (!upperAnchors || upperAnchors.length < 2) return null;

  const upperStuds = upperAnchors.map(a => ({ x: a.x, y: a.y }));

  // Build lower arch
  const lowerAnchors = buildArchAnchors(landmarks, iw, ih, LOWER_ARCH_IDX, lipMidY, false, mouthOpen);
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
