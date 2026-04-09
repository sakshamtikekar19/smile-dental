/**
 * Fixed braces geometry: robust dual-arch placement using MediaPipe landmarks.
 * Key fixes:
 * - Direct landmark-to-bracket mapping without fragile centroid/histogram fallbacks
 * - Stable Catmull-Rom wire that never crosses arches
 * - Clean perspective scaling without z-fighting
 * - Reliable enamel clip that doesn't cut off distal brackets
 */

const COMMISSURE_L = 61;
const COMMISSURE_R = 291;
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

/** Catmull-Rom spline through control points */
function catmullRom(pts, stepsPerSeg = 20) {
  if (!pts || pts.length < 2) return pts ?? [];
  if (pts.length === 2) {
    const out = [];
    for (let i = 0; i <= stepsPerSeg; i++) {
      const t = i / stepsPerSeg;
      out.push({ x: pts[0].x + t * (pts[1].x - pts[0].x), y: pts[0].y + t * (pts[1].y - pts[0].y) });
    }
    return out;
  }
  // Ghost endpoints
  const chain = [
    { x: 2 * pts[0].x - pts[1].x, y: 2 * pts[0].y - pts[1].y },
    ...pts,
    { x: 2 * pts[pts.length - 1].x - pts[pts.length - 2].x, y: 2 * pts[pts.length - 1].y - pts[pts.length - 2].y }
  ];
  const out = [];
  for (let i = 1; i < chain.length - 2; i++) {
    const p0 = chain[i - 1], p1 = chain[i], p2 = chain[i + 1], p3 = chain[i + 2];
    for (let s = 0; s <= stepsPerSeg; s++) {
      const t = s / stepsPerSeg;
      const t2 = t * t, t3 = t2 * t;
      out.push({
        x: 0.5 * ((2*p1.x) + (-p0.x+p2.x)*t + (2*p0.x-5*p1.x+4*p2.x-p3.x)*t2 + (-p0.x+3*p1.x-3*p2.x+p3.x)*t3),
        y: 0.5 * ((2*p1.y) + (-p0.y+p2.y)*t + (2*p0.y-5*p1.y+4*p2.y-p3.y)*t2 + (-p0.y+3*p1.y-3*p2.y+p3.y)*t3),
      });
    }
  }
  return out;
}

/** Remove Y outliers from landmark sequence */
function denoiseY(pts, maxDev = 12) {
  if (pts.length < 3) return pts;
  const ys = pts.map(p => p.y).sort((a, b) => a - b);
  const med = ys[Math.floor(ys.length / 2)];
  return pts.filter(p => Math.abs(p.y - med) <= maxDev + med * 0.08);
}

/** Smooth Y with 3-pt moving average */
function smoothY(pts) {
  return pts.map((p, i) => {
    if (i === 0 || i === pts.length - 1) return { ...p };
    return { ...p, y: (pts[i-1].y + p.y + pts[i+1].y) / 3 };
  });
}

/**
 * Build bracket anchor row from landmark indices.
 * Returns sorted-by-x array of { x, y, ang, wMult, hMult, depthOpacity, scaleZ }
 */
function buildArchAnchors(landmarks, iw, ih, indices, lipMidY, isUpper, mouthOpen) {
  const raw = indices
    .map(idx => lm(landmarks, idx, iw, ih))
    .filter(p => p !== null);

  if (raw.length < 3) return null;

  // Sort by x (left to right)
  raw.sort((a, b) => a.x - b.x);

  // Remove x-duplicates (keep first)
  const deduped = raw.filter((p, i) => i === 0 || Math.abs(p.x - raw[i-1].x) > 3);
  if (deduped.length < 3) return null;

  // Separate upper/lower strictly by lip midline
  const archPts = isUpper
    ? deduped.filter(p => p.y <= lipMidY + mouthOpen * 0.1)
    : deduped.filter(p => p.y >= lipMidY - mouthOpen * 0.1);

  if (archPts.length < 3) {
    // Fallback: use all deduped, take closest half to lipMidY
    const sorted = [...deduped].sort((a, b) =>
      Math.abs(a.y - lipMidY) - Math.abs(b.y - lipMidY)
    );
    return buildAnchorsFromRow(sorted.slice(0, Math.ceil(sorted.length * 0.7)).sort((a,b)=>a.x-b.x), iw, ih, isUpper, mouthOpen);
  }

  const cleaned = smoothY(denoiseY(archPts));
  return buildAnchorsFromRow(cleaned, iw, ih, isUpper, mouthOpen);
}

