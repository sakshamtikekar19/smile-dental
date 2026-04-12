/**
 * Fixed braces canvas renderer.
 * Draws: archwire (shadow + body + highlight) then metallic brackets.
 * Clip is applied by caller; renderer does not re-clip.
 */

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/**
 * Draw robust archwire: dark shadow → silver body → white highlight
 */
export function drawWire(ctx, pts, lineWidth = 1.0) {
  if (!pts || pts.length < 2) return;

  const draw = () => {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  };

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Ambient Occlusion / Shadow
  draw();
  ctx.strokeStyle = 'rgba(15,17,23,0.6)';
  ctx.lineWidth = lineWidth + 1.2;
  ctx.stroke();

  // Silver Core
  draw();
  ctx.strokeStyle = '#94a3b8'; 
  ctx.lineWidth = lineWidth;
  ctx.stroke();

  // Highlight
  draw();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = lineWidth * 0.45;
  ctx.stroke();

  ctx.restore();
}


/**
 * Draw a single high-fidelity metallic bracket. 
 * Designed to resemble clinical orthodontic brackets with tie wings and slot.
 */
/**
 * Draw a single high-contrast metallic bracket.
 * Mandate: use #CCCCCC for high visibility.
 */
export function drawBracket(ctx, x, y, ang, wMult, hMult, depthOpacity, baseW, baseH, angBias = 0) {
  const w = Math.max(8, baseW * wMult);
  const h = Math.max(8, baseH * hMult);

  ctx.save();
  ctx.globalAlpha *= clamp(depthOpacity, 0.8, 1.0);
  ctx.translate(x, y);
  ctx.rotate(ang + angBias);

  // 1. Shadow for contrast
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 3;
  ctx.shadowOffsetY = 1;

  // 2. High-contrast body
  ctx.fillStyle = '#CCCCCC'; // Silver/Grey High Contrast
  ctx.fillRect(-w/2, -h/2, w, h);

  // 3. Central Slot (Mandatory Visual Detail)
  ctx.fillStyle = '#666666';
  ctx.fillRect(-w/2, -h*0.1, w, h*0.2);

  // 4. Tie Wing highlights
  ctx.fillStyle = '#EEEEEE';
  const tw = w * 0.25;
  const th = h * 0.25;
  ctx.fillRect(-w/2, -h/2, tw, th); // TL
  ctx.fillRect( w/2 - tw, -h/2, tw, th); // TR
  ctx.fillRect(-w/2,  h/2 - th, tw, th); // BL
  ctx.fillRect( w/2 - tw,  h/2 - th, tw, th); // BR

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
