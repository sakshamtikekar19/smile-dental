/**
 * TEETH_WHITEN polygon (tightened) — shared by whitening, braces vector clip, and overlay texture clip.
 */

import { TEETH_WHITEN_MASK_INDICES } from "./teethWhitenMaskIndices";

const GUM_CLEARANCE_PX = 5;
const LOWER_GUM_CLEARANCE_PX = 8;
const WHITEN_MASK_LIP_INSET_PX = 5;
const WHITEN_MASK_LIP_INSET_CORNER_PX = 6;
const LIP_GUM_LANDMARK_GUARD_PX = 5;
const MOUTH_PERIMETER_INDICES = [61, 291, 17, 13, 14, 78, 308, 181];

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Gum clearance + inner inset; keeps paint/braces off lips vs bare enamel.
 */
export function getTightenedWhiteningMaskPoints(landmarks, iw, ih) {
  const p13 = landmarks[13];
  const p14 = landmarks[14];
  if (!p13 || !p14) return null;
  const midYpx = ((p13.y + p14.y) / 2) * ih;
  const pts = TEETH_WHITEN_MASK_INDICES.map((idx) => {
    const p = landmarks[idx];
    if (!p || typeof p.x !== "number") return null;
    return { x: p.x * iw, y: p.y * ih };
  }).filter(Boolean);
  if (pts.length < 3) return null;
  const out = pts.map((p) => ({ x: p.x, y: p.y }));
  const lower = out.filter((p) => p.y > midYpx - 0.5);
  if (lower.length >= 2) {
    const lowerGumY = Math.min(...lower.map((p) => p.y));
    const lowerLipY = Math.max(...lower.map((p) => p.y));
    const span = Math.max(6, lowerLipY - lowerGumY);
    const yMaxSafe = lowerLipY - LOWER_GUM_CLEARANCE_PX;
    const yMinLower = Math.min(lowerGumY + span * 0.4, yMaxSafe - 4);
    out.forEach((p) => {
      if (p.y > midYpx - 0.5) {
        p.y = Math.max(p.y, yMinLower);
        p.y = Math.min(p.y, yMaxSafe);
      }
    });
  }
  const upper = out.filter((p) => p.y <= midYpx + 0.5);
  if (upper.length >= 2) {
    const upperGumY = Math.min(...upper.map((p) => p.y));
    const upperToothY = Math.max(...upper.map((p) => p.y));
    const span = Math.max(6, upperToothY - upperGumY);
    const yMinSafe = Math.max(upperGumY + GUM_CLEARANCE_PX, upperGumY + GUM_CLEARANCE_PX + span * 0.1);
    out.forEach((p) => {
      if (p.y <= midYpx + 0.5) p.y = Math.max(p.y, yMinSafe);
    });
  }
  const cx = out.reduce((s, p) => s + p.x, 0) / out.length;
  const cy = out.reduce((s, p) => s + p.y, 0) / out.length;
  const xs = out.map((p) => p.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const cornerBand = Math.max(20, (maxX - minX) * 0.2);
  out.forEach((p) => {
    const nearCorner = p.x <= minX + cornerBand || p.x >= maxX - cornerBand;
    const inset = nearCorner ? WHITEN_MASK_LIP_INSET_CORNER_PX : WHITEN_MASK_LIP_INSET_PX;
    const dx = p.x - cx;
    const dy = p.y - cy;
    const len = Math.hypot(dx, dy) || 1;
    p.x -= (dx / len) * inset;
    p.y -= (dy / len) * inset;
  });
  const lipGumPx = [...new Set([...MOUTH_PERIMETER_INDICES, 312, 308, 415, 310])]
    .map((idx) => landmarks[idx])
    .filter((p) => p && typeof p.x === "number")
    .map((p) => ({ x: p.x * iw, y: p.y * ih }));
  const g = LIP_GUM_LANDMARK_GUARD_PX;
  out.forEach((p) => {
    lipGumPx.forEach((L) => {
      const dx = p.x - L.x;
      const dy = p.y - L.y;
      const d = Math.hypot(dx, dy);
      if (d < g && d > 1e-6) {
        const push = (g - d) / d;
        p.x += dx * push;
        p.y += dy * push;
      }
    });
  });
  return out;
}

/**
 * Anti-lip shield: clip all subsequent drawing to enamel hull. Caller must `ctx.save()` before.
 * @returns {boolean} whether clip was applied
 */
export function clipBracesToTeethEnamel(ctx, landmarks, iw, ih) {
  const pts = getTightenedWhiteningMaskPoints(landmarks, iw, ih);
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
