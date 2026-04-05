/**
 * Post-merge enamel centroid snap: shift each parabolic stud onto local high-confidence enamel (RGB heuristics).
 * Runs on the merged result so AI straightening and geometry stay aligned.
 */

const LUM_MIN = 15;
const LUM_MAX = 252;
const SAT_MAX = 0.58;
const MIN_WEIGHT_SUM = 2.5;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("enamel snap: image load failed"));
    img.src = src;
  });
}

/**
 * Weighted centroid of enamel-like pixels in a window around (px, py).
 * @param {'upper'|'lower'} arch — search bias along tooth normal
 */
function enamelCentroidWindow(data, width, height, px, py, arch) {
  const halfW = 20;
  const halfH = arch === "upper" ? 15 : 15;
  const biasY = arch === "upper" ? 4 : -4;

  const x0 = Math.floor(clamp(px - halfW, 0, width - 1));
  const x1 = Math.ceil(clamp(px + halfW, 0, width - 1));
  const y0 = Math.floor(clamp(py - halfH + biasY, 0, height - 1));
  const y1 = Math.ceil(clamp(py + halfH + biasY, 0, height - 1));

  let sumX = 0;
  let sumY = 0;
  let wsum = 0;

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const maxc = Math.max(r, g, b);
      const minc = Math.min(r, g, b);
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const sat = maxc === 0 ? 0 : (maxc - minc) / maxc;
      if (lum < LUM_MIN || lum > LUM_MAX || sat > SAT_MAX) continue;
      const w = 0.35 + (lum / 255) * 0.65;
      sumX += x * w;
      sumY += y * w;
      wsum += w;
    }
  }

  if (wsum < MIN_WEIGHT_SUM) return { x: px, y: py };
  return { x: sumX / wsum, y: sumY / wsum };
}

function snapStudRow(data, width, height, studs, arch) {
  if (!studs?.length) return studs;
  return studs.map((s) => {
    const c = enamelCentroidWindow(data, width, height, s.x, s.y, arch);
    return { ...s, x: c.x, y: c.y, z: s.z ?? 0 };
  });
}

/**
 * @param {string} imageDataUrl — merged full-frame JPEG/PNG
 * @param {{ x: number, y: number, z?: number }[]} upperStuds
 * @param {{ x: number, y: number, z?: number }[]} lowerStuds
 * @param {number} iw
 * @param {number} ih
 */
export async function snapBracesStudsToEnamel(imageDataUrl, upperStuds, lowerStuds, iw, ih) {
  try {
    const img = await loadImage(imageDataUrl);
    const canvas = document.createElement("canvas");
    canvas.width = iw;
    canvas.height = ih;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return { upperStuds, lowerStuds };
    ctx.drawImage(img, 0, 0, iw, ih);
    const { data, width, height } = ctx.getImageData(0, 0, iw, ih);

    return {
      upperStuds: snapStudRow(data, width, height, upperStuds, "upper"),
      lowerStuds: snapStudRow(data, width, height, lowerStuds || [], "lower"),
    };
  } catch {
    return { upperStuds, lowerStuds: lowerStuds || [] };
  }
}
