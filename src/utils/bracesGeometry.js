/**
 * Geometry-first braces: inner lip landmark pairs → teeth band → Catmull smooth → arc-length resample → tangents + perspective.
 * No raster placement; optional z from landmarks for depth scaling.
 */

const UPPER_INNER_ARCH = [312, 311, 310, 415, 308, 324, 318, 402, 317, 13];
const LOWER_INNER_ARCH = [14, 87, 178, 88, 95, 78, 191, 80, 81, 82];

const LERP_TO_TOOTH = 0.68;
const CATMULL_STEPS_PER_SEGMENT = 22;
const BRACKET_COUNT_UPPER = 11;
const BRACKET_COUNT_LOWER = 11;
const ARCH_EXTEND_ZERO = true;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function getTeethCenterline(landmarks, iw, ih) {
  return {
    upperCtrl: getTeethArchControlPoints(landmarks, iw, ih, true),
    lowerCtrl: getTeethArchControlPoints(landmarks, iw, ih, false),
  };
}

export function landmarkToPx(landmarks, idx, iw, ih) {
  const p = landmarks[idx];
  if (!p || typeof p.x !== "number" || typeof p.y !== "number") return null;
  return {
    x: p.x * iw,
    y: p.y * ih,
    z: typeof p.z === "number" ? p.z : 0,
  };
}

/** Midpoint pairs along arch, sorted L→R; bias toward upper or lower tooth surface. */
export function getTeethArchControlPoints(landmarks, iw, ih, isUpper) {
  const out = [];
  for (let i = 0; i < UPPER_INNER_ARCH.length; i++) {
    const u = landmarkToPx(landmarks, UPPER_INNER_ARCH[i], iw, ih);
    const l = landmarkToPx(landmarks, LOWER_INNER_ARCH[i], iw, ih);
    if (!u || !l) continue;
    const mid = {
      x: (u.x + l.x) * 0.5,
      y: (u.y + l.y) * 0.5,
      z: (u.z + l.z) * 0.5,
    };
    const a = isUpper ? u : l;
    const p = {
      x: mid.x * (1 - LERP_TO_TOOTH) + a.x * LERP_TO_TOOTH,
      y: mid.y * (1 - LERP_TO_TOOTH) + a.y * LERP_TO_TOOTH,
      z: mid.z * (1 - LERP_TO_TOOTH) + a.z * LERP_TO_TOOTH,
    };
    out.push(p);
  }
  out.sort((x, y) => x.x - y.x);
  return out;
}

function catmullRom2D(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x:
      0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y:
      0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
    z: (p1.z ?? 0) + t * ((p2.z ?? 0) - (p1.z ?? 0)),
  };
}

function expandCatmullEnds(pts) {
  if (pts.length < 2) return pts.map((p) => ({ ...p }));
  const n = pts.length;
  const body = pts.map((p) => ({ ...p }));
  if (ARCH_EXTEND_ZERO) {
    return [{ ...pts[0] }, ...body, { ...pts[n - 1] }];
  }
  return [
    { x: 2 * pts[0].x - pts[1].x, y: 2 * pts[0].y - pts[1].y, z: pts[0].z ?? 0 },
    ...body,
    { x: 2 * pts[n - 1].x - pts[n - 2].x, y: 2 * pts[n - 1].y - pts[n - 2].y, z: pts[n - 1].z ?? 0 },
  ];
}

/** Dense open Catmull–Rom chain. */
export function smoothOpenCatmull(pts, stepsPerSeg) {
  if (pts.length === 0) return [];
  if (pts.length === 1) return [{ ...pts[0] }];
  const steps = Math.max(8, stepsPerSeg | 0);
  const chain = expandCatmullEnds(pts);
  const out = [];
  const segCount = chain.length - 3;
  for (let i = 0; i < segCount; i++) {
    const c0 = chain[i];
    const c1 = chain[i + 1];
    const c2 = chain[i + 2];
    const c3 = chain[i + 3];
    const t0 = i > 0 ? 1 : 0;
    for (let s = t0; s <= steps; s++) {
      out.push(catmullRom2D(c0, c1, c2, c3, s / steps));
    }
  }
  return out;
}

