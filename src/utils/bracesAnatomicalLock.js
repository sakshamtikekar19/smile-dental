/**
 * Enamel-bound braces: primary = one bracket per MediaPipe tooth-row landmark (upper/lower counts match arch indices);
 * optional per-stud enamel refinement on the merged bitmap; histogram slotting is fallback only.
 */

import {
  landmarkToPx,
  reprojectBracesPackAfterStudMove,
  applyRadialMolarEnrollment,
  buildStudRowsFromLandmarkTeeth,
} from "./bracesGeometry";
import { TEETH_WHITEN_MASK_INDICES } from "./teethWhitenMaskIndices";

const INNER_LIP_UPPER_IDX = 13;
const INNER_LIP_LOWER_IDX = 14;

const UPPER_Z_INDICES = [312, 311, 310, 415, 308, 324, 318, 402, 317, 13];
const LOWER_Z_INDICES = [78, 191, 80, 81, 82, 87, 178, 88, 95, 14];

const LUM_MIN = 15;
const LUM_MAX = 252;
const SAT_MAX = 0.58;

const MIN_COLUMN_ENAMEL_EDGE_PX = 2;
const MIN_COLUMN_ENAMEL_PX = 4;
const MIN_SLOT_ENAMEL_FRACTION = 0.1;
const MIN_ENAMEL_PIXELS_ABS = 8;
const SAFE_ZONE_FRAC = 0.25;
const MASK_HULL_PAD_X_PX = 18;

/** ~px per tooth when guessing slot count from span (fallback only). */
const FALLBACK_TOOTH_PX_EST = 26;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function isEnamelLike(r, g, b) {
  const maxc = Math.max(r, g, b);
  const minc = Math.min(r, g, b);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const sat = maxc === 0 ? 0 : (maxc - minc) / maxc;
  return lum >= LUM_MIN && lum <= LUM_MAX && sat <= SAT_MAX;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("anatomical lock: image load failed"));
    img.src = src;
  });
}

function teethWhitenMaskHorizontalBounds(landmarks, iw, ih) {
  let minX = Infinity;
  let maxX = -Infinity;
  for (const idx of TEETH_WHITEN_MASK_INDICES) {
    const p = landmarkToPx(landmarks, idx, iw, ih);
    if (!p) continue;
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
  }
  if (!Number.isFinite(minX) || maxX - minX < 8) return null;
  const pad = MASK_HULL_PAD_X_PX;
  return {
    scanX0: clamp(minX - pad, 0, iw - 1),
    scanX1: clamp(maxX + pad, 0, iw - 1),
  };
}

function sampleZAtX(landmarks, iw, ih, indices, xTarget) {
  let bestZ = 0;
  let bestD = Infinity;
  for (const idx of indices) {
    const p = landmarks[idx];
    if (!p || typeof p.x !== "number") continue;
    const x = p.x * iw;
    const d = Math.abs(x - xTarget);
    if (d < bestD) {
      bestD = d;
      bestZ = typeof p.z === "number" ? p.z : 0;
    }
  }
  return bestZ;
}

function attachZToStuds(studs, landmarks, iw, ih, upper) {
  const indices = upper ? UPPER_Z_INDICES : LOWER_Z_INDICES;
  return studs.map((s) => ({
    ...s,
    z: sampleZAtX(landmarks, iw, ih, indices, s.x),
  }));
}

function columnHistogram(data, width, height, x0, x1, y0, y1) {
  const hist = new Int32Array(width);
  const xa = clamp(Math.floor(x0), 0, width - 1);
  const xb = clamp(Math.ceil(x1), 0, width - 1);
  const ya = clamp(Math.floor(y0), 0, height - 1);
  const yb = clamp(Math.ceil(y1), 0, height - 1);
  for (let x = xa; x <= xb; x++) {
    let c = 0;
    for (let y = ya; y <= yb; y++) {
      const i = (y * width + x) * 4;
      if (isEnamelLike(data[i], data[i + 1], data[i + 2])) c++;
    }
    hist[x] = c;
  }
  return hist;
}

