/**
 * Math-based upper dental arc from mouth corners + inner lips only (not raw tooth curves).
 * MediaPipe indices: commissures 61, 291; inner upper/lower lip 13, 14.
 */

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
  const mouthHeight = lowerLip.y - upperLip.y;
  const centerX = (left.x + right.x) / 2;
  const width = mouthWidth / 2;

  const teethY = upperLip.y + UPPER_TEETHY_FRAC * mouthHeight;
  const arcHeight = mouthHeight * 0.15;

  const points = [];
  const n = Math.max(2, Math.round(count));
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const x = left.x + t * mouthWidth;
    const u = width > 1e-6 ? (x - centerX) / width : 0;
    const y = teethY + arcHeight * (1 - u * u);
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

  const centerX = (left.x + right.x) / 2;
  const width = mouthWidth / 2;
  const teethY = lowerLip.y - mouthHeight * 0.38;
  const arcHeight = mouthHeight * 0.12;

  const n = Math.max(2, Math.round(count));
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const x = left.x + t * mouthWidth;
    const u = width > 1e-6 ? (x - centerX) / width : 0;
    const y = teethY - arcHeight * (1 - u * u);
    const dydx = width > 1e-6 ? (-2 * arcHeight * (x - centerX)) / (width * width) : 0;
    const ang = Math.atan2(dydx, 1);
    const distFromCenter = Math.abs(x - centerX);
    const scale = Math.max(0.55, 1 - (distFromCenter / Math.max(width, 1e-6)) * 0.25);
    out.push({ x, y, ang, scale });
  }
  return out;
}

export function getBracketPoints(left, right, upperLip, lowerLip, count = 10) {
  const mouthWidth = right.x - left.x;
  const mouthHeight = lowerLip.y - upperLip.y;
  if (mouthWidth < 4 || mouthHeight < 2) return null;

  const centerX = (left.x + right.x) / 2;
  const width = mouthWidth / 2;
  const teethY = upperLip.y + UPPER_TEETHY_FRAC * mouthHeight;
  const arcHeight = mouthHeight * 0.15;

  const n = Math.max(2, Math.round(count));
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const x = left.x + t * mouthWidth;
    const u = width > 1e-6 ? (x - centerX) / width : 0;
    const y = teethY + arcHeight * (1 - u * u);

    const dydx = width > 1e-6 ? (-2 * arcHeight * (x - centerX)) / (width * width) : 0;
    const ang = Math.atan2(dydx, 1);
    const distFromCenter = Math.abs(x - centerX);
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
