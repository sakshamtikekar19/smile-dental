/**
 * Fixed enamel clip for braces overlay.
 * Uses a looser hull than the whitening mask so distal brackets aren't clipped.
 * Also provides a reliable teeth mask for the whitening pass.
 */

const MOUTH_HULL_IDX = [61, 185, 40, 39, 37, 267, 269, 270, 409, 291, 308, 415, 310, 311, 312, 82, 81, 80, 191, 78];

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/**
 * Compute convex-ish hull points for teeth region.
 * Returns null if insufficient landmarks.
 */
export function getTeethHullPoints(landmarks, iw, ih, expandPx = 6) {
  const pts = MOUTH_HULL_IDX
    .map(idx => {
      const p = landmarks?.[idx];
      if (!p || typeof p.x !== 'number') return null;
      return { x: p.x * iw, y: p.y * ih };
    })
    .filter(Boolean);

  if (pts.length < 4) return null;

  // Centroid
  let cx = 0, cy = 0;
  pts.forEach(p => { cx += p.x; cy += p.y; });
  cx /= pts.length;
  cy /= pts.length;

  // Expand outward from centroid
  return pts.map(p => {
    const dx = p.x - cx, dy = p.y - cy;
    const len = Math.hypot(dx, dy) || 1;
    return { x: p.x + (dx / len) * expandPx, y: p.y + (dy / len) * expandPx };
  });
}

/**
 * Apply teeth enamel clip to ctx. Caller must ctx.save() before.
 * @param {number} expandPx — how much to expand beyond tight whitening mask (braces need more room)
 * @returns {boolean} whether clip was applied
 */
export function clipToTeethEnamel(ctx, landmarks, iw, ih, expandPx = 8) {
  // Use lip corners + inner teeth landmarks for a reliable bounding path
  const lip13 = landmarks?.[13];
  const lip14 = landmarks?.[14];
  const com61 = landmarks?.[61];
  const com291 = landmarks?.[291];

  if (!lip13 || !lip14 || !com61 || !com291) {
    // Ultra-fallback: use oval from passed parameters (caller handles)
    return false;
  }

  const pts = getTeethHullPoints(landmarks, iw, ih, expandPx);
  if (!pts || pts.length < 3) return false;

  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.clip();
  return true;
}

/**
 * Get tightened whitening mask polygon (for whitening pass only — not braces).
 * Insets from outer lip/gum landmarks.
 */
export function getWhiteningMaskPoints(landmarks, iw, ih) {
  const INNER_IDX = [13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95, 78, 191, 80, 81, 82];

  const lip13 = landmarks?.[13];
  const lip14 = landmarks?.[14];
  if (!lip13 || !lip14) return null;

  const midY = ((lip13.y + lip14.y) / 2) * ih;

  const pts = INNER_IDX
    .map(idx => {
      const p = landmarks?.[idx];
      if (!p || typeof p.x !== 'number') return null;
      return { x: p.x * iw, y: p.y * ih };
    })
    .filter(Boolean);

  if (pts.length < 3) return null;

  // Inset from centroid
  let cx = 0, cy = 0;
  pts.forEach(p => { cx += p.x; cy += p.y; });
  cx /= pts.length;
  cy /= pts.length;

  const INSET = 4;
  return pts.map(p => {
    const dx = p.x - cx, dy = p.y - cy;
    const len = Math.hypot(dx, dy) || 1;
    return { x: p.x - (dx / len) * INSET, y: p.y - (dy / len) * INSET };
  });
}

/**
 * Clip ctx to whitening mask polygon.
 * @returns {boolean}
 */
export function clipToWhiteningMask(ctx, landmarks, iw, ih) {
  const pts = getWhiteningMaskPoints(landmarks, iw, ih);
  if (!pts || pts.length < 3) return false;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.clip();
  return true;
}

/**
 * Erase braces overlay above upper lip (destination-out pass).
 * Prevents brackets from bleeding onto lips.
 */
export function eraseAboveUpperLip(ctx, landmarks, iw, ih, mouthOpen) {
  if (!landmarks?.length) return;

  const LIP_IDX = [61, 185, 40, 39, 37, 267, 269, 270, 409, 291];
  const pts = LIP_IDX
    .map(idx => {
      const p = landmarks?.[idx];
      if (!p || typeof p.x !== 'number') return null;
      return { x: p.x * iw, y: p.y * ih };
    })
    .filter(Boolean);

  if (pts.length < 3) return;

  const dy = clamp((mouthOpen || 20) * 0.08, 3, 14);

  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(iw, 0);
  ctx.lineTo(iw, pts[pts.length - 1].y + dy);
  for (let k = pts.length - 1; k >= 0; k--) ctx.lineTo(pts[k].x, pts[k].y + dy);
  ctx.lineTo(0, pts[0].y + dy);
  ctx.closePath();
  ctx.fillStyle = '#000';
  ctx.filter = 'blur(5px)';
  ctx.fill();
  ctx.filter = 'none';
  ctx.restore();
}
