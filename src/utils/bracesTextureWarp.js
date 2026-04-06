/**
 * AI texture (or synthetic atlas) + geometry: slice horizontal strip, place each segment on dental arc.
 * Placement uses buildGeometricBracesPack upperStuds / upperAnchors only — not AI coordinates.
 */

import { BRACKET_VISUAL_SCALE, landmarkToPx } from "./bracesGeometry";

const UPPER_LIP_OCCLUDER = [61, 185, 40, 39, 37, 267, 269, 270, 409, 291];

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, rr);
  } else {
    ctx.rect(x, y, w, h);
  }
}

/** Procedural straight “front” braces strip when no Replicate texture is returned. */
export function createSyntheticBracesAtlas(segmentCount = 12, aw = 720, ah = 112) {
  const c = document.createElement("canvas");
  c.width = aw;
  c.height = ah;
  const g = c.getContext("2d");
  if (!g) return c;

  g.fillStyle = "#e4e6ed";
  g.fillRect(0, 0, aw, ah);

  const cy = ah * 0.5;
  g.strokeStyle = "rgba(55,58,68,0.92)";
  g.lineWidth = 5;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(10, cy);
  g.lineTo(aw - 10, cy);
  g.stroke();

  g.strokeStyle = "rgba(210,212,222,0.85)";
  g.lineWidth = 1.4;
  g.beginPath();
  g.moveTo(10, cy - 2.5);
  g.lineTo(aw - 10, cy - 2.5);
  g.stroke();

  const n = Math.max(4, Math.min(16, segmentCount | 0));
  const innerW = aw - 20;
  const sw = innerW / n;

  for (let i = 0; i < n; i++) {
    const x = 10 + i * sw;
    const bw = sw * 0.64;
    const bh = ah * 0.56;
    const gx = x + (sw - bw) * 0.5;
    const gy = cy - bh * 0.5;
    const grd = g.createLinearGradient(gx, gy, gx + bw, gy + bh);
    grd.addColorStop(0, "#ffffff");
    grd.addColorStop(0.28, "#d4d4dc");
    grd.addColorStop(0.58, "#8c8e98");
    grd.addColorStop(1, "#3a3c44");
    g.fillStyle = grd;
    roundRectPath(g, gx, gy, bw, bh, 3.2);
    g.fill();
    g.strokeStyle = "rgba(0,0,0,0.28)";
    g.lineWidth = 0.85;
    g.stroke();
    g.fillStyle = "rgba(18,20,26,0.78)";
    g.fillRect(gx + bw * 0.28, cy - 1.3, bw * 0.44, 2.6);
  }

  return c;
}

export function loadImageFromSrc(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("braces texture load failed"));
    img.src = src;
  });
}

const ATLAS_TARGET_W = 720;
const ATLAS_TARGET_H = 96;
/** Wide horizontal strip; square/tall Replicate outputs break column slicing → giant quads / X artifacts. */
const MIN_ATLAS_ASPECT = 2.0;

/** Rasterize AI (or synthetic) into a fixed wide strip for stable per-bracket slices. */
export async function prepareBracesAtlasCanvas(sourceDataUrl, segmentCount) {
  const nSeg = Math.max(8, Math.min(16, Math.round(segmentCount) || 10));
  if (!sourceDataUrl || typeof sourceDataUrl !== "string") {
    return createSyntheticBracesAtlas(nSeg);
  }
  try {
    const img = await loadImageFromSrc(sourceDataUrl);
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (iw < 64 || ih < 20) return createSyntheticBracesAtlas(nSeg);

    const aspect = iw / ih;
    if (aspect < MIN_ATLAS_ASPECT || ih > iw * 0.52) {
      return createSyntheticBracesAtlas(nSeg);
    }

    const c = document.createElement("canvas");
    c.width = ATLAS_TARGET_W;
    c.height = ATLAS_TARGET_H;
    const x = c.getContext("2d");
    if (!x) return createSyntheticBracesAtlas(nSeg);
    x.fillStyle = "#e0e2ea";
    x.fillRect(0, 0, ATLAS_TARGET_W, ATLAS_TARGET_H);
    x.drawImage(img, 0, 0, iw, ih, 0, 0, ATLAS_TARGET_W, ATLAS_TARGET_H);
    return c;
  } catch {
    return createSyntheticBracesAtlas(nSeg);
  }
}

/**
 * One arch: AI atlas slices placed on landmark-resampled studs (not AI placement).
 * @param {'upper'|'lower'} arch
 */
