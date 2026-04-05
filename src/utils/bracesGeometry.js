/**
 * Dual-arch braces: bracket sites from MediaPipe tooth/lip landmarks (per-tooth curve), resampled evenly by arc length;
 * wires follow smoothed landmark splines; molar span extended along end tangents. Parametric fallback if landmarks sparse.
 */

import { getBracketPoints, sampleParametricArc, extendWireSamplesAlongTangents } from "./bracesDentalArc";

/** Upper arch: inner upper lip + upper teeth ridge, left→right in image space (after sort by x). */
const UPPER_TEETH_ARCH_INDICES = [312, 311, 310, 415, 308, 324, 318, 402, 317, 13];
/** Lower arch: lower lip / lower teeth-facing contour (same 468-style indices as whitening mask lower set). */
const LOWER_TEETH_ARCH_INDICES = [78, 191, 80, 81, 82, 87, 178, 88, 95, 14];
const INNER_LIP_UPPER_IDX = 13;
const INNER_LIP_LOWER_IDX = 14;
const COMMISSURE_LEFT_IDX = 61;
const COMMISSURE_RIGHT_IDX = 291;

const WIRE_SAMPLES = 100;
/** Past-terminal bracket extension; wire is clipped to mouth oval when drawn. */
const WIRE_MOLAR_END_EXTEND_PX = 2;
const DEFAULT_BRACKET_COUNT = 10;

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
  const bandDepth = clamp(mouthOpen * 0.16, 6, 28);

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
  const bandDepth = clamp(mouthOpen * 0.15, 5, 24);

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