function enamelSpanFromHistogram(hist, width, xa, xb) {
  const x0 = clamp(Math.floor(xa), 0, width - 1);
  const x1 = clamp(Math.ceil(xb), 0, width - 1);
  const spanW = x1 - x0;
  const edgeW = Math.max(8, spanW * 0.12);

  const scan = (edgePx, interiorPx) => {
    let minX = -1;
    let maxX = -1;
    for (let x = x0; x <= x1; x++) {
      const atEdge = spanW > 24 && (x <= x0 + edgeW || x >= x1 - edgeW);
      const thresh = atEdge ? edgePx : interiorPx;
      if (hist[x] >= thresh) {
        if (minX < 0) minX = x;
        maxX = x;
      }
    }
    return minX >= 0 ? { minX, maxX } : null;
  };

  let r = scan(MIN_COLUMN_ENAMEL_EDGE_PX, MIN_COLUMN_ENAMEL_PX);
  if (!r) r = scan(MIN_COLUMN_ENAMEL_EDGE_PX, MIN_COLUMN_ENAMEL_EDGE_PX);
  if (!r || r.maxX - r.minX < 16) return null;
  return r;
}

/**
 * Snap each landmark stud to local luminance peak on the correct arch row only (upper vs lower),
 * so refiners do not jump to the opposite jawline. X drift is capped to reduce clustering.
 */
