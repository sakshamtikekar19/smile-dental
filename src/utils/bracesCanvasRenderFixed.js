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
 * Draw a single metallic bracket at (x, y) with given transform.
 * Mandate 1: No drawImage. Mandate 2: Save/Restore state isolation.
 */
export function drawBracket(ctx, x, y, ang, wMult, hMult, depthOpacity, baseW, baseH, angBias = 0) {
  const w = Math.max(4, baseW * wMult);
  const h = Math.max(4, baseH * hMult);

  ctx.save();
  ctx.globalAlpha *= clamp(depthOpacity, 0.6, 1.0);
  ctx.translate(x, y);
  ctx.rotate(ang + angBias);

  // Mandate 1: Simple geometric rectangle (silver/grey)
  ctx.fillStyle = '#C0C0C0'; 
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 2;
  ctx.shadowOffsetY = 1;

  ctx.fillRect(-w / 2, -h / 2, w, h);

  // Subtle metallic highlight line
  ctx.fillStyle = '#E2E8F0';
  ctx.fillRect(-w * 0.4, -h * 0.4, w * 0.8, h * 0.1);

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
