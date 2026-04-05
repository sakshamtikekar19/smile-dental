/**
 * Geometric-anatomical segmentation: horizontal enamel histogram + fixed slots (upper 14 / lower 12),
 * vertical enamel centroid per slot; gaps skipped. Arc span = left–right enamel extent on merged image.
 */

import { landmarkToPx, reprojectBracesPackAfterStudMove } from "./bracesGeometry";

const INNER_LIP_UPPER_IDX = 13;
const INNER_LIP_LOWER_IDX = 14;
const COMMISSURE_LEFT_IDX = 61;
const COMMISSURE_RIGHT_IDX = 291;

/** Upper / lower tooth contours for sampling MediaPipe z at stud x. */
const UPPER_Z_INDICES = [312, 311, 310, 415, 308, 324, 318, 402, 317, 13];
const LOWER_Z_INDICES = [78, 191, 80, 81, 82, 87, 178, 88, 95, 14];

const LUM_MIN = 15;
const LUM_MAX = 252;
const SAT_MAX = 0.58;

const UPPER_SLOT_COUNT = 14;
const LOWER_SLOT_COUNT = 12;
const MIN_COLUMN_ENAMEL_PX = 4;
const MIN_SEGMENT_WEIGHT = 14;

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

/**
 * Column sums of enamel-like pixels in [x0,x1] × [y0,y1].
 * @returns {Int32Array} length = width (only indices x0..x1 used)
 */
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

function enamelSpanX(hist, width, xa, xb) {
  let minX = -1;
  let maxX = -1;
  const x0 = clamp(Math.floor(xa), 0, width - 1);
  const x1 = clamp(Math.ceil(xb), 0, width - 1);
  for (let x = x0; x <= x1; x++) {
    if (hist[x] >= MIN_COLUMN_ENAMEL_PX) {
      if (minX < 0) minX = x;
      maxX = x;
    }
  }
  if (minX < 0 || maxX < 0 || maxX - minX < 16) return null;
  return { minX, maxX };
}

/**
 * One bracket per slot: weighted centroid in strip; skip if no enamel (gap).
 */
function studsFromHorizontalSlots(data, width, height, xMin, xMax, y0, y1, slotCount) {
  const studs = [];
  const span = xMax - xMin;
  if (span < 12) return studs;
  const ya = clamp(Math.floor(y0), 0, height - 1);
  const yb = clamp(Math.ceil(y1), 0, height - 1);

  for (let s = 0; s < slotCount; s++) {
    const t0 = xMin + (span * s) / slotCount;
    const t1 = xMin + (span * (s + 1)) / slotCount;
    const sx0 = Math.floor(t0);
    const sx1 = Math.ceil(t1) - 1;
    if (sx1 < sx0) continue;

    let sumX = 0;
    let sumY = 0;
    let wsum = 0;
    for (let x = sx0; x <= sx1; x++) {
      if (x < 0 || x >= width) continue;
      for (let y = ya; y <= yb; y++) {
        const i = (y * width + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        if (!isEnamelLike(r, g, b)) continue;
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const w = 0.35 + (lum / 255) * 0.65;
        sumX += x * w;
        sumY += y * w;
        wsum += w;
      }
    }
    if (wsum < MIN_SEGMENT_WEIGHT) continue;
    studs.push({ x: sumX / wsum, y: sumY / wsum, z: 0 });
  }
  studs.sort((a, b) => a.x - b.x);
  return studs;
}

/**
 * @param {string} imageDataUrl — merged full-frame (post–AI), same pixels as landmarks
 * @returns {Promise<object|null>} braces pack compatible with reprojectBracesPackAfterStudMove / texture warp
 */
export async function buildAnatomicalArchLockPack(imageDataUrl, landmarks, iw, ih, oval) {
  if (!landmarks?.length || !imageDataUrl) return null;

  const left = landmarkToPx(landmarks, COMMISSURE_LEFT_IDX, iw, ih);
  const right = landmarkToPx(landmarks, COMMISSURE_RIGHT_IDX, iw, ih);
  const lip13 = landmarkToPx(landmarks, INNER_LIP_UPPER_IDX, iw, ih);
  const lip14 = landmarkToPx(landmarks, INNER_LIP_LOWER_IDX, iw, ih);
  if (!left || !right || !lip13 || !lip14) return null;

  const mouthOpen = Math.abs(lip14.y - lip13.y);
  if (mouthOpen < 6) return null;

  const mouthW = Math.abs(right.x - left.x);
  const padX = clamp(mouthW * 0.1, 8, 36);
  const scanX0 = clamp(Math.min(left.x, right.x) - padX, 0, iw - 1);
  const scanX1 = clamp(Math.max(left.x, right.x) + padX, 0, iw - 1);

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
  const spanU = enamelSpanX(histU, width, scanX0, scanX1);

  const histL = columnHistogram(data, width, height, scanX0, scanX1, lowerY0, lowerY1);
  const spanL = enamelSpanX(histL, width, scanX0, scanX1);

  if (!spanU && !spanL) return null;

  let upperStuds = spanU
    ? studsFromHorizontalSlots(data, width, height, spanU.minX, spanU.maxX, upperY0, upperY1, UPPER_SLOT_COUNT)
    : [];
  let lowerStuds = spanL
    ? studsFromHorizontalSlots(data, width, height, spanL.minX, spanL.maxX, lowerY0, lowerY1, LOWER_SLOT_COUNT)
    : [];

  if (upperStuds.length < 2 && lowerStuds.length < 2) return null;

  if (upperStuds.length < 2) upperStuds = [];
  if (lowerStuds.length < 2) lowerStuds = [];

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
