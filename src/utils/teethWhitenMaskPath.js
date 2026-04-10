/**
 * TEETH_WHITEN polygon (tightened) — shared by whitening, braces vector clip, and overlay texture clip.
 */

import { TEETH_WHITEN_MASK_INDICES } from "./teethWhitenMaskIndices";

const GUM_CLEARANCE_PX = 5;
const LOWER_GUM_CLEARANCE_PX = 8;
const WHITEN_MASK_LIP_INSET_PX = 5;
const WHITEN_MASK_LIP_INSET_CORNER_PX = 0;
const LIP_GUM_LANDMARK_GUARD_PX = 0;
const MOUTH_PERIMETER_INDICES = [61, 291, 17, 13, 14, 78, 308, 181];

export function getTightenedWhiteningMaskPoints(landmarks, iw, ih, extraRadialInsetPx = 0) {
  const pts = TEETH_WHITEN_MASK_INDICES.map((idx) => {
    const p = landmarks[idx];
    if (!p || typeof p.x !== "number") return null;
    return { x: p.x * iw, y: p.y * ih };
  }).filter(Boolean);
  
  if (pts.length < 3) return null;
  const out = pts.map(p => ({ ...p }));
  
  // Calculate Centroid
  const cx = out.reduce((s, p) => s + p.x, 0) / out.length;
  const cy = out.reduce((s, p) => s + p.y, 0) / out.length;

  // Apply a gentle, proportional shrink based ONLY on the extra inset parameter.
  // Avoid heavy horizontal flattening so the mask tracks natural gum arc curves!
  if (extraRadialInsetPx > 0) {
    out.forEach((p) => {
      const dx = p.x - cx;
      const dy = p.y - cy;
      const len = Math.hypot(dx, dy) || 1;
      p.x -= (dx / len) * extraRadialInsetPx;
      p.y -= (dy / len) * extraRadialInsetPx;
    });
  }

  return out;
}

/**
 * Slightly expanded teeth hull so distal brackets/wire aren’t clipped by corner inset (whitening mask is tighter).
 */
export function getBracesTeethClipPoints(landmarks, iw, ih) {
  const pts = getTightenedWhiteningMaskPoints(landmarks, iw, ih);
  if (!pts || pts.length < 3) return null;
  let sx = 0;
  let sy = 0;
  for (const p of pts) {
    sx += p.x;
    sy += p.y;
  }
  const cx = sx / pts.length;
  const cy = sy / pts.length;
  const scale = 1.0;
  return pts.map((p) => ({
    x: cx + (p.x - cx) * scale,
    y: cy + (p.y - cy) * scale,
  }));
}

/**
 * Anti-lip shield: clip all subsequent drawing to enamel hull. Caller must `ctx.save()` before.
 * Uses an expanded hull vs whitening so buccal brackets stay visible.
 * @returns {boolean} whether clip was applied
 */
export function clipBracesToTeethEnamel(ctx, landmarks, iw, ih) {
  const pts = getBracesTeethClipPoints(landmarks, iw, ih);
  if (!pts || pts.length < 3) return false;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.clip();
  return true;
}
