/**
 * Radial parabolic arches: y = a(x − h)² + k with vertex (h,k) at inner lip 13 (upper) / 14 (lower).
 * Commissures 61 / 291 define span; PARABOLIC_ARCH_DEPTH_FACTOR deepens clinical smile curve vs flat chords.
 */
/** Multiplier on baseline arc sag (aggressive visible “smile arch”). */
export const PARABOLIC_ARCH_DEPTH_FACTOR = 1.65;

/** Base vertical blend: inner upper lip → into open mouth (fraction of mouth height). */
const UPPER_TEETHY_FRAC_BASE = 0.35;
/**
 * Upper arch: shift slightly toward gum line (smaller y) so brackets sit higher on crowns
 * and read as separated from the occlusal / lower-arch plane. Fraction of mouth height.
 */
const UPPER_ARCH_VERTICAL_OFFSET = -0.1;
/** Effective upper-arch row: BASE + OFFSET → 0.25 with defaults. */
const UPPER_TEETHY_FRAC = UPPER_TEETHY_FRAC_BASE + UPPER_ARCH_VERTICAL_OFFSET;

/**
 * Reserved for a future lower arch: shift bracket row slightly toward chin (larger y),
 * i.e. deeper on lower crowns vs meeting upper. Use as addend to a lower-lip-based frac.
 */
export const LOWER_ARCH_VERTICAL_OFFSET_FRAC = 0.1;

function halfMouthWidth(left, right) {
  return Math.max((right.x - left.x) * 0.5, 1e-6);
}

/**
 * Upper: vertex at landmark 13 (h = upperLip.x); opens toward lip (max y at midline).
 * @returns {{ teethY: number, arcHeight: number, h: number, W: number, a: number, k: number }}
 */
function upperParabolaParams(left, right, upperLip, lowerLip) {
  const mouthHeight = lowerLip.y - upperLip.y;
  const W = halfMouthWidth(left, right);
  const h = upperLip.x;
  const teethY = upperLip.y + UPPER_TEETHY_FRAC * mouthHeight;
  const arcHeight = mouthHeight * 0.15 * PARABOLIC_ARCH_DEPTH_FACTOR;
  const k = teethY + arcHeight;
  const a = -arcHeight / (W * W);
  return { teethY, arcHeight, h, W, a, k };
}

/**
 * Lower: vertex at landmark 14 (h = lowerLip.x); U-arch, deepest at midline (min y).
 */
function lowerParabolaParams(left, right, upperLip, lowerLip) {
  const mouthHeight = lowerLip.y - upperLip.y;
  const W = halfMouthWidth(left, right);
  const h = lowerLip.x;
  const teethY = lowerLip.y - mouthHeight * 0.38;
  const arcHeight = mouthHeight * 0.12 * PARABOLIC_ARCH_DEPTH_FACTOR;
  const k = teethY - arcHeight;
  const a = arcHeight / (W * W);
  return { teethY, arcHeight, h, W, a, k };
}

/** y = a(x−h)² + k */
export function evalUpperArchParabolaY(x, left, right, upperLip, lowerLip) {
  const { a, h, k } = upperParabolaParams(left, right, upperLip, lowerLip);
  return a * (x - h) * (x - h) + k;
}

export function evalUpperArchParabolaDydx(x, left, right, upperLip, lowerLip) {
  const { a, h } = upperParabolaParams(left, right, upperLip, lowerLip);
  return 2 * a * (x - h);
}

export function evalLowerArchParabolaY(x, left, right, upperLip, lowerLip) {
  const { a, h, k } = lowerParabolaParams(left, right, upperLip, lowerLip);
  return a * (x - h) * (x - h) + k;
}

export function evalLowerArchParabolaDydx(x, left, right, upperLip, lowerLip) {
  const { a, h } = lowerParabolaParams(left, right, upperLip, lowerLip);
  return 2 * a * (x - h);
}

/**
 * @param {{ x: number, y: number }} left
 * @param {{ x: number, y: number }} right
 * @param {{ x: number, y: number }} upperLip
 * @param {{ x: number, y: number }} lowerLip
 * @param {number} [count=10]
 * @returns {{ x: number, y: number }[]}
 */
