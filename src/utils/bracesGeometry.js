/**
 * Dual-arch braces: bracket sites from MediaPipe tooth/lip landmarks (per-tooth curve), resampled evenly by arc length;
 * wires follow smoothed landmark splines; molar span extended along end tangents. Parametric fallback if landmarks sparse.
 */

import {
  getBracketPoints,
  getLowerArchBracketPoints,
  sampleParametricArc,
  extendWireSamplesAlongTangents,
  evalLowerArchParabolaY,
  evalLowerArchParabolaDydx,
  evalUpperArchParabolaY,
  evalUpperArchParabolaDydx,
} from "./bracesDentalArc";

/** Upper arch: one MediaPipe sample per “tooth station” along the ridge (left→right). */
export const UPPER_TEETH_ARCH_INDICES = [312, 311, 310, 415, 308, 324, 318, 402, 317, 13];
/** Lower arch: tooth-row samples (count matches visible bracket stations). */
export const LOWER_TEETH_ARCH_INDICES = [78, 191, 80, 81, 82, 87, 178, 88, 95, 14];
const INNER_LIP_UPPER_IDX = 13;
const INNER_LIP_LOWER_IDX = 14;
const COMMISSURE_LEFT_IDX = 61;
const COMMISSURE_RIGHT_IDX = 291;

const WIRE_SAMPLES = 100;
/** 0 = wire terminates at terminal bracket centers (no run-out into cheeks). */
const WIRE_MOLAR_END_EXTEND_PX = 0;
/**
 * Inward bend (px) near terminals; first/last wire samples stay on stud centers (preview: terminal + tuck).
 */
const ARCHWIRE_TERMINAL_TUCK_PX = 2;
/**
 * Scales how much extra parabolic sag we stack on the Catmull wire (see applyArchDepthBoost).
 * Sag is primarily derived from arch half-width in pixels so the curve stays visible at any zoom.
 */
const ARCH_CATMULL_DEPTH_BOOST = 1;
/** Distal molars vs centrals (~25% smaller linear size ⇒ incisors read ~1.25× molar). */
export const MOLAR_DEPTH_SCALE_MIN = 0.8;
/** Centroid/parametric pack: default counts follow landmark tooth-row length. */
const CENTROID_BRACKET_MIN = 6;
const CENTROID_BRACKET_MAX = 16;
const CATMULL_WIRE_STEPS_AFTER_SNAP = 22;
const DEFAULT_BRACKET_COUNT_UPPER = UPPER_TEETH_ARCH_INDICES.length;
const DEFAULT_BRACKET_COUNT_LOWER = LOWER_TEETH_ARCH_INDICES.length;
/** Default bracket counts = one station per tooth-row landmark (preview / centroid). */
export const LANDMARK_BRACKET_COUNT_UPPER = DEFAULT_BRACKET_COUNT_UPPER;
export const LANDMARK_BRACKET_COUNT_LOWER = DEFAULT_BRACKET_COUNT_LOWER;

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

