/**
 * Fixed braces canvas renderer.
 * Draws: archwire (shadow + body + highlight) then metallic brackets.
 * Clip is applied by caller; renderer does not re-clip.
 */

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/**
 * Draw archwire polyline: dark shadow → silver body → white highlight
 */
export function drawWire(ctx, pts, lineWidth = 1.2) {
  if (!pts || pts.length < 2) return;

  const draw = () => {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  };

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Shadow stroke
  draw();
  ctx.strokeStyle = 'rgba(20,22,28,0.85)';
  ctx.lineWidth = lineWidth + 2.4;
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 2;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Silver body
  draw();
  ctx.strokeStyle = 'rgba(185,188,200,1.0)';
  ctx.lineWidth = lineWidth;
  ctx.stroke();

  // Specular highlight (thinner, shifted up slightly)
  draw();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = Math.max(0.4, lineWidth * 0.35);
  ctx.stroke();

  ctx.restore();
}

/**
 * Draw a single metallic bracket at (x, y) with given transform
 */
export function drawBracket(ctx, x, y, ang, wMult, hMult, depthOpacity, baseW, baseH, angBias = 0) {
  const w = Math.max(2, baseW * wMult);
  const h = Math.max(2, baseH * hMult);
  const r = clamp(Math.min(w, h) * 0.18, 0.8, 3.5);

  ctx.save();
  ctx.globalAlpha *= clamp(depthOpacity, 0.6, 1.0);
  ctx.translate(x, y);
  ctx.rotate(ang + angBias + Math.PI / 2);

  // Drop shadow
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 2.5;
  ctx.shadowOffsetX = 0.5;
  ctx.shadowOffsetY = 1.8;

  // Main body gradient (light top → dark bottom)
  const grad = ctx.createLinearGradient(-w/2, -h/2, w/2, h/2);
  grad.addColorStop(0,    '#f4f5f8');
  grad.addColorStop(0.25, '#d2d4dc');
  grad.addColorStop(0.55, '#9294a0');
  grad.addColorStop(1,    '#3c3e48');

  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(-w/2, -h/2, w, h, r);
  } else {
    ctx.rect(-w/2, -h/2, w, h);
  }
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Wire slot (horizontal groove)
  const slotW = w * 0.42;
  const slotH = Math.max(1.2, h * 0.14);
  ctx.fillStyle = 'rgba(18,20,26,0.85)';
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(-slotW/2, -slotH/2, slotW, slotH, slotH * 0.4);
  } else {
    ctx.rect(-slotW/2, -slotH/2, slotW, slotH);
  }
  ctx.fill();

  // Top specular line
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = Math.max(0.5, w * 0.07);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-w * 0.38, -h * 0.38);
  ctx.lineTo(w * 0.22, -h * 0.38);
  ctx.stroke();

  // Outer rim
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(-w/2, -h/2, w, h, r);
  } else {
    ctx.rect(-w/2, -h/2, w, h);
  }
  ctx.stroke();

  ctx.restore();
}

/**
 * Draw all brackets for one arch row
 */
export function drawBrackets(ctx, anchors, baseW, baseH, angBias = 0) {
  if (!anchors?.length) return;
  anchors.forEach(a => {
    drawBracket(ctx, a.x, a.y, a.ang ?? 0, a.wMult ?? 1, a.hMult ?? 0.85,
      a.depthOpacity ?? 1, baseW, baseH, angBias);
  });
}