/** Even spacing along polyline by arc length. */
export function resampleCurveEqualArcLength(pts, nOut) {
  if (!pts.length || nOut < 2) return pts.length ? [pts[0], pts[pts.length - 1]] : [];
  if (pts.length === 1) return Array(nOut).fill(null).map(() => ({ ...pts[0] }));
  const segLen = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    segLen.push(d);
    total += d;
  }
  if (total < 1e-6) return pts.slice(0, Math.min(nOut, pts.length));
  const out = [];
  for (let k = 0; k < nOut; k++) {
    const target = (k / (nOut - 1)) * total;
    let acc = 0;
    let placed = false;
    for (let i = 0; i < segLen.length; i++) {
      const L = segLen[i];
      if (acc + L >= target - 1e-9) {
        const u = L < 1e-9 ? 0 : (target - acc) / L;
        const uu = clamp(u, 0, 1);
        const a = pts[i];
        const b = pts[i + 1];
        out.push({
          x: a.x + uu * (b.x - a.x),
          y: a.y + uu * (b.y - a.y),
          z: (a.z ?? 0) + uu * ((b.z ?? 0) - (a.z ?? 0)),
        });
        placed = true;
        break;
      }
      acc += L;
    }
    if (!placed) out.push({ ...pts[pts.length - 1] });
  }
  return out;
}

function tangentAngleAt(row, i) {
  const n = row.length;
  if (n < 2) return 0;
  if (i === 0) return Math.atan2(row[1].y - row[0].y, row[1].x - row[0].x);
  if (i === n - 1) return Math.atan2(row[n - 1].y - row[n - 2].y, row[n - 1].x - row[n - 2].x);
  return Math.atan2(row[i + 1].y - row[i - 1].y, row[i + 1].x - row[i - 1].x);
}

/** Per-bracket tangent rotation + lateral perspective + index perspective (center larger) + optional Z depth. */
export function computeBracketTransforms(row, iw, ih, oval) {
  const n = row.length;
  const centerIndex = (n - 1) / 2;
  const ocx = oval?.cx != null ? oval.cx : row[Math.floor(n / 2)]?.x ?? iw * 0.5;
  const orx = Math.max(oval?.rx ?? iw * 0.18, 1);
  return row.map((p, i) => {
    const ang = tangentAngleAt(row, i);
    const edge = clamp(Math.abs((p.x - ocx) / orx), 0, 1);
    const perspective = 0.56 + 0.44 * (1 - edge);
    const scaleIdx = Math.max(0.5, 1 - Math.abs(i - centerIndex) * 0.05);
    const zScale = clamp(1 + (p.z ?? 0) * 0.14, 0.93, 1.1);
    const wMult = Math.max(0.82, perspective * scaleIdx * zScale);
    const hMult = wMult * (0.68 + 0.32 * (1 - edge));
    return {
      x: clamp(p.x, 4, iw - 5),
      y: clamp(p.y, 4, ih - 5),
      ang,
      wMult,
      hMult,
      star: false,
      skipStud: false,
    };
  });
}

export function sampleWireFromStuds(studs, stepsPerSeg) {
  if (!studs || studs.length < 2) return studs?.map((p) => ({ x: p.x, y: p.y })) ?? [];
  return smoothOpenCatmull(studs, stepsPerSeg).map(({ x, y }) => ({ x, y }));
}

/**
 * Full pack for canvas render: anchors from geometry only.
 */
export function buildGeometricBracesPack(landmarks, iw, ih, oval) {
  if (!landmarks?.length) return null;

  const upperCtrl = getTeethArchControlPoints(landmarks, iw, ih, true);
  const lowerCtrl = getTeethArchControlPoints(landmarks, iw, ih, false);
  if (upperCtrl.length < 2 || lowerCtrl.length < 2) return null;

  const uDense = smoothOpenCatmull(upperCtrl, 16);
  const lDense = smoothOpenCatmull(lowerCtrl, 16);

  const uStuds = resampleCurveEqualArcLength(uDense, BRACKET_COUNT_UPPER);
  const lStuds = resampleCurveEqualArcLength(lDense, BRACKET_COUNT_LOWER);

  const upperAnchors = computeBracketTransforms(uStuds, iw, ih, oval);
  const lowerAnchors = computeBracketTransforms(lStuds, iw, ih, oval);

  const wireSamplesUpper = sampleWireFromStuds(uStuds, CATMULL_STEPS_PER_SEGMENT);
  const wireSamplesLower = sampleWireFromStuds(lStuds, CATMULL_STEPS_PER_SEGMENT);

  return {
    wireMode: "catmull",
    upperAnchors,
    lowerAnchors,
    wireSamplesUpper,
    wireSamplesLower,
  };
}

export { smoothOpenCatmull as smoothCurve, resampleCurveEqualArcLength as resampleCurve };