/** y ≈ a*x² + b*x + c */
function fitQuadraticYofX(pts) {
  if (pts.length < 3) {
    const y0 = pts[0]?.y ?? 0;
    return { a: 0, b: 0, c: y0 };
  }
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

function evalQuad(q, x) {
  return q.a * x * x + q.b * x + q.c;
}

/** Upper teeth band: x from inner upper lip arch; y = lip y + offset into tooth (no lower lip). */
function extractUpperTeethControls(landmarks, iw, ih) {
  const lipU = landmarkToPx(landmarks, INNER_LIP_UPPER_IDX, iw, ih);
  const lipL = landmarkToPx(landmarks, INNER_LIP_LOWER_IDX, iw, ih);
  if (!lipU) return { pts: [], mouthOpen: 0, bandDepth: 0 };

  const mouthOpen = lipL ? Math.abs(lipL.y - lipU.y) : Math.max(28, ih * 0.04);
  /** Facial crown band: smaller offset keeps brackets on enamel, not inter-arch gap. */
  const bandDepth = clamp(mouthOpen * 0.11, 4, 20);

  const pts = [];
  for (const idx of UPPER_TEETH_ARCH_INDICES) {
    const p = landmarkToPx(landmarks, idx, iw, ih);
    if (!p) continue;
    pts.push({
      x: p.x,
      y: p.y + bandDepth,
      z: p.z ?? 0,
    });
  }
  pts.sort((a, b) => a.x - b.x);
  return { pts, mouthOpen, bandDepth };
}

/** Lower teeth band: shift landmarks slightly toward the bite (smaller y) for facial surface of lower crowns. */
function extractLowerTeethControls(landmarks, iw, ih) {
  const lipL = landmarkToPx(landmarks, INNER_LIP_LOWER_IDX, iw, ih);
  const lipU = landmarkToPx(landmarks, INNER_LIP_UPPER_IDX, iw, ih);
  if (!lipL) return { pts: [], mouthOpen: 0 };

  const mouthOpen = lipU ? Math.abs(lipL.y - lipU.y) : Math.max(28, ih * 0.04);
  const bandDepth = clamp(mouthOpen * 0.11, 4, 22);

  const pts = [];
  for (const idx of LOWER_TEETH_ARCH_INDICES) {
    const p = landmarkToPx(landmarks, idx, iw, ih);
    if (!p) continue;
    pts.push({
      x: p.x,
      y: p.y - bandDepth,
      z: p.z ?? 0,
    });
  }
  pts.sort((a, b) => a.x - b.x);
  return { pts, mouthOpen, bandDepth };
}

/**
 * One bracket station per upper/lower tooth-row landmark (same count as arch indices).
 * Positions sit on the facial band used for the archwire spline.
 */
export function buildStudRowsFromLandmarkTeeth(landmarks, iw, ih) {
  const lipU = landmarkToPx(landmarks, INNER_LIP_UPPER_IDX, iw, ih);
  const lipL = landmarkToPx(landmarks, INNER_LIP_LOWER_IDX, iw, ih);
  if (!lipU || !lipL) return null;
  const mouthOpen = Math.abs(lipL.y - lipU.y);
  if (mouthOpen < 4) return null;

  const u = extractUpperTeethControls(landmarks, iw, ih);
  const l = extractLowerTeethControls(landmarks, iw, ih);
  if (u.pts.length < 2 || l.pts.length < 2) return null;

  const upperStuds = u.pts.map((p) => ({ x: p.x, y: p.y, z: p.z ?? 0 })).sort((a, b) => a.x - b.x);
  const lowerStuds = l.pts.map((p) => ({ x: p.x, y: p.y, z: p.z ?? 0 })).sort((a, b) => a.x - b.x);
  return { upperStuds, lowerStuds, mouthOpen };
}

/** Piecewise-linear Y along a sorted-by-x polyline; extrapolates past ends. */
function interpolateYAtXSorted(pts, x) {
  if (!pts?.length) return 0;
  if (pts.length === 1) return pts[0].y;
  if (x <= pts[0].x) {
    const p0 = pts[0];
    const p1 = pts[1];
    const dx = p1.x - p0.x || 1e-6;
    return p0.y + ((x - p0.x) / dx) * (p1.y - p0.y);
  }
  const L = pts.length - 1;
  if (x >= pts[L].x) {
    const p0 = pts[L - 1];
    const p1 = pts[L];
    const dx = p1.x - p0.x || 1e-6;
    return p0.y + ((x - p0.x) / dx) * (p1.y - p0.y);
  }
  for (let i = 0; i < L; i++) {
    if (x >= pts[i].x && x <= pts[i + 1].x) {
      const dx = pts[i + 1].x - pts[i].x || 1e-6;
      const t = (x - pts[i].x) / dx;
      return pts[i].y + t * (pts[i + 1].y - pts[i].y);
    }
  }
  return pts[Math.floor(pts.length / 2)].y;
}

/**
 * Intersects a vertical line x with a polyline in **arch order** (left→right along the jaw).
 * Avoids sorting Catmull output by x, which breaks segment connectivity and causes jagged / truncated wires.
 */
function yFromArchPolylineAtX(ordered, x) {
  if (!ordered?.length) return 0;
  if (ordered.length === 1) return ordered[0].y;
  if (x <= ordered[0].x) {
    const a = ordered[0];
    const b = ordered[1];
    const dx = b.x - a.x;
    if (Math.abs(dx) < 1e-4) return a.y;
    const t = (x - a.x) / dx;
    return a.y + t * (b.y - a.y);
  }
  const last = ordered.length - 1;
  if (x >= ordered[last].x) {
    const a = ordered[last - 1];
    const b = ordered[last];
    const dx = b.x - a.x;
    if (Math.abs(dx) < 1e-4) return b.y;
    const t = (x - a.x) / dx;
    return a.y + t * (b.y - a.y);
  }
  for (let i = 0; i < last; i++) {
    const a = ordered[i];
    const b = ordered[i + 1];
    const lo = Math.min(a.x, b.x);
    const hi = Math.max(a.x, b.x);
    if (x < lo || x > hi) continue;
    const dx = b.x - a.x;
    if (Math.abs(dx) < 1e-4) return (a.y + b.y) * 0.5;
    const t = (x - a.x) / dx;
    return a.y + t * (b.y - a.y);
  }
  return ordered[Math.floor(ordered.length / 2)].y;
}

function smoothWireYLight(pts) {
  if (!pts || pts.length < 3) return pts;
  const n = pts.length;
  return pts.map((p, i) => {
    if (i === 0 || i === n - 1) return { ...p };
    const y = (pts[i - 1].y + p.y + pts[i + 1].y) / 3;
    return { x: p.x, y };
  });
}

const TOOTH_BAND_WIRE_SAMPLES = 120;

/**
 * Keeps upper archwire strictly above the oral midplane and lower strictly below, so the two
 * polylines never read as one “V” crossing the bite.
 */
export function clampArchWireYToLipBands(pts, landmarks, iw, ih, upper, mouthOpen) {
  if (!pts?.length || !landmarks?.length) return pts;
  const lipU = landmarkToPx(landmarks, INNER_LIP_UPPER_IDX, iw, ih);
  const lipL = landmarkToPx(landmarks, INNER_LIP_LOWER_IDX, iw, ih);
  if (!lipU || !lipL) return pts;
  const yMid = (lipU.y + lipL.y) * 0.5;
  const mo = typeof mouthOpen === "number" ? mouthOpen : Math.abs(lipL.y - lipU.y);
  const gap = Math.max(mo * 0.028, 2.5);
  const yMaxUpper = yMid - gap;
  const yMinLower = yMid + gap;
  return pts.map((p) => ({
    ...p,
    y: upper ? Math.min(p.y, yMaxUpper) : Math.max(p.y, yMinLower),
  }));
}

/**
 * Archwire that follows the facial tooth-row spline (landmarks) from left bracket to right bracket,
 * plus a mild parabolic sag. Upper sag is capped so the wire cannot dip into the lower row.
 */
export function sampleWireAlongToothBand(landmarks, iw, ih, studs, upper, mouthOpen) {
  if (!landmarks?.length || !studs || studs.length < 2) return null;
  const xs = studs.map((s) => s.x);
  const xMinStud = Math.min(...xs);
  const xMaxStud = Math.max(...xs);
  if (xMaxStud - xMinStud < 10) return null;

  const mo = typeof mouthOpen === "number" ? mouthOpen : 24;
  const row = upper ? extractUpperTeethControls(landmarks, iw, ih) : extractLowerTeethControls(landmarks, iw, ih);
  let base = row.pts ?? [];
  if (base.length < 2) return null;
  base = medianSmoothY(removeYSpikes(base));
  /** Keep point order along the arch — do not sort by x (breaks segment order for Catmull). */
  const dense = smoothOpenCatmull(base, 22).map(({ x, y }) => ({ x, y }));
  if (dense.length < 4) return null;

  const bx = base.map((p) => p.x);
  const cl = landmarkToPx(landmarks, COMMISSURE_LEFT_IDX, iw, ih);
  const cr = landmarkToPx(landmarks, COMMISSURE_RIGHT_IDX, iw, ih);
  let xMin = Math.min(xMinStud, ...bx);
  let xMax = Math.max(xMaxStud, ...bx);
  if (cl && cr) {
    xMin = Math.min(xMin, cl.x);
    xMax = Math.max(xMax, cr.x);
  }

  const cx = (xMin + xMax) * 0.5;
  const halfW = Math.max((xMax - xMin) * 0.5, 1e-3);
  let sagExtra = clamp(halfW * 0.048 + mo * 0.05, 6, 28);
  if (upper) sagExtra *= 0.38;

  const out = [];
  const n = TOOTH_BAND_WIRE_SAMPLES;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = xMin + t * (xMax - xMin);
    let y = yFromArchPolylineAtX(dense, x);
    const u = (x - cx) / halfW;
    const u2 = clamp(u * u, 0, 1);
    y += (upper ? 1 : -1) * sagExtra * (1 - u2);
    out.push({ x, y });
  }
  let banded = clampArchWireYToLipBands(out, landmarks, iw, ih, upper, mo);
  banded = smoothWireYLight(banded);
  return banded;
}

