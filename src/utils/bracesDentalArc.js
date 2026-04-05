/**
 * Math-based upper dental arc from mouth corners + inner lips only (not raw tooth curves).
 * MediaPipe indices: commissures 61, 291; inner upper/lower lip 13, 14.
 */

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

  const teethY = upperLip.y + 0.35 * mouthHeight;
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
export function getBracketPoints(left, right, upperLip, lowerLip, count = 10) {
  const mouthWidth = right.x - left.x;
  const mouthHeight = lowerLip.y - upperLip.y;
  if (mouthWidth < 4 || mouthHeight < 2) return null;

  const centerX = (left.x + right.x) / 2;
  const width = mouthWidth / 2;
  const teethY = upperLip.y + 0.35 * mouthHeight;
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

/** Dense polyline samples for archwire rendering. */
export function sampleParametricArc(left, right, upperLip, lowerLip, steps = 80) {
  return generateDentalArc(left, right, upperLip, lowerLip, Math.max(2, Math.round(steps)));
}
