/**
 * Fixed braces canvas renderer.
 * Draws: archwire (shadow + body + highlight) then metallic brackets.
 * Clip is applied by caller; renderer does not re-clip.
 */

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/**
 * Draw archwire polyline: dark shadow → silver body → white highlight
 */
export function drawWire(ctx, pts, lineWidth = 0.8) {
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
  ctx.strokeStyle = '#94a3b8'; // Slate-400 (Metallic Base)
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
export function drawBracket(ctx, x, y, ang, wMult, hMult, depthOpacity, baseW, baseH, angBias = 0) {
  const w = Math.max(6, baseW * wMult);
  const h = Math.max(6, baseH * hMult);
  const r = 1.2;

  ctx.save();
  ctx.globalAlpha *= clamp(depthOpacity, 0.7, 1.0);
  ctx.translate(x, y);
  ctx.rotate(ang + angBias);

  // 1. Bracket Base (Shadow/Occlusion)
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 2.5;
  ctx.shadowOffsetY = 1.2;

  // 2. Metallic Body Gradient
  const grad = ctx.createLinearGradient(-w/2, -h/2, w/2, h/2);
  grad.addColorStop(0,    '#f8fafc'); // highlight
  grad.addColorStop(0.3,  '#cbd5e1'); // silver
  grad.addColorStop(0.7,  '#64748b'); // shadow
  grad.addColorStop(1,    '#334155'); // deep shadow

  // Main bracket plate
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(-w*0.48, -h/2, w*0.96, h, r);
  } else {
    ctx.rect(-w*0.48, -h/2, w*0.96, h);
  }
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // 3. Central Archwire Slot (Dark horizontal line)
  ctx.fillStyle = 'rgba(15,23,42,0.85)';
  ctx.fillRect(-w/2, -h*0.1, w, h*0.2);
  
  // 4. Tie Wings (Clinical Detail)
  const tw = w * 0.35;
  const th = h * 0.35;
  const tx = w * 0.28;
  const ty = h * 0.28;
  
  const drawWing = (wx, wy) => {
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(wx - tw/2, wy - th/2, tw, th, 0.8);
    } else {
      ctx.rect(wx - tw/2, wy - th/2, tw, th);
    }
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  };

  drawWing(-tx, -ty); // Top Left
  drawWing( tx, -ty); // Top Right
  drawWing(-tx,  ty); // Bottom Left
  drawWing( tx,  ty); // Bottom Right

  // 5. Specular Highlight on top of wings
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha *= 0.6;
  ctx.fillRect(-tx - tw*0.2, -ty - th*0.2, tw*0.4, th*0.2);

  // 6. Ambient Lighting Pass (Blending)
  // Mandate: Use 'multiply' to help brackets blend into the mouth's natural lighting
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  const ambientGrad = ctx.createLinearGradient(0, -h/2, 0, h/2);
  ambientGrad.addColorStop(0, 'rgba(0,0,0,0)');
  ambientGrad.addColorStop(1, 'rgba(0,0,0,0.18)');
  ctx.fillStyle = ambientGrad;
  ctx.fillRect(-w/2, -h/2, w, h);
  ctx.restore();

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