/** Push polyline ends outward ~molar/buccal tube (along end tangents). */
function extendArchEnds(pts, padPx) {
  if (!pts || pts.length < 2 || padPx <= 0) return pts;
  const out = pts.map((p) => ({ ...p }));
  const f = out[0];
  const s = out[1];
  const lenL = Math.hypot(f.x - s.x, f.y - s.y) || 1;
  const ux = (f.x - s.x) / lenL;
  const uy = (f.y - s.y) / lenL;
  out[0] = { x: f.x + ux * padPx, y: f.y + uy * padPx, z: f.z ?? 0 };

  const L = out.length;
  const la = out[L - 1];
  const pr = out[L - 2];
  const lenR = Math.hypot(la.x - pr.x, la.y - pr.y) || 1;
  const vx = (la.x - pr.x) / lenR;
  const vy = (la.y - pr.y) / lenR;
  out[L - 1] = { x: la.x + vx * padPx, y: la.y + vy * padPx, z: la.z ?? 0 };
  return out;
}

/**
 * Terminal “radial enrollment”: last three brackets on each side shift 5% toward midline (jaw taper).
 */
export function applyRadialMolarEnrollment(studs) {
  if (!studs?.length) return studs ?? [];
  const sorted = [...studs].sort((a, b) => a.x - b.x);
  const n = sorted.length;
  if (n < 6) return studs;
  const cx = (sorted[0].x + sorted[n - 1].x) * 0.5;
  const inward = 0.95;
  return sorted.map((s, i) => {
    const isLeft = i < 3;
    const isRight = i >= n - 3;
    if (!isLeft && !isRight) return { ...s };
    return { ...s, x: cx + (s.x - cx) * inward };
  });
}

