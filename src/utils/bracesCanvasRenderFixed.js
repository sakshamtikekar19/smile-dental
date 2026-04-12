/**
 * Fixed braces canvas renderer.
 * Draws: archwire (shadow + body + highlight) then metallic brackets.
 * Clip is applied by caller; renderer does not re-clip.
 */

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function getCatmullRomPoint(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: 0.5 * (
      (2 * p1.x) +
      (-p0.x + p2.x) * t +
      (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
      (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
    ),
    y: 0.5 * (
      (2 * p1.y) +
      (-p0.y + p2.y) * t +
      (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
      (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
    )
  };
}

/**
 * Draw intensive archwire using Catmull-Rom splines for professional dental arcs.
 */
export function drawWire(ctx, pts, lineWidth = 0.8) {
  if (!pts || pts.length < 2) return;

  const drawSpline = () => {
    ctx.beginPath();
    if (pts.length === 2) {
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.lineTo(pts[1].x, pts[1].y);
    } else {
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(i - 1, 0)];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[Math.min(i + 2, pts.length - 1)];
        for (let t = 0; t <= 1; t += 0.1) {
          const p = getCatmullRomPoint(p0, p1, p2, p3, t);
          ctx.lineTo(p.x, p.y);
        }
      }
    }
  };

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Ambient Occlusion / Shadow
  drawSpline();
  ctx.strokeStyle = 'rgba(15,17,23,0.5)';
  ctx.lineWidth = lineWidth + 1.2;
  ctx.stroke();

  // Silver Core
  drawSpline();
  ctx.strokeStyle = '#94a3b8'; 
  ctx.lineWidth = lineWidth;
  ctx.stroke();

  // Highlight
  drawSpline();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = lineWidth * 0.4;
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
