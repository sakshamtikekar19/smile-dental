/**
 * Teeth-locked braces: pure inner-lip pair midpoints (not raw lip anchors), outlier removal,
 * Catmull + parabolic U-fit, arc-length resample, shared midline with occlusal split for upper/lower.
 */

const UPPER_INNER_ARCH = [312, 311, 310, 415, 308, 324, 318, 402, 317, 13];
const LOWER_INNER_ARCH = [14, 87, 178, 88, 95, 78, 191, 80, 81, 82];

const INNER_LIP_UPPER_IDX = 13;
const INNER_LIP_LOWER_IDX = 14;

const CATMULL_STEPS_PER_SEGMENT = 24;
const CATMULL_CTRL_STEPS = 20;
const ARCH_EXTEND_ZERO = true;
const PARABOLA_BLEND = 0.42;
const DEFAULT_UPPER_COUNT = 12;
const DEFAULT_LOWER_COUNT = 12;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
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

/** True teeth centerline: only (upperInner[i] + lowerInner[i]) / 2 in pixel space, L→R by x. */
export function buildTeethMidlineControlPoints(landmarks, iw, ih) {
  const out = [];
  for (let i = 0; i < UPPER_INNER_ARCH.length; i++) {
    const u = landmarkToPx(landmarks, UPPER_INNER_ARCH[i], iw, ih);
    const l = landmarkToPx(landmarks, LOWER_INNER_ARCH[i], iw, ih);
    if (!u || !l) continue;
    out.push({
      x: (u.x + l.x) * 0.5,
      y: (u.y + l.y) * 0.5,
      z: (u.z + l.z) * 0.5,
    });
  }
  out.sort((a, b) => a.x - b.x);
  return out;
}

/** @deprecated use buildTeethMidlineControlPoints */
export function getTeethArchControlPoints(landmarks, iw, ih, _isUpper) {
  return buildTeethMidlineControlPoints(landmarks, iw, ih);
}

export function getTeethCenterline(landmarks, iw, ih) {
  const mid = buildTeethMidlineControlPoints(landmarks, iw, ih);
  return { upperCtrl: mid, lowerCtrl: mid };
}

function angleAt(p0, p1, p2) {
  const ax = p1.x - p0.x;
  const ay = p1.y - p0.y;
  const bx = p2.x - p1.x;
  const by = p2.y - p1.y;
  const la = Math.hypot(ax, ay);
  const lb = Math.hypot(bx, by);
  if (la < 1e-6 || lb < 1e-6) return Math.PI;
  const c = clamp((ax * bx + ay * by) / (la * lb), -1, 1);
  return Math.acos(c);
}

/** Drop points that create sharp kinks (straight ≈ π; smaller = sharper). */
function removeSharpTurns(pts, minInteriorRad = 2.05) {
  if (pts.length < 4) return pts;
  let cur = pts.map((p) => ({ ...p }));
  let changed = true;
  while (changed && cur.length >= 4) {
    changed = false;
    const next = [cur[0]];
    for (let i = 1; i < cur.length - 1; i++) {
      const th = angleAt(cur[i - 1], cur[i], cur[i + 1]);
      if (th < minInteriorRad) {
        changed = true;
        continue;
      }
      next.push(cur[i]);
    }
    next.push(cur[cur.length - 1]);
    if (next.length === cur.length) break;
    cur = next;
  }
  return cur.length >= 2 ? cur : pts;
}

/** Drop points far from median y (lip outliers). */
function removeYOutliers(pts, maxDevRatio = 2.2) {
  if (pts.length < 4) return pts;
  const ys = pts.map((p) => p.y).sort((a, b) => a - b);
  const med = ys[Math.floor(ys.length / 2)];
  const dev = ys.map((y) => Math.abs(y - med)).sort((a, b) => a - b);
  const mad = dev[Math.floor(dev.length / 2)] || 1;
  const lim = Math.max(mad * maxDevRatio, 12);
  return pts.filter((p) => Math.abs(p.y - med) <= lim);
}