function applyPerspectiveScaleToAnchors(anchors, studs) {
  if (!studs?.length) return anchors;
  const xs = studs.map((p) => p.x);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const centerX = (xMin + xMax) * 0.5;
  const halfW = Math.max((xMax - xMin) * 0.5, 1e-3);
  const mid = Math.floor(studs.length / 2);
  const centerScale = Math.max(
    Math.max(MOLAR_DEPTH_SCALE_MIN, 1 - (Math.abs(studs[mid].x - centerX) / halfW) * (1 - MOLAR_DEPTH_SCALE_MIN)),
    0.01,
  );
  return anchors.map((a, i) => {
    const dist = Math.abs(studs[i].x - centerX);
    const s = Math.max(MOLAR_DEPTH_SCALE_MIN, 1 - (dist / halfW) * (1 - MOLAR_DEPTH_SCALE_MIN));
    const ratio = s / centerScale;
    return {
      ...a,
      wMult: (a.wMult ?? 1) * ratio,
      hMult: (a.hMult ?? 1) * ratio,
    };
  });
}

function medianSmoothY(pts) {
  if (pts.length < 3) return pts.map((p) => ({ ...p }));
  const n = pts.length;
  return pts.map((p, i) => {
    const lo = Math.max(0, i - 1);
    const hi = Math.min(n - 1, i + 1);
    const ys = [];
    for (let j = lo; j <= hi; j++) ys.push(pts[j].y);
    ys.sort((a, b) => a - b);
    return { ...p, y: ys[Math.floor(ys.length / 2)] };
  });
}

/** Remove points whose y deviates strongly from neighbors along x (zig-zag). */
function removeYSpikes(pts, maxJumpPx = 18) {
  if (pts.length < 4) return pts;
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    if (i === 0 || i === pts.length - 1) {
      out.push(pts[i]);
      continue;
    }
    const prev = pts[i - 1];
    const next = pts[i + 1];
    const mid = (prev.y + next.y) * 0.5;
    if (Math.abs(pts[i].y - mid) > maxJumpPx) continue;
    out.push(pts[i]);
  }
  if (out.length < 2) return pts;
  return out;
}

function mouthWidthX(landmarks, iw, ih, ctrlPts) {
  const cl = landmarkToPx(landmarks, COMMISSURE_LEFT_IDX, iw, ih);
  const cr = landmarkToPx(landmarks, COMMISSURE_RIGHT_IDX, iw, ih);
  let x0 = ctrlPts.length ? Math.min(...ctrlPts.map((p) => p.x)) : iw * 0.35;
  let x1 = ctrlPts.length ? Math.max(...ctrlPts.map((p) => p.x)) : iw * 0.65;
  if (cl && cr) {
    x0 = Math.min(x0, cl.x, cr.x);
    x1 = Math.max(x1, cl.x, cr.x);
  }
  const w = x1 - x0;
  const pad = clamp(w * 0.045, 4, 22);
  x0 += pad;
  x1 -= pad;
  if (x1 - x0 < iw * 0.12) {
    const cx = (x0 + x1) * 0.5;
    const half = iw * 0.18;
    x0 = cx - half;
    x1 = cx + half;
  }
  return { x0, x1 };
}

function sampleZatX(ctrl, x) {
  if (!ctrl.length) return 0;
  let best = ctrl[0];
  let bd = Math.abs(ctrl[0].x - x);
  for (let i = 1; i < ctrl.length; i++) {
    const d = Math.abs(ctrl[i].x - x);
    if (d < bd) {
      bd = d;
      best = ctrl[i];
    }
  }
  return best.z ?? 0;
}

function tangentAngleAt(row, i) {
  const n = row.length;
  if (n < 2) return 0;
  if (i === 0) return Math.atan2(row[1].y - row[0].y, row[1].x - row[0].x);
  if (i === n - 1) return Math.atan2(row[n - 1].y - row[n - 2].y, row[n - 1].x - row[n - 2].x);
  return Math.atan2(row[i + 1].y - row[i - 1].y, row[i + 1].x - row[i - 1].x);
}

/**
 * Perspective + MediaPipe z: scaleZ = 1/(1+z*1.5); depthOpacity fades molars;
 * slight y nudge at arch ends (face curvature).
 */