function applyPerspectiveScaleToAnchors(anchors, studs) {
  if (!studs?.length) return anchors;
  const xs = studs.map((p) => p.x);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const centerX = (xMin + xMax) * 0.5;
  const halfW = Math.max((xMax - xMin) * 0.5, 1e-3);
  const mid = Math.floor(studs.length / 2);
  const centerScale = Math.max(
    Math.max(0.55, 1 - (Math.abs(studs[mid].x - centerX) / halfW) * 0.25),
    0.01,
  );
  return anchors.map((a, i) => {
    const dist = Math.abs(studs[i].x - centerX);
    const s = Math.max(0.55, 1 - (dist / halfW) * 0.25);
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

    const scaleZ = clamp(1 / (1 + (p.z ?? 0) * 1.5), 0.7, 1.14);
    const normD = distFromCenter / maxDist;
    const depthOpacity = clamp(1 - normD * 0.3, 0.62, 1);

    const wMult = Math.max(0.62, perspective * scaleIdx * zScale);
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

export function sampleWireFromStuds(studs, stepsPerSeg) {
  if (!studs || studs.length < 2) return studs?.map((p) => ({ x: p.x, y: p.y })) ?? [];
  return smoothOpenCatmull(studs, stepsPerSeg).map(({ x, y }) => ({ x, y }));
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
  const upperStuds = bp.map((p) => ({ x: p.x, y: p.y, z: 0 }));
  let upperAnchors = computeBracketTransforms(upperStuds, iw, ih, oval);
  const mid = Math.floor(nUpper / 2);
  const centerScale = Math.max(bp[mid]?.scale ?? 1, 0.01);
  upperAnchors = upperAnchors.map((a, i) => ({
    ...a,
    ang: bp[i]?.ang ?? a.ang,
    wMult: (a.wMult ?? 1) * ((bp[i]?.scale ?? 1) / centerScale),
    hMult: (a.hMult ?? 1) * ((bp[i]?.scale ?? 1) / centerScale),
  }));

  const wireSamplesUpper = sampleParametricArc(left, right, upperLip, lowerLip, WIRE_SAMPLES, {
    extendEndsPx: WIRE_MOLAR_END_EXTEND_PX,
  });

  const bpLo = getBracketPoints(left, right, upperLip, lowerLip, nLower);
  let lowerStuds = [];
  let lowerAnchors = [];
  let wireSamplesLower = [];
  if (bpLo?.length) {
    const teethYLo = lowerLip.y - mouthOpen * 0.38;
    const arcH = mouthOpen * 0.12;
    const centerX = (left.x + right.x) * 0.5;
    const width = Math.max((right.x - left.x) * 0.5, 1e-3);
    const lowerAngs = [];
    lowerStuds = bpLo.map((_, i) => {
      const t = nLower === 1 ? 0.5 : i / (nLower - 1);
      const x = left.x + t * (right.x - left.x);
      const u = (x - centerX) / width;
      const y = teethYLo - arcH * (1 - u * u);
      const dydx = (-2 * arcH * (x - centerX)) / (width * width);
      lowerAngs.push(Math.atan2(dydx, 1));
      return { x, y, z: 0 };
    });
    lowerAnchors = computeBracketTransforms(lowerStuds, iw, ih, oval).map((a, i) => ({
      ...a,
      ang: (lowerAngs[i] ?? a.ang) + Math.PI,
    }));
    lowerAnchors = applyPerspectiveScaleToAnchors(lowerAnchors, lowerStuds);
    const lowerDense = [];
    for (let s = 0; s <= 48; s++) {
      const t = s / 48;
      const x = left.x + t * (right.x - left.x);
      const u = (x - centerX) / width;
      const y = teethYLo - arcH * (1 - u * u);
      lowerDense.push({ x, y });
    }
    wireSamplesLower = extendWireSamplesAlongTangents(sampleWireFromStuds(lowerDense, 6), WIRE_MOLAR_END_EXTEND_PX);
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
 * Upper + lower arches: brackets on resampled landmark tooth curves (molar-to-molar); wires = Catmull splines.
 */
export function buildGeometricBracesPack(landmarks, iw, ih, oval, opts = {}) {
  if (!landmarks?.length) return null;

  const nUpper = clamp(Math.round(opts.bracketCountUpper ?? opts.bracketCount ?? DEFAULT_BRACKET_COUNT), 8, 12);
  const nLower = clamp(Math.round(opts.bracketCountLower ?? opts.bracketCount ?? DEFAULT_BRACKET_COUNT), 8, 12);

  const upperEx = extractUpperTeethControls(landmarks, iw, ih);
  const lowerEx = extractLowerTeethControls(landmarks, iw, ih);
  const upperLip = landmarkToPx(landmarks, INNER_LIP_UPPER_IDX, iw, ih);
  const lowerLip = landmarkToPx(landmarks, INNER_LIP_LOWER_IDX, iw, ih);
  const mouthOpen =
    upperLip && lowerLip ? Math.abs(lowerLip.y - upperLip.y) : Math.max(upperEx.mouthOpen, lowerEx.mouthOpen, 24);

  if (!upperEx.pts?.length || upperEx.pts.length < 2) {
    return buildParametricFallbackPack(landmarks, iw, ih, oval, nUpper, nLower);
  }

  let upperCtrl = medianSmoothY(removeYSpikes(upperEx.pts));
  if (upperCtrl.length < 2) return buildParametricFallbackPack(landmarks, iw, ih, oval, nUpper, nLower);

  const endPad = clamp(mouthOpen * 0.055, 4, 18);
  upperCtrl = extendArchEnds(upperCtrl, endPad);

  const upperBracketSites = resampleCurveEqualArcLength(upperCtrl, nUpper);
  const upperStuds = upperBracketSites.map((p) => ({ x: p.x, y: p.y, z: p.z ?? 0 }));
  let upperAnchors = computeBracketTransforms(upperStuds, iw, ih, oval);
  upperAnchors = applyPerspectiveScaleToAnchors(upperAnchors, upperStuds);

  let wireSamplesUpper = extendWireSamplesAlongTangents(
    sampleWireFromStuds(upperCtrl, 7),
    WIRE_MOLAR_END_EXTEND_PX,
  );

  let lowerStuds = [];
  let lowerAnchors = [];
  let wireSamplesLower = [];
  if (lowerEx.pts?.length >= 2) {
    let lowerCtrl = medianSmoothY(removeYSpikes(lowerEx.pts));
    lowerCtrl = extendArchEnds(lowerCtrl, endPad);
    const lowerBracketSites = resampleCurveEqualArcLength(lowerCtrl, nLower);
    lowerStuds = lowerBracketSites.map((p) => ({ x: p.x, y: p.y, z: p.z ?? 0 }));
    lowerAnchors = computeBracketTransforms(lowerStuds, iw, ih, oval);
    lowerAnchors = applyPerspectiveScaleToAnchors(lowerAnchors, lowerStuds).map((a) => ({
      ...a,
      ang: (a.ang ?? 0) + Math.PI,
    }));
    wireSamplesLower = extendWireSamplesAlongTangents(sampleWireFromStuds(lowerCtrl, 7), WIRE_MOLAR_END_EXTEND_PX);
  }

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

export { smoothOpenCatmull as smoothCurve, resampleCurveEqualArcLength as resampleCurve };
