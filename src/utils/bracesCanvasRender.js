/**
 * Canvas 2D: archwire + 3D-style brackets (geometry supplied by bracesDentalArc / bracesGeometry).
 */

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Trace smooth arch as polyline (dense samples recommended).
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number }[]} upper
 * @param {{ x: number, y: number }[]} [lower] optional second segment (same canvas path)
 */
function traceArchPolyline(ctx, upper, lower) {
  if (!upper?.length || upper.length < 2) return;
  ctx.moveTo(upper[0].x, upper[0].y);
  for (let i = 1; i < upper.length; i++) {
    ctx.lineTo(upper[i].x, upper[i].y);
  }
  if (lower?.length >= 2) {
    ctx.moveTo(lower[0].x, lower[0].y);
    for (let i = 1; i < lower.length; i++) {
      ctx.lineTo(lower[i].x, lower[i].y);
    }
  }
}

/**
 * Archwire: shadow stroke → metallic body → thin highlight.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number }[]} wireSamplesUpper
 * @param {{ x: number, y: number }[]} [wireSamplesLower]
 * @param {{ lineWidth?: number, clipMouth?: { cx: number, cy: number, rx: number, ry: number }, mouthOpen?: number }} [opts]
 */
export function renderWire(ctx, wireSamplesUpper, wireSamplesLower, opts = {}) {
  const wireDarkW = typeof opts.lineWidth === "number" ? opts.lineWidth : 3;
  const clipMouth = opts.clipMouth;
  const mouthOpen = typeof opts.mouthOpen === "number" ? opts.mouthOpen : 0;
  const up = wireSamplesUpper;
  const lo = wireSamplesLower;
  const hasUpper = up?.length >= 2;
  const hasLower = lo?.length >= 2;
  if (!hasUpper && !hasLower) return;

  const buildPath = () => {
    ctx.beginPath();
    if (hasUpper) traceArchPolyline(ctx, up, hasLower ? lo : null);
    else if (hasLower) traceArchPolyline(ctx, lo, null);
  };

  ctx.save();
  if (clipMouth && clipMouth.rx > 0 && clipMouth.ry > 0) {
    const { cx, cy, rx, ry } = clipMouth;
    const openPad = Math.min(ry * 0.4, Math.max(5, mouthOpen * 0.14));
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 1.07, ry + openPad, 0, 0, Math.PI * 2);
    ctx.clip();
  }
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.setLineDash([]);

  buildPath();
  ctx.strokeStyle = "rgba(48,50,54,0.92)";
  ctx.lineWidth = wireDarkW + 2.6;
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 5;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2.2;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  buildPath();
  ctx.strokeStyle = "rgba(158,160,168,1)";
  ctx.lineWidth = wireDarkW + 0.35;
  ctx.stroke();

  buildPath();
  ctx.strokeStyle = "rgba(255,255,255,0.82)";
  ctx.lineWidth = Math.max(0.5, wireDarkW * 0.36);
  ctx.stroke();

  ctx.restore();
}

/**
 * Single metallic bracket (gradient roundRect + slot + rim).
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} br — x, y, ang, wMult, hMult, scaleZ, depthOpacity, star?
 * @param {number} baseW
 * @param {number} baseH
 * @param {boolean} [starFlare]
 * @param {boolean} [omitDropShadow]
 */
export function renderBracket3D(ctx, br, baseW, baseH, starFlare = false, omitDropShadow = false, angBias = 0) {
  const {
    x,
    y,
    ang,
    wMult = 1,
    hMult,
    scaleZ = 1,
    depthOpacity = 1,
  } = br;
  const hm = hMult ?? wMult;
  const sz = clamp(scaleZ, 0.7, 1.15);
  const side = Math.max(2.5, baseW * wMult * sz);
  const deep = Math.max(side * 0.9, baseH * hm * sz);
  const r = clamp(side * 0.12, 0.8, side * 0.22);
  const hw = side * 0.5;
  const hh = deep * 0.5;

  ctx.save();
  ctx.globalAlpha *= clamp(depthOpacity, 0.62, 1);
  ctx.translate(x, y);
  ctx.rotate((ang ?? 0) + angBias + Math.PI / 2);

  if (!omitDropShadow) {
    ctx.shadowColor = "rgba(0,0,0,0.32)";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 2;
  }

  const grad = ctx.createLinearGradient(-hw, -hh, hw, hh);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(0.28, "#d8d8dc");
  grad.addColorStop(0.55, "#8e9098");
  grad.addColorStop(1, "#3a3c44");

  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(-hw, -hh, side, deep, r);
  } else {
    ctx.rect(-hw, -hh, side, deep);
  }
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.shadowOffsetX = 0;

  ctx.fillStyle = "rgba(22,24,30,0.82)";
  const gw = side * 0.38;
  const gh = Math.max(1.2, deep * 0.12);
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(-gw * 0.5, -gh * 0.5, gw, gh, gh * 0.35);
  } else {
    ctx.rect(-gw * 0.5, -gh * 0.5, gw, gh);
  }
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.42)";
  ctx.lineWidth = Math.max(0.55, side * 0.06);
  ctx.beginPath();
  ctx.moveTo(-hw * 0.88, -hh * 0.88);
  ctx.lineTo(hw * 0.55, -hh * 0.88);
  ctx.stroke();

  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(-hw, -hh, side, deep, r);
  } else {
    ctx.rect(-hw, -hh, side, deep);
  }
  ctx.strokeStyle = "rgba(0,0,0,0.32)";
  ctx.lineWidth = 0.85;
  ctx.stroke();

  if (starFlare) {
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = Math.max(0.35, side * 0.04);
    ctx.beginPath();
    ctx.moveTo(-hw * 0.1, -hh * 0.35);
    ctx.lineTo(hw * 0.08, -hh * 0.22);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object[]} anchors
 * @param {number} baseW
 * @param {number} baseH
 * @param {{ omitStudShadow?: boolean, angBias?: number }} [opts] — angBias π for lower-arch vector studs vs tangent-only texture
 */
export function renderBrackets(ctx, anchors, baseW, baseH, opts = {}) {
  const { omitStudShadow = false, angBias = 0 } = opts;
  if (!anchors?.length) return;
  anchors.forEach((br) => {
    renderBracket3D(ctx, br, baseW, baseH, Boolean(br.star), omitStudShadow, angBias);
  });
}