function refineStudsToEnamelInBand(data, width, height, studs, bandY0, bandY1, upper, lip13y, lip14y, halfWin = 12) {
  const ya0 = clamp(Math.floor(bandY0), 0, height - 1);
  const yb0 = clamp(Math.ceil(bandY1), 0, height - 1);
  const yMid = (lip13y + lip14y) * 0.5;
  /** Strict split at inner-lip midline — not a wide band, or valid enamel on the “wrong” row is excluded. */
  const upperRowMaxY = yMid - 1;
  const lowerRowMinY = yMid + 1;
  const out = [];
  for (const stud of studs) {
    const x0 = clamp(Math.floor(stud.x - halfWin), 0, width - 1);
    const x1 = clamp(Math.ceil(stud.x + halfWin), 0, width - 1);
    let bestLum = -1;
    let bx = stud.x;
    for (let x = x0; x <= x1; x++) {
      for (let y = ya0; y <= yb0; y++) {
        if (upper && y > upperRowMaxY) continue;
        if (!upper && y < lowerRowMinY) continue;
        const i = (y * width + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        if (!isEnamelLike(r, g, b)) continue;
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        if (lum > bestLum) {
          bestLum = lum;
          bx = x;
        }
      }
    }
    bx = clamp(bx, stud.x - 14, stud.x + 14);
    if (bestLum < 0) {
      out.push({ ...stud });
      continue;
    }
    const xc = clamp(Math.round(bx), 0, width - 1);
    let minYE = Infinity;
    let maxYE = -Infinity;
    let hits = 0;
    for (let y = ya0; y <= yb0; y++) {
      if (upper && y > upperRowMaxY) continue;
      if (!upper && y < lowerRowMinY) continue;
      const i = (y * width + xc) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (!isEnamelLike(r, g, b)) continue;
      hits++;
      if (y < minYE) minYE = y;
      if (y > maxYE) maxYE = y;
    }
    if (hits < 3 || minYE === Infinity) {
      out.push({ ...stud });
      continue;
    }
    const H = maxYE - minYE;
    const ySafeLo = minYE + SAFE_ZONE_FRAC * H;
    const ySafeHi = maxYE - SAFE_ZONE_FRAC * H;
    const yMidCol = (minYE + maxYE) * 0.5;
    let yFinal = clamp(yMidCol, ySafeLo, ySafeHi);
    if (upper) yFinal = Math.min(yFinal, upperRowMaxY);
    else yFinal = Math.max(yFinal, lowerRowMinY);
    out.push({ x: bx, y: yFinal, z: stud.z ?? 0 });
  }
  return out;
}

function slotsForSpan(spanPx) {
  return clamp(Math.round(spanPx / FALLBACK_TOOTH_PX_EST), 6, 16);
}

function studsFromHorizontalSlots(data, width, height, xMin, xMax, bandY0, bandY1, slotCount) {
  const studs = [];
  const span = xMax - xMin;
  if (span < 12) return studs;
  const ya = clamp(Math.floor(bandY0), 0, height - 1);
  const yb = clamp(Math.ceil(bandY1), 0, height - 1);
  const slotH = yb - ya + 1;

  for (let s = 0; s < slotCount; s++) {
    const t0 = xMin + (span * s) / slotCount;
    const t1 = xMin + (span * (s + 1)) / slotCount;
    const sx0 = Math.floor(t0);
    const sx1 = Math.ceil(t1) - 1;
    if (sx1 < sx0) continue;

    const slotW = sx1 - sx0 + 1;
    const slotPixels = slotW * slotH;
    if (slotPixels < 1) continue;

    let bestLum = -1;
    let bx = 0;
    let enamelPx = 0;
    let minYE = Infinity;
    let maxYE = -Infinity;

    for (let x = sx0; x <= sx1; x++) {
      if (x < 0 || x >= width) continue;
      for (let y = ya; y <= yb; y++) {
        const i = (y * width + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        if (!isEnamelLike(r, g, b)) continue;
        enamelPx++;
        if (y < minYE) minYE = y;
        if (y > maxYE) maxYE = y;
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        if (lum > bestLum) {
          bestLum = lum;
          bx = x;
        }
      }
    }

    if (enamelPx < MIN_ENAMEL_PIXELS_ABS) continue;
    if (enamelPx / slotPixels < MIN_SLOT_ENAMEL_FRACTION) continue;
    if (bestLum < 0 || minYE === Infinity) continue;

    const H = maxYE - minYE;
    if (H < 2) continue;

    const ySafeLo = minYE + SAFE_ZONE_FRAC * H;
    const ySafeHi = maxYE - SAFE_ZONE_FRAC * H;
    if (ySafeHi <= ySafeLo) continue;

    const yFaceMid = (minYE + maxYE) * 0.5;
    const yFinal = clamp(yFaceMid, ySafeLo, ySafeHi);

    studs.push({ x: bx, y: yFinal, z: 0 });
  }
  studs.sort((a, b) => a.x - b.x);
  return studs;
}

/**
 * @param {string} imageDataUrl — merged full-frame (post–AI), same pixels as landmarks
 */
export async function buildAnatomicalArchLockPack(imageDataUrl, landmarks, iw, ih, oval) {
  if (!landmarks?.length || !imageDataUrl) return null;

  const lip13 = landmarkToPx(landmarks, INNER_LIP_UPPER_IDX, iw, ih);
  const lip14 = landmarkToPx(landmarks, INNER_LIP_LOWER_IDX, iw, ih);
  if (!lip13 || !lip14) return null;

  const mouthOpen = Math.abs(lip14.y - lip13.y);
  if (mouthOpen < 6) return null;

  const maskX = teethWhitenMaskHorizontalBounds(landmarks, iw, ih);
  if (!maskX) return null;

  const { scanX0, scanX1 } = maskX;

  const upperY0 = lip13.y + mouthOpen * 0.035;
  const upperY1 = lip13.y + mouthOpen * 0.52;
  const lowerY0 = lip14.y - mouthOpen * 0.52;
  const lowerY1 = lip14.y - mouthOpen * 0.035;

  const landmarkRows = buildStudRowsFromLandmarkTeeth(landmarks, iw, ih);

  let data;
  let width;
  let height;
  let bitmapOk = false;
  try {
    const img = await loadImage(imageDataUrl);
    const canvas = document.createElement("canvas");
    canvas.width = iw;
    canvas.height = ih;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, iw, ih);
    const imageData = ctx.getImageData(0, 0, iw, ih);
    data = imageData.data;
    width = imageData.width;
    height = imageData.height;
    bitmapOk = true;
  } catch {
    bitmapOk = false;
  }

  let upperStuds = [];
  let lowerStuds = [];
  let usedLandmarkPrimary = false;

  if (landmarkRows) {
    usedLandmarkPrimary = true;
    if (bitmapOk) {
      upperStuds = refineStudsToEnamelInBand(
        data,
        width,
        height,
        landmarkRows.upperStuds,
        upperY0,
        upperY1,
        true,
        lip13.y,
        lip14.y,
      );
      lowerStuds = refineStudsToEnamelInBand(
        data,
        width,
        height,
        landmarkRows.lowerStuds,
        lowerY0,
        lowerY1,
        false,
        lip13.y,
        lip14.y,
      );
    } else {
      upperStuds = landmarkRows.upperStuds.map((s) => ({ ...s }));
      lowerStuds = landmarkRows.lowerStuds.map((s) => ({ ...s }));
    }
  }

  if (!usedLandmarkPrimary && bitmapOk) {
    const histU = columnHistogram(data, width, height, scanX0, scanX1, upperY0, upperY1);
    const spanU = enamelSpanFromHistogram(histU, width, scanX0, scanX1);
    const histL = columnHistogram(data, width, height, scanX0, scanX1, lowerY0, lowerY1);
    const spanL = enamelSpanFromHistogram(histL, width, scanX0, scanX1);
    if (spanU) {
      const nU = slotsForSpan(spanU.maxX - spanU.minX);
      upperStuds = studsFromHorizontalSlots(data, width, height, spanU.minX, spanU.maxX, upperY0, upperY1, nU);
    }
    if (spanL) {
      const nL = slotsForSpan(spanL.maxX - spanL.minX);
      lowerStuds = studsFromHorizontalSlots(data, width, height, spanL.minX, spanL.maxX, lowerY0, lowerY1, nL);
    }
  } else if (usedLandmarkPrimary && upperStuds.length < 2 && lowerStuds.length < 2 && bitmapOk) {
    const histU = columnHistogram(data, width, height, scanX0, scanX1, upperY0, upperY1);
    const spanU = enamelSpanFromHistogram(histU, width, scanX0, scanX1);
    const histL = columnHistogram(data, width, height, scanX0, scanX1, lowerY0, lowerY1);
    const spanL = enamelSpanFromHistogram(histL, width, scanX0, scanX1);
    if (spanU && upperStuds.length < 2) {
      upperStuds = studsFromHorizontalSlots(
        data,
        width,
        height,
        spanU.minX,
        spanU.maxX,
        upperY0,
        upperY1,
        slotsForSpan(spanU.maxX - spanU.minX),
      );
    }
    if (spanL && lowerStuds.length < 2) {
      lowerStuds = studsFromHorizontalSlots(
        data,
        width,
        height,
        spanL.minX,
        spanL.maxX,
        lowerY0,
        lowerY1,
        slotsForSpan(spanL.maxX - spanL.minX),
      );
    }
  }

  if (upperStuds.length < 2 && lowerStuds.length < 2) return null;

  if (upperStuds.length < 2) upperStuds = [];
  if (lowerStuds.length < 2) lowerStuds = [];

  if (!usedLandmarkPrimary) {
    if (upperStuds.length >= 6) upperStuds = applyRadialMolarEnrollment(upperStuds);
    if (lowerStuds.length >= 6) lowerStuds = applyRadialMolarEnrollment(lowerStuds);
  }

  upperStuds = attachZToStuds(upperStuds, landmarks, iw, ih, true);
  lowerStuds = attachZToStuds(lowerStuds, landmarks, iw, ih, false);

  const mo = landmarkRows?.mouthOpen ?? mouthOpen;

  const pack = reprojectBracesPackAfterStudMove(
    {
      wireMode: "polyline",
      upperStuds,
      lowerStuds,
      mouthOpen: mo,
    },
    iw,
    ih,
    oval,
    landmarks,
  );

  return pack?.upperStuds?.length >= 2 || pack?.lowerStuds?.length >= 2 ? pack : null;
}
