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
  ctx.shadowBlur = 1.5;
  ctx.shadowOffsetY = 1.5;
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
  ctx.rotate(ang + angBias);

  // Drop shadow
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 1.5;
  ctx.shadowOffsetX = 0;
  // Explicit bracket depth occlusion for non-sticker look.
  ctx.shadowOffsetY = 1.5;

  // Main body gradient (light top → dark bottom)
  const grad = ctx.createLinearGradient(-w/2, -h/2, w/2, h/2);
  grad.addColorStop(0,    '#f8fafc');
  grad.addColorStop(0.25, '#e2e8f0');
  grad.addColorStop(0.55, '#94a3b8');
  grad.addColorStop(1,    '#475569');

  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(-w*0.45, -h/2, w*0.9, h, r);
  } else {
    ctx.rect(-w*0.45, -h/2, w*0.9, h);
  }
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Cyan Elastic Ligatures (left and right tie wings)
  const bandW = w * 0.28;
  const bandH = h * 0.88;
  const bandXOffset = w * 0.24;
  const bandR = Math.max(1, bandW * 0.35);

  const drawBand = (bx, by) => {
    const bandGrad = ctx.createLinearGradient(bx - bandW/2, by - bandH/2, bx + bandW/2, by + bandH/2);
    bandGrad.addColorStop(0, '#22d3ee'); // cyan-400
    bandGrad.addColorStop(0.4, '#06b6d4'); // cyan-500
    bandGrad.addColorStop(1, '#083344'); // cyan-950

    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 1.5;
    ctx.shadowOffsetY = 0.5;

    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(bx - bandW/2, by - bandH/2, bandW, bandH, bandR);
    } else {
      ctx.rect(bx - bandW/2, by - bandH/2, bandW, bandH);
    }
    ctx.fillStyle = bandGrad;
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Specular highlight on band
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = Math.max(0.4, bandW * 0.2);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(bx - bandW * 0.15, by - bandH * 0.25);
    ctx.lineTo(bx + bandW * 0.15, by - bandH * 0.25);
    ctx.stroke();
  };

  drawBand(-bandXOffset, 0);
  drawBand(bandXOffset, 0);

  // Silver proxy-wire over the bracket (aligns with the external archwire)
  ctx.fillStyle = '#94a3b8'; // slate-400 base
  ctx.fillRect(-w/2, -h*0.06, w, h*0.12);
  ctx.fillStyle = '#ffffff'; // specular reflection
  ctx.fillRect(-w/2, -h*0.06, w, h*0.04);

  // Outer rim for bracket base
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(-w*0.45, -h/2, w*0.9, h, r);
  } else {
    ctx.rect(-w*0.45, -h/2, w*0.9, h);
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