export function computeBracketTransforms(row, iw, ih, oval) {
  const n = row.length;
  const centerIndex = (n - 1) / 2;
  const maxDist = Math.max(centerIndex, 1e-6);
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
    const scaleIdx = Math.max(0.52, 1 - distFromCenter * 0.04);

    const zDist = Math.abs((p.z ?? 0) - zMed) / zSpan;
    const zScale = clamp(1.03 - 0.16 * zDist, 0.88, 1.04);
    /** Distal molars: up to 20% shrink vs mid-arch (landmark Z). */
    const molarDepthScale =
      MOLAR_DEPTH_SCALE_MIN + (1 - MOLAR_DEPTH_SCALE_MIN) * (1 - clamp(zDist, 0, 1));

    const scaleZ = clamp(1 / (1 + (p.z ?? 0) * 1.5), 0.7, 1.14);
    const normD = distFromCenter / maxDist;
    const depthOpacity = clamp(1 - normD * 0.3, 0.62, 1);

    const wMult = Math.max(0.62, perspective * scaleIdx * zScale) * molarDepthScale;
    const hMult = wMult * (0.72 + 0.28 * (1 - edge));

    const yPersp = -edge * 1.4 * normD;

    return {
      x: clamp(p.x, 4, iw - 5),
      y: clamp(p.y + yPersp, 4, ih - 5),
      ang,
      wMult,
      hMult,
      z: p.z ?? 0,
      scaleZ,
      depthOpacity,
      star: false,
      skipStud: false,
    };
  });
}

function evalArchY(q, x, yMedian, yHalfBand) {
  const y = evalQuad(q, x);
  return clamp(y, yMedian - yHalfBand, yMedian + yHalfBand);
}

function buildStudRow(x0, x1, n, q, yMedian, yHalfBand, ctrl) {
  const studs = [];
  for (let k = 0; k < n; k++) {
    const t = n === 1 ? 0.5 : k / (n - 1);
    const x = x0 + t * (x1 - x0);
    const y = evalArchY(q, x, yMedian, yHalfBand);
    const z = sampleZatX(ctrl, x);
    studs.push({ x, y, z });
  }
  return studs;
}

function buildWirePolyline(x0, x1, q, yMedian, yHalfBand) {
  const out = [];
  for (let i = 0; i <= WIRE_SAMPLES; i++) {
    const t = i / WIRE_SAMPLES;
    const x = x0 + t * (x1 - x0);
    const y = evalArchY(q, x, yMedian, yHalfBand);
    out.push({ x, y });
  }
  return out;
}

/** Upper arch polyline for legacy callers (landmark tooth curve). */
export function buildTeethMidlineControlPoints(landmarks, iw, ih) {
  const r = extractUpperTeethControls(landmarks, iw, ih);
  if (!r.pts?.length) return [];
  return medianSmoothY(removeYSpikes(r.pts)).map((p) => ({ ...p, z: p.z ?? 0 }));
}

export function getTeethArchControlPoints(landmarks, iw, ih, _isUpper) {
  return buildTeethMidlineControlPoints(landmarks, iw, ih);
}

export function getTeethCenterline(landmarks, iw, ih) {
  const u = buildTeethMidlineControlPoints(landmarks, iw, ih);
  const lo = extractLowerTeethControls(landmarks, iw, ih);
  const lowerCtrl =
    lo.pts?.length >= 2 ? medianSmoothY(removeYSpikes(lo.pts)).map((p) => ({ ...p, z: p.z ?? 0 })) : [];
  return { upperCtrl: u, lowerCtrl };
}

export function smoothOpenCatmull(pts, stepsPerSeg) {
  if (pts.length === 0) return [];
  if (pts.length === 1) return [{ ...pts[0] }];
  const steps = Math.max(10, stepsPerSeg | 0);
  const dup0 = { ...pts[0] };
  const dup1 = { ...pts[pts.length - 1] };
  const chain = [dup0, ...pts.map((p) => ({ ...p })), dup1];
  const out = [];
  const catmullRom2D = (p0, p1, p2, p3, t) => {
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
    };
  };
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

/**
 * Nudge interior wire samples near each terminal toward the arch centroid (first/last points unchanged).
 * @param {{ x: number, y: number }[]} wirePts
 * @param {{ x: number, y: number }[]} studs — same arch, for centroid reference
 */