function drawWarpedArchSegments(ctx, atlas, studs, anchors, opts = {}) {
  const arch = opts.arch ?? "upper";
  const baseToothDepth = typeof opts.toothDepthPx === "number" ? opts.toothDepthPx : 4.2;
  const depth =
    arch === "lower" ? -Math.abs(baseToothDepth) * 0.92 : Math.abs(baseToothDepth);
  const baseHScale = typeof opts.baseHScale === "number" ? opts.baseHScale : arch === "lower" ? 0.86 : 0.9;

  if (!atlas || !anchors?.length || !studs?.length) return;

  const n = Math.min(anchors.length, studs.length);
  if (n < 1) return;

  const aw = atlas.width;
  const ah = atlas.height;
  const slotW = aw / n;
  const maxD = Math.max((n - 1) / 2, 0.5);

  const steps = [];
  for (let j = 1; j < n; j++) {
    const dx = studs[j].x - studs[j - 1].x;
    const dy = studs[j].y - studs[j - 1].y;
    const d = Math.hypot(dx, dy);
    if (Number.isFinite(d) && d > 1) steps.push(d);
  }
  steps.sort((a, b) => a - b);
  const medStep = steps.length ? steps[Math.floor(steps.length * 0.5)] : 36;
  const maxW = clamp(medStep * 0.92, 22, 52);
  const maxH = clamp(medStep * 0.68, 18, 42);

  for (let i = 0; i < n; i++) {
    const a = anchors[i];
    const s = studs[i];
    if (
      !Number.isFinite(s.x) ||
      !Number.isFinite(s.y) ||
      !Number.isFinite(a?.ang ?? 0)
    ) {
      continue;
    }

    const sx = i * slotW;
    const dist = Math.abs(i - (n - 1) / 2);
    const persp = Math.max(0.55, 1 - (dist / maxD) * 0.2);
    const sz = clamp(a.scaleZ ?? 1, 0.7, 1.12);
    const sc = persp * sz;
    let dw = slotW * sc * 0.96;
    let dh = ah * baseHScale * sc;
    const shrink = Math.min(1, maxW / Math.max(dw, 1e-6), maxH / Math.max(dh, 1e-6));
    dw *= shrink * BRACKET_VISUAL_SCALE;
    dh *= shrink * BRACKET_VISUAL_SCALE;

    const x = s.x;
    const y = s.y + depth;

    ctx.save();
    ctx.globalAlpha *= clamp(a.depthOpacity ?? 1, 0.62, 1);
    ctx.translate(x, y);
    ctx.rotate((a.ang ?? 0) + Math.PI / 2);
    ctx.shadowColor = "rgba(0,0,0,0.28)";
    ctx.shadowBlur = 3;
    ctx.shadowOffsetX = 0.5;
    ctx.shadowOffsetY = arch === "lower" ? -1.5 : 2;
    ctx.drawImage(atlas, sx, 0, slotW, ah, -dw * 0.5, -dh * 0.5, dw, dh);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.shadowOffsetX = 0;
    ctx.restore();
  }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLCanvasElement} atlas — upper arch (segment count = upper brackets)
 * @param {object} pack — from buildGeometricBracesPack
 * @param {object} [opts] — toothDepthPx, baseHScale; pass lowerAtlas + drawLower:true to paint lower arch
 */
export function drawWarpedBracesSegments(ctx, atlas, pack, opts = {}) {
  const toothDepthPx = typeof opts.toothDepthPx === "number" ? opts.toothDepthPx : 4.2;
  const { upperStuds, upperAnchors, lowerStuds, lowerAnchors } = pack;

  drawWarpedArchSegments(ctx, atlas, upperStuds, upperAnchors, {
    ...opts,
    arch: "upper",
    toothDepthPx,
  });

  const lowerAtlas = opts.lowerAtlas;
  if (
    opts.drawLower !== false &&
    lowerAtlas &&
    lowerStuds?.length &&
    lowerAnchors?.length
  ) {
    drawWarpedArchSegments(ctx, lowerAtlas, lowerStuds, lowerAnchors, {
      ...opts,
      arch: "lower",
      toothDepthPx,
    });
  }
}

/** Erase overlay above upper lip line so brackets appear tucked behind lip (soft edge). */
export function applyUpperLipBracesOcclusion(ctx, landmarks, iw, ih, mouthOpen = 24) {
  if (!landmarks?.length) return;
  const pts = UPPER_LIP_OCCLUDER.map((idx) => landmarkToPx(landmarks, idx, iw, ih)).filter(Boolean);
  if (pts.length < 3) return;

  const dy = clamp((mouthOpen || 24) * 0.11, 5, 20);

  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(iw, 0);
  ctx.lineTo(iw, pts[pts.length - 1].y + dy);
  for (let k = pts.length - 1; k >= 0; k--) ctx.lineTo(pts[k].x, pts[k].y + dy);
  ctx.lineTo(0, pts[0].y + dy);
  ctx.closePath();
  ctx.fillStyle = "#000";
  ctx.filter = "blur(6px)";
  ctx.fill();
  ctx.filter = "none";
  ctx.restore();
}