export function generateDentalArc(left, right, upperLip, lowerLip, count = 10) {
  const mouthWidth = right.x - left.x;
  const points = [];
  const n = Math.max(2, Math.round(count));
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const x = left.x + t * mouthWidth;
    const y = evalUpperArchParabolaY(x, left, right, upperLip, lowerLip);
    points.push({ x, y });
  }
  return points;
}

/**
 * Evenly spaced bracket sites on the parametric arc with tangent angle and perspective scale.
 * @returns {Array<{ x: number, y: number, ang: number, scale: number }>|null}
 */
/**
 * Lower arch parabola anchored to inner lower lip (14): U-shaped curve opening upward (smaller y at midline).
 * Same mouth width/height basis as upper; occlusal row sits facial to lower lip.
 */
export function getLowerArchBracketPoints(left, right, upperLip, lowerLip, count = 12) {
  const mouthWidth = right.x - left.x;
  const mouthHeight = lowerLip.y - upperLip.y;
  if (mouthWidth < 4 || mouthHeight < 2) return null;

  const width = mouthWidth / 2;
  const { h } = lowerParabolaParams(left, right, upperLip, lowerLip);

  const n = Math.max(2, Math.round(count));
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const x = left.x + t * mouthWidth;
    const y = evalLowerArchParabolaY(x, left, right, upperLip, lowerLip);
    const dydx = evalLowerArchParabolaDydx(x, left, right, upperLip, lowerLip);
    const ang = Math.atan2(dydx, 1);
    const distFromCenter = Math.abs(x - h);
    const scale = Math.max(0.55, 1 - (distFromCenter / Math.max(width, 1e-6)) * 0.25);
    out.push({ x, y, ang, scale });
  }
  return out;
}

export function getBracketPoints(left, right, upperLip, lowerLip, count = 10) {
  const mouthWidth = right.x - left.x;
  const mouthHeight = lowerLip.y - upperLip.y;
  if (mouthWidth < 4 || mouthHeight < 2) return null;

  const width = mouthWidth / 2;
  const { h } = upperParabolaParams(left, right, upperLip, lowerLip);

  const n = Math.max(2, Math.round(count));
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const x = left.x + t * mouthWidth;
    const y = evalUpperArchParabolaY(x, left, right, upperLip, lowerLip);
    const dydx = evalUpperArchParabolaDydx(x, left, right, upperLip, lowerLip);
    const ang = Math.atan2(dydx, 1);
    const distFromCenter = Math.abs(x - h);
    const scale = Math.max(0.55, 1 - (distFromCenter / Math.max(width, 1e-6)) * 0.25);

    out.push({ x, y, ang, scale });
  }
  return out;
}

/**
 * Extrapolate wire ~`extendPx` past terminal brackets along end tangents (buccal-tube feel).
 * @param {{ x: number, y: number }[]} samples
 * @param {number} [extendPx=2]
 */
export function extendWireSamplesAlongTangents(samples, extendPx = 2) {
  if (!samples?.length || samples.length < 2 || extendPx <= 0) return samples;

  const first = samples[0];
  const second = samples[1];
  const vx = first.x - second.x;
  const vy = first.y - second.y;
  const lenL = Math.hypot(vx, vy) || 1;
  const start = {
    x: first.x + (vx / lenL) * extendPx,
    y: first.y + (vy / lenL) * extendPx,
  };

  const last = samples[samples.length - 1];
  const prev = samples[samples.length - 2];
  const wx = last.x - prev.x;
  const wy = last.y - prev.y;
  const lenR = Math.hypot(wx, wy) || 1;
  const end = {
    x: last.x + (wx / lenR) * extendPx,
    y: last.y + (wy / lenR) * extendPx,
  };

  return [start, ...samples, end];
}

/**
 * Dense polyline for archwire (or control polylines).
 * @param {{ extendEndsPx?: number }} [options] — only for wire: extend past last bracket; clip in renderer.
 */
export function sampleParametricArc(left, right, upperLip, lowerLip, steps = 80, options = {}) {
  const inner = generateDentalArc(left, right, upperLip, lowerLip, Math.max(2, Math.round(steps)));
  const ext = typeof options.extendEndsPx === "number" ? options.extendEndsPx : 0;
  if (ext <= 0) return inner;
  return extendWireSamplesAlongTangents(inner, ext);
}