function applyTerminalWireTuck(wirePts, studs, tuckPx) {
  if (!wirePts || wirePts.length < 4 || tuckPx <= 0 || !studs || studs.length < 2) {
    return wirePts?.map((p) => ({ ...p })) ?? [];
  }
  const n = wirePts.length;
  let cx = 0;
  let cy = 0;
  for (const s of studs) {
    cx += s.x;
    cy += s.y;
  }
  cx /= studs.length;
  cy /= studs.length;

  const p0 = wirePts[0];
  const pN = wirePts[n - 1];
  const len0 = Math.hypot(cx - p0.x, cy - p0.y) || 1;
  const lenN = Math.hypot(cx - pN.x, cy - pN.y) || 1;
  const d0x = (cx - p0.x) / len0;
  const d0y = (cy - p0.y) / len0;
  const dNx = (cx - pN.x) / lenN;
  const dNy = (cy - pN.y) / lenN;

  const arc = [0];
  for (let i = 1; i < n; i++) {
    arc.push(arc[i - 1] + Math.hypot(wirePts[i].x - wirePts[i - 1].x, wirePts[i].y - wirePts[i - 1].y));
  }
  const total = arc[n - 1] || 1;
  const win = clamp(Math.min(total * 0.12, 28), 8, total * 0.45);

  const out = [];
  for (let i = 0; i < n; i++) {
    if (i === 0 || i === n - 1) {
      out.push({ x: wirePts[i].x, y: wirePts[i].y });
      continue;
    }
    const s0 = arc[i];
    const s1 = total - arc[i];
    let dx = 0;
    let dy = 0;
    if (s0 < win) {
      const f = 1 - s0 / win;
      const t = tuckPx * f * f;
      dx += d0x * t;
      dy += d0y * t;
    }
    if (s1 < win) {
      const f = 1 - s1 / win;
      const t = tuckPx * f * f;
      dx += dNx * t;
      dy += dNy * t;
    }
    out.push({ x: wirePts[i].x + dx, y: wirePts[i].y + dy });
  }
  return out;
}