/** Least-squares y ≈ a*x² + b*x + c for a smooth U-shaped dental arc. */
function fitQuadraticYofX(pts) {
  if (pts.length < 3) return { a: 0, b: 0, c: pts[0]?.y ?? 0 };
  let s0 = 0;
  let s1 = 0;
  let s2 = 0;
  let s3 = 0;
  let s4 = 0;
  let t0 = 0;
  let t1 = 0;
  let t2 = 0;
  for (const p of pts) {
    const x = p.x;
    const y = p.y;
    const x2 = x * x;
    const x3 = x2 * x;
    const x4 = x2 * x2;
    s0 += 1;
    s1 += x;
    s2 += x2;
    s3 += x3;
    s4 += x4;
    t0 += y;
    t1 += x * y;
    t2 += x2 * y;
  }
  const sol = gaussianSolve3(
    [
      [s4, s3, s2],
      [s3, s2, s1],
      [s2, s1, s0],
    ],
    [t2, t1, t0],
  );
  if (!sol) return { a: 0, b: 0, c: t0 / Math.max(s0, 1) };
  return { a: sol[0], b: sol[1], c: sol[2] };
}

function gaussianSolve3(A, b) {
  const M = [[...A[0], b[0]], [...A[1], b[1]], [...A[2], b[2]]];
  for (let col = 0; col < 3; col++) {
    let piv = col;
    for (let r = col + 1; r < 3; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    }
    [M[col], M[piv]] = [M[piv], M[col]];
    const v = M[col][col];
    if (Math.abs(v) < 1e-12) return null;
    for (let c = col; c < 4; c++) M[col][c] /= v;
    for (let r = 0; r < 3; r++) {
      if (r === col) continue;
      const f = M[r][col];
      for (let c = col; c < 4; c++) M[r][c] -= f * M[col][c];
    }
  }
  return [M[0][3], M[1][3], M[2][3]];
}

function evalQuad(q, x) {
  return q.a * x * x + q.b * x + q.c;
}

/** Fewer brackets: evenly spaced indices along same underlying arc (keeps upper/lower alignment). */
function resampleSubsetEvenly(pts, nOut) {
  if (!pts.length || nOut < 2) return pts;
  if (pts.length <= nOut) return pts.map((p) => ({ ...p }));
  const out = [];
  for (let j = 0; j < nOut; j++) {
    const ix = Math.round((j * (pts.length - 1)) / Math.max(nOut - 1, 1));
    out.push({ ...pts[ix] });
  }
  return out;
}

