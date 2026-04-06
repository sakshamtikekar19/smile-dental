/**
 * Surgical arch-lock (enamel-bound):
 * — Span: far-left/right from TEETH_WHITEN x-band (not lip corners).
 * — Slots: 14/12; X = luminance peak on enamel; Y = vertical center of each slot’s enamel face (clamped to 25% safe band).
 * — Radial: terminal molars nudged 5% toward midline after slotting.
 * — Clip: teethWhitenMaskPath.clipBracesToTeethEnamel in renderer (not here).
 */

import { landmarkToPx, reprojectBracesPackAfterStudMove, applyRadialMolarEnrollment } from "./bracesGeometry";
import { TEETH_WHITEN_MASK_INDICES } from "./teethWhitenMaskIndices";

const INNER_LIP_UPPER_IDX = 13;
const INNER_LIP_LOWER_IDX = 14;

/** Upper / lower tooth contours for sampling MediaPipe z at stud x. */
const UPPER_Z_INDICES = [312, 311, 310, 415, 308, 324, 318, 402, 317, 13];
const LOWER_Z_INDICES = [78, 191, 80, 81, 82, 87, 178, 88, 95, 14];

const LUM_MIN = 15;
const LUM_MAX = 252;
const SAT_MAX = 0.58;

const UPPER_SLOT_COUNT = 14;
const LOWER_SLOT_COUNT = 12;
/** Distal molar columns can be dark; allow first/last enamel hits with a low floor. */
const MIN_COLUMN_ENAMEL_EDGE_PX = 2;
/** Interior columns: stricter to reduce cheek noise. */
const MIN_COLUMN_ENAMEL_PX = 4;
/** Slot must be at least this fraction enamel (else gap → skip bracket). */
const MIN_SLOT_ENAMEL_FRACTION = 0.1;
const MIN_ENAMEL_PIXELS_ABS = 8;
/** Inner 50% of crown height: 25% margin from gum and from incisal edge. */
const SAFE_ZONE_FRAC = 0.25;
/** Horizontal pad (px) outside TEETH_WHITEN hull x-range for column scan. */
const MASK_HULL_PAD_X_PX = 18;

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

/**
 * Far-left / far-right x of the TEETH_WHITEN landmark hull (ignores lip commissures 61/291).
 */
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

/**
 * Far-left / far-right columns with enamel; relaxed threshold in distal ~12% so dark molars still anchor the arch.
 */
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
 * 14 / 12 equal vertical slots. X = luminance peak on enamel. Y = midpoint of enamel column (visible face center).
 */
function studsFromHorizontalSlots(data, width, height, xMin, xMax, bandY0, bandY1, slotCount, _lipY, _upper) {
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

  let img;
  try {
    img = await loadImage(imageDataUrl);
  } catch {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = iw;
  canvas.height = ih;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, iw, ih);
  let imageData;
  try {
    imageData = ctx.getImageData(0, 0, iw, ih);
  } catch {
    return null;
  }
  const { data, width, height } = imageData;

  const histU = columnHistogram(data, width, height, scanX0, scanX1, upperY0, upperY1);
  const spanU = enamelSpanFromHistogram(histU, width, scanX0, scanX1);

  const histL = columnHistogram(data, width, height, scanX0, scanX1, lowerY0, lowerY1);
  const spanL = enamelSpanFromHistogram(histL, width, scanX0, scanX1);

  if (!spanU && !spanL) return null;

  let upperStuds = spanU
    ? studsFromHorizontalSlots(
        data,
        width,
        height,
        spanU.minX,
        spanU.maxX,
        upperY0,
        upperY1,
        UPPER_SLOT_COUNT,
        lip13.y,
        true,
      )
    : [];
  let lowerStuds = spanL
    ? studsFromHorizontalSlots(
        data,
        width,
        height,
        spanL.minX,
        spanL.maxX,
        lowerY0,
        lowerY1,
        LOWER_SLOT_COUNT,
        lip14.y,
        false,
      )
    : [];

  if (upperStuds.length < 2 && lowerStuds.length < 2) return null;

  if (upperStuds.length < 2) upperStuds = [];
  if (lowerStuds.length < 2) lowerStuds = [];

  if (upperStuds.length >= 6) upperStuds = applyRadialMolarEnrollment(upperStuds);
  if (lowerStuds.length >= 6) lowerStuds = applyRadialMolarEnrollment(lowerStuds);

  upperStuds = attachZToStuds(upperStuds, landmarks, iw, ih, true);
  lowerStuds = attachZToStuds(lowerStuds, landmarks, iw, ih, false);

  const pack = reprojectBracesPackAfterStudMove(
    {
      wireMode: "polyline",
      upperStuds,
      lowerStuds,
      mouthOpen,
    },
    iw,
    ih,
    oval,
  );

  return pack?.upperStuds?.length >= 2 || pack?.lowerStuds?.length >= 2 ? pack : null;
}