function applyArchDepthBoost(wirePts, studs, mouthOpen, upper) {
  if (!wirePts?.length || !studs?.length || mouthOpen < 2) return wirePts?.map((p) => ({ ...p })) ?? [];
  const xs = studs.map((s) => s.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const cx = (minX + maxX) * 0.5;
  const halfW = Math.max((maxX - minX) * 0.5, 1e-3);
  // Old formula capped extra at ~6px — reads as ruler-straight on full-frame faces. Sag must scale with
  // arch span (half-width) so midline displacement is a visible % of the smile (~6–11% of half-width typical).
  const spanTerm = halfW * 0.092;
  const openTerm = mouthOpen * 0.11;
  let sagMid = spanTerm * 0.62 + openTerm * 0.38;
  sagMid = clamp(sagMid, 12, 78);
  sagMid *= 0.88 + 0.12 * clamp(ARCH_CATMULL_DEPTH_BOOST, 0.5, 1.5);
  return wirePts.map((p) => {
    const u = (p.x - cx) / halfW;
    const u2 = clamp(u * u, 0, 1);
    const delta = sagMid * (1 - u2);
    return { x: p.x, y: p.y + (upper ? delta : -delta) };
  });
}

/**
 * @param {{ mouthOpen?: number, upper?: boolean }} [opts] — deepens stud-chain wire to match parabolic arch
 */
export function sampleWireFromStuds(studs, stepsPerSeg, opts = {}) {
  if (!studs || studs.length < 2) return studs?.map((p) => ({ x: p.x, y: p.y })) ?? [];
  let pts = smoothOpenCatmull(studs, stepsPerSeg).map(({ x, y }) => ({ x, y }));
  pts = applyTerminalWireTuck(pts, studs, ARCHWIRE_TERMINAL_TUCK_PX);
  const mo = opts.mouthOpen;
  if (typeof mo === "number" && opts.upper != null) {
    pts = applyArchDepthBoost(pts, studs, mo, opts.upper);
  }
  if (opts.landmarks && typeof opts.iw === "number" && typeof opts.ih === "number" && opts.upper != null && typeof mo === "number") {
    pts = clampArchWireYToLipBands(pts, opts.landmarks, opts.iw, opts.ih, opts.upper, mo);
  }
  return pts;
}

/** Fallback when tooth landmarks are missing or degenerate. */
function buildParametricFallbackPack(landmarks, iw, ih, oval, nUpper, nLower) {
  const left = landmarkToPx(landmarks, COMMISSURE_LEFT_IDX, iw, ih);
  const right = landmarkToPx(landmarks, COMMISSURE_RIGHT_IDX, iw, ih);
  const upperLip = landmarkToPx(landmarks, INNER_LIP_UPPER_IDX, iw, ih);
  const lowerLip = landmarkToPx(landmarks, INNER_LIP_LOWER_IDX, iw, ih);
  if (!left || !right || !upperLip || !lowerLip) return null;

  const bp = getBracketPoints(left, right, upperLip, lowerLip, nUpper);
  if (!bp?.length) return null;

  const mouthOpen = Math.abs(lowerLip.y - upperLip.y);
  let upperStuds = bp.map((p) => ({ x: p.x, y: p.y, z: 0 }));
  upperStuds = applyRadialMolarEnrollment(upperStuds);
  upperStuds = upperStuds.map((s) => ({
    ...s,
    y: evalUpperArchParabolaY(s.x, left, right, upperLip, lowerLip),
  }));
  let upperAnchors = computeBracketTransforms(upperStuds, iw, ih, oval);
  const mid = Math.floor(nUpper / 2);
  const centerScale = Math.max(bp[mid]?.scale ?? 1, 0.01);
  upperAnchors = upperAnchors.map((a, i) => ({
    ...a,
    ang: Math.atan2(evalUpperArchParabolaDydx(upperStuds[i].x, left, right, upperLip, lowerLip), 1),
    wMult: (a.wMult ?? 1) * ((bp[i]?.scale ?? 1) / centerScale),
    hMult: (a.hMult ?? 1) * ((bp[i]?.scale ?? 1) / centerScale),
  }));

  let wireSamplesUpper = sampleParametricArc(left, right, upperLip, lowerLip, WIRE_SAMPLES, {
    extendEndsPx: WIRE_MOLAR_END_EXTEND_PX,
  });
  wireSamplesUpper = applyTerminalWireTuck(wireSamplesUpper, upperStuds, ARCHWIRE_TERMINAL_TUCK_PX);
  wireSamplesUpper = clampArchWireYToLipBands(wireSamplesUpper, landmarks, iw, ih, true, mouthOpen);

  const bpLo = getLowerArchBracketPoints(left, right, upperLip, lowerLip, nLower);
  let lowerStuds = [];
  let lowerAnchors = [];
  let wireSamplesLower = [];
  if (bpLo?.length) {
    lowerStuds = bpLo.map((p) => ({ x: p.x, y: p.y, z: 0 }));
    lowerStuds = applyRadialMolarEnrollment(lowerStuds);
    lowerStuds = lowerStuds.map((s) => ({
      ...s,
      y: evalLowerArchParabolaY(s.x, left, right, upperLip, lowerLip),
    }));
    lowerAnchors = computeBracketTransforms(lowerStuds, iw, ih, oval).map((a, i) => ({
      ...a,
      ang: Math.atan2(evalLowerArchParabolaDydx(lowerStuds[i].x, left, right, upperLip, lowerLip), 1),
    }));
    lowerAnchors = applyPerspectiveScaleToAnchors(lowerAnchors, lowerStuds);
    const lowerDense = [];
    for (let s = 0; s <= 48; s++) {
      const t = s / 48;
      const x = left.x + t * (right.x - left.x);
      const y = evalLowerArchParabolaY(x, left, right, upperLip, lowerLip);
      lowerDense.push({ x, y });
    }
    wireSamplesLower = extendWireSamplesAlongTangents(
      sampleWireFromStuds(lowerDense, 6, {
        mouthOpen,
        upper: false,
        landmarks,
        iw,
        ih,
      }),
      WIRE_MOLAR_END_EXTEND_PX,
    );
  }

  return {
    wireMode: "polyline",
    upperStuds,
    upperAnchors,
    lowerStuds: lowerStuds.map(({ x, y, z }) => ({ x, y, z })),
    lowerAnchors,
    wireSamplesUpper,
    wireSamplesLower,
    mouthOpen,
  };
}

/**
 * Bracket sites on parametric arches; wire follows MediaPipe tooth-row splines from distal stud to distal stud
 * (see sampleWireAlongToothBand), with Catmull-on-studs fallback.
 */
export function buildCentroidBracesPack(landmarks, iw, ih, oval, opts = {}) {
  if (!landmarks?.length) return null;

  const nU = clamp(
    Math.round(opts.bracketCountUpper ?? opts.bracketCount ?? DEFAULT_BRACKET_COUNT_UPPER),
    CENTROID_BRACKET_MIN,
    CENTROID_BRACKET_MAX,
  );
  const nL = clamp(
    Math.round(opts.bracketCountLower ?? opts.bracketCount ?? DEFAULT_BRACKET_COUNT_LOWER),
    CENTROID_BRACKET_MIN,
    CENTROID_BRACKET_MAX,
  );

  const left = landmarkToPx(landmarks, COMMISSURE_LEFT_IDX, iw, ih);
  const right = landmarkToPx(landmarks, COMMISSURE_RIGHT_IDX, iw, ih);
  const lip13 = landmarkToPx(landmarks, INNER_LIP_UPPER_IDX, iw, ih);
  const lip14 = landmarkToPx(landmarks, INNER_LIP_LOWER_IDX, iw, ih);
  if (!left || !right || !lip13 || !lip14) {
    return buildParametricFallbackPack(landmarks, iw, ih, oval, nU, nL);
  }

  const bpU = getBracketPoints(left, right, lip13, lip14, nU);
  const bpL = getLowerArchBracketPoints(left, right, lip13, lip14, nL);
  if (!bpU?.length) return buildParametricFallbackPack(landmarks, iw, ih, oval, nU, nL);

  const mouthOpen = Math.abs(lip14.y - lip13.y);
  let upperStuds = bpU.map((p) => ({ x: p.x, y: p.y, z: 0 }));
  upperStuds = applyRadialMolarEnrollment(upperStuds);
  upperStuds = upperStuds.map((s) => ({
    ...s,
    y: evalUpperArchParabolaY(s.x, left, right, lip13, lip14),
  }));
  let upperAnchors = computeBracketTransforms(upperStuds, iw, ih, oval);
  const midU = Math.floor(nU / 2);
  const centerSU = Math.max(bpU[midU]?.scale ?? 1, 0.01);
  upperAnchors = upperAnchors.map((a, i) => ({
    ...a,
    ang: Math.atan2(evalUpperArchParabolaDydx(upperStuds[i].x, left, right, lip13, lip14), 1),
    wMult: (a.wMult ?? 1) * ((bpU[i]?.scale ?? 1) / centerSU),
    hMult: (a.hMult ?? 1) * ((bpU[i]?.scale ?? 1) / centerSU),
  }));

  let lowerStuds = [];
  let lowerAnchors = [];
  if (bpL?.length) {
    lowerStuds = bpL.map((p) => ({ x: p.x, y: p.y, z: 0 }));
    lowerStuds = applyRadialMolarEnrollment(lowerStuds);
    lowerStuds = lowerStuds.map((s) => ({
      ...s,
      y: evalLowerArchParabolaY(s.x, left, right, lip13, lip14),
    }));
    lowerAnchors = computeBracketTransforms(lowerStuds, iw, ih, oval);
    const midL = Math.floor(nL / 2);
    const centerSL = Math.max(bpL[midL]?.scale ?? 1, 0.01);
    lowerAnchors = lowerAnchors.map((a, i) => ({
      ...a,
      ang: Math.atan2(evalLowerArchParabolaDydx(lowerStuds[i].x, left, right, lip13, lip14), 1),
      wMult: (a.wMult ?? 1) * ((bpL[i]?.scale ?? 1) / centerSL),
      hMult: (a.hMult ?? 1) * ((bpL[i]?.scale ?? 1) / centerSL),
    }));
  }

  const steps = typeof opts.catmullWireSteps === "number" ? opts.catmullWireSteps : CATMULL_WIRE_STEPS_AFTER_SNAP;
  const wireSamplesUpper =
    sampleWireAlongToothBand(landmarks, iw, ih, upperStuds, true, mouthOpen) ??
    sampleWireFromStuds(upperStuds, steps, { mouthOpen, upper: true, landmarks, iw, ih });
  const wireSamplesLower =
    lowerStuds.length >= 2
      ? sampleWireAlongToothBand(landmarks, iw, ih, lowerStuds, false, mouthOpen) ??
        sampleWireFromStuds(lowerStuds, steps, { mouthOpen, upper: false, landmarks, iw, ih })
      : [];

  return {
    wireMode: "polyline",
    upperStuds,
    upperAnchors,
    lowerStuds,
    lowerAnchors,
    wireSamplesUpper,
    wireSamplesLower,
    mouthOpen,
  };
}

/** Recompute tangents, perspective, and wires after stud positions change (e.g. enamel snap). */
export function reprojectBracesPackAfterStudMove(pack, iw, ih, oval, landmarks = null) {
  if (!pack) return pack;
  const upperStuds = pack.upperStuds ?? [];
  const lowerStuds = pack.lowerStuds ?? [];

  let upperAnchors = [];
  if (upperStuds.length >= 1) {
    upperAnchors = computeBracketTransforms(upperStuds, iw, ih, oval);
    if (upperStuds.length >= 2) upperAnchors = applyPerspectiveScaleToAnchors(upperAnchors, upperStuds);
  }

  let lowerAnchors = [];
  if (lowerStuds.length >= 1) {
    lowerAnchors = computeBracketTransforms(lowerStuds, iw, ih, oval);
    if (lowerStuds.length >= 2) lowerAnchors = applyPerspectiveScaleToAnchors(lowerAnchors, lowerStuds);
  }

  const mo = typeof pack.mouthOpen === "number" ? pack.mouthOpen : 24;
  const wireSamplesUpper =
    upperStuds.length >= 2
      ? sampleWireAlongToothBand(landmarks, iw, ih, upperStuds, true, mo) ??
        sampleWireFromStuds(upperStuds, CATMULL_WIRE_STEPS_AFTER_SNAP, {
          mouthOpen: mo,
          upper: true,
          landmarks,
          iw,
          ih,
        })
      : [];
  const wireSamplesLower =
    lowerStuds.length >= 2
      ? sampleWireAlongToothBand(landmarks, iw, ih, lowerStuds, false, mo) ??
        sampleWireFromStuds(lowerStuds, CATMULL_WIRE_STEPS_AFTER_SNAP, {
          mouthOpen: mo,
          upper: false,
          landmarks,
          iw,
          ih,
        })
      : [];

  return {
    ...pack,
    upperAnchors,
    lowerAnchors,
    wireSamplesUpper,
    wireSamplesLower,
  };
}

/** @deprecated Use buildCentroidBracesPack; kept for imports. */
export function buildGeometricBracesPack(landmarks, iw, ih, oval, opts = {}) {
  return buildCentroidBracesPack(landmarks, iw, ih, oval, opts);
}

export { smoothOpenCatmull as smoothCurve, resampleCurveEqualArcLength as resampleCurve };