/** Blend dense Catmull chain toward quadratic U to kill jagged segments. */
function blendParabolicU(dense, quad, alpha) {
  const a = clamp(alpha, 0, 1);
  if (a < 1e-6) return dense;
  return dense.map((p) => ({
    ...p,
    y: (1 - a) * p.y + a * evalQuad(quad, p.x),
  }));
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

export function smoothOpenCatmull(pts, stepsPerSeg) {
  if (pts.length === 0) return [];
  if (pts.length === 1) return [{ ...pts[0] }];
  const steps = Math.max(10, stepsPerSeg | 0);
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

/**
 * Tangent from neighbors; scale = max(0.5, 1 - |i - center| * 0.05); light Z + oval depth.
 */
export function computeBracketTransforms(row, iw, ih, oval) {
  const n = row.length;
  const centerIndex = (n - 1) / 2;
  const ocx = oval?.cx != null ? oval.cx : row[Math.floor(n / 2)]?.x ?? iw * 0.5;
  const orx = Math.max(oval?.rx ?? iw * 0.18, 1);

  const zs = row.map((r) => r.z ?? 0);
  const zMin = Math.min(...zs);
  const zMax = Math.max(...zs);
  const zSpan = Math.max(zMax - zMin, 1e-6);
  const zMed = (zMin + zMax) * 0.5;

  return row.map((p, i) => {
    const ang = tangentAngleAt(row, i);
    const edge = clamp(Math.abs((p.x - ocx) / orx), 0, 1);
    const perspective = 0.58 + 0.42 * (1 - edge);

    const distFromCenter = Math.abs(i - centerIndex);
    const scaleIdx = Math.max(0.5, 1 - distFromCenter * 0.05);

    const zDist = Math.abs((p.z ?? 0) - zMed) / zSpan;
    const zScale = clamp(1.04 - 0.18 * zDist, 0.86, 1.04);

    const wMult = Math.max(0.68, perspective * scaleIdx * zScale);
    const hMult = wMult * (0.7 + 0.3 * (1 - edge));

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

function occlusalMidYpx(landmarks, iw, ih) {
  const u = landmarkToPx(landmarks, INNER_LIP_UPPER_IDX, iw, ih);
  const l = landmarkToPx(landmarks, INNER_LIP_LOWER_IDX, iw, ih);
  if (!u || !l) return null;
  return (u.y + l.y) * 0.5;
}

/**
 * One smooth dental midline → upper/lower studs by vertical split (aligned arcs, no lip zig-zag).
 */
export function buildGeometricBracesPack(landmarks, iw, ih, oval, opts = {}) {
  if (!landmarks?.length) return null;

  const bracketCountUpper = clamp(Math.round(opts.bracketCountUpper ?? DEFAULT_UPPER_COUNT), 8, 16);
  const bracketCountLower = clamp(Math.round(opts.bracketCountLower ?? DEFAULT_LOWER_COUNT), 8, 16);

  let ctrl = buildTeethMidlineControlPoints(landmarks, iw, ih);
  if (ctrl.length < 2) return null;

  ctrl = removeYOutliers(ctrl);
  ctrl = removeSharpTurns(ctrl);
  if (ctrl.length < 2) return null;

  const quad = fitQuadraticYofX(ctrl);
  let dense = smoothOpenCatmull(ctrl, CATMULL_CTRL_STEPS);
  dense = blendParabolicU(dense, quad, PARABOLA_BLEND);

  const nMax = Math.max(bracketCountUpper, bracketCountLower);
  let baseStuds = resampleCurveEqualArcLength(dense, nMax);
  if (baseStuds.length < 2) return null;

  const midY = occlusalMidYpx(landmarks, iw, ih);
  const u13 = landmarkToPx(landmarks, INNER_LIP_UPPER_IDX, iw, ih);
  const l14 = landmarkToPx(landmarks, INNER_LIP_LOWER_IDX, iw, ih);
  let mouthGap = 18;
  if (u13 && l14) mouthGap = Math.abs(l14.y - u13.y);
  const halfStep = clamp(mouthGap * 0.19, 7, 26);
  const margin = 3;

  const offsetUpper = (p) => {
    const y = p.y - halfStep;
    const yy = midY != null ? Math.min(y, midY - margin) : y;
    return { ...p, y: yy };
  };
  const offsetLower = (p) => {
    const y = p.y + halfStep;
    const yy = midY != null ? Math.max(y, midY + margin) : y;
    return { ...p, y: yy };
  };

  let upperStuds = baseStuds.map(offsetUpper);
  let lowerStuds = baseStuds.map(offsetLower);

  if (bracketCountUpper < nMax) upperStuds = resampleSubsetEvenly(upperStuds, bracketCountUpper);
  if (bracketCountLower < nMax) lowerStuds = resampleSubsetEvenly(lowerStuds, bracketCountLower);

  const upperAnchors = computeBracketTransforms(upperStuds, iw, ih, oval);
  const lowerAnchors = computeBracketTransforms(lowerStuds, iw, ih, oval);

  const wireSamplesUpper = sampleWireFromStuds(upperStuds, CATMULL_STEPS_PER_SEGMENT);
  const wireSamplesLower = sampleWireFromStuds(lowerStuds, CATMULL_STEPS_PER_SEGMENT);

  return {
    wireMode: "catmull",
    upperAnchors,
    lowerAnchors,
    wireSamplesUpper,
    wireSamplesLower,
  };
}

export { smoothOpenCatmull as smoothCurve, resampleCurveEqualArcLength as resampleCurve };