function buildAnchorsFromRow(row, iw, ih, isUpper, mouthOpen) {
  if (!row || row.length < 2) return null;
  const n = row.length;
  const cx = (row[0].x + row[n-1].x) / 2;
  const halfW = Math.max((row[n-1].x - row[0].x) / 2, 1);

  return row.map((p, i) => {
    // Tangent angle
    const prev = row[Math.max(0, i-1)];
    const next = row[Math.min(n-1, i+1)];
    const ang = Math.atan2(next.y - prev.y, next.x - prev.x);

    // Perspective: brackets near center are larger
    const edgeFrac = Math.abs(p.x - cx) / halfW;
    const perspective = clamp(1 - edgeFrac * 0.28, 0.62, 1.0);

    // Z-depth opacity
    const depthOpacity = clamp(1 - edgeFrac * 0.22, 0.65, 1.0);

    return {
      x: clamp(p.x, 4, iw - 4),
      y: clamp(p.y, 4, ih - 4),
      ang,
      wMult: perspective,
      hMult: perspective * 0.85,
      depthOpacity,
      scaleZ: perspective,
    };
  });
}

/**
 * Build wire polyline: Catmull-Rom through arch studs + parabolic sag boost.
 * Wire is strictly clamped to its arch side of the lip midplane.
 */
function buildWire(studs, lipMidY, isUpper, mouthOpen, landmarks, iw, ih) {
  if (!studs || studs.length < 2) return [];

  const cl = lm(landmarks, COMMISSURE_L, iw, ih);
  const cr = lm(landmarks, COMMISSURE_R, iw, ih);

  // Extend wire to commissures
  const xMin = cl ? Math.min(cl.x, studs[0].x) : studs[0].x;
  const xMax = cr ? Math.max(cr.x, studs[studs.length-1].x) : studs[studs.length-1].x;

  // Add extended endpoints at commissure Y-level
  const firstY = studs[0].y;
  const lastY = studs[studs.length-1].y;
  const extPts = [
    { x: xMin - 2, y: firstY },
    ...studs,
    { x: xMax + 2, y: lastY }
  ];

  const wire = catmullRom(extPts, 18);

  // Add smile-curve sag
  const halfW = Math.max((xMax - xMin) / 2, 1);
  const midX = (xMin + xMax) / 2;
  const sagPx = clamp(halfW * 0.065 + mouthOpen * 0.08, 8, 40);

  const withSag = wire.map(p => {
    const u = (p.x - midX) / halfW;
    const sag = sagPx * (1 - clamp(u * u, 0, 1));
    return { x: p.x, y: p.y + (isUpper ? sag : -sag) };
  });

  // Clamp to arch side
  const gap = mouthOpen * 0.04;
  const yBound = isUpper ? lipMidY - gap : lipMidY + gap;
  return withSag.map(p => ({
    x: p.x,
    y: isUpper ? Math.min(p.y, yBound) : Math.max(p.y, yBound)
  }));
}

/**
 * Main entry point: build complete braces pack from landmarks.
 * @returns {{ upperAnchors, lowerAnchors, upperStuds, lowerStuds, wireSamplesUpper, wireSamplesLower, mouthOpen } | null}
 */
export function buildBracesPack(landmarks, iw, ih, oval) {
  if (!landmarks?.length) return null;

  const lipU = lm(landmarks, INNER_LIP_UPPER, iw, ih);
  const lipL = lm(landmarks, INNER_LIP_LOWER, iw, ih);
  if (!lipU || !lipL) return null;

  const mouthOpen = Math.abs(lipL.y - lipU.y);
  if (mouthOpen < 4) return null;

  const lipMidY = (lipU.y + lipL.y) / 2;

  // Build upper arch
  const upperAnchors = buildArchAnchors(landmarks, iw, ih, UPPER_ARCH_IDX, lipMidY, true, mouthOpen);
  if (!upperAnchors || upperAnchors.length < 2) return null;

  const upperStuds = upperAnchors.map(a => ({ x: a.x, y: a.y, z: 0 }));

  // Build lower arch
  const lowerAnchors = buildArchAnchors(landmarks, iw, ih, LOWER_ARCH_IDX, lipMidY, false, mouthOpen);
  const lowerStuds = lowerAnchors ? lowerAnchors.map(a => ({ x: a.x, y: a.y, z: 0 })) : [];

  // Build wires
  const wireSamplesUpper = buildWire(upperStuds, lipMidY, true, mouthOpen, landmarks, iw, ih);
  const wireSamplesLower = lowerStuds.length >= 2
    ? buildWire(lowerStuds, lipMidY, false, mouthOpen, landmarks, iw, ih)
    : [];

  return {
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
}

export { lm as landmarkToPx };
