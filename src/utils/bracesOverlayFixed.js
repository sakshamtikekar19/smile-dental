/**
 * Fixed braces overlay pipeline.
 * 1. Re-detect landmarks on merged image (reuses app singleton — no double WASM load)
 * 2. Build bracket positions from fixed geometry
 * 3. Draw wire → contact shadows → brackets
 * 4. Erase above upper lip
 */

import { buildBracesPack, BRACKET_SIDE_PX } from './bracesGeometryFixed';
import { buildAnatomicalArchLockPack } from './bracesAnatomicalLock';
import { drawWire, drawBrackets } from './bracesCanvasRenderFixed';
import { clipToTeethEnamel, eraseAboveUpperLip, getWhiteningMaskPoints } from './bracesClipFixed';

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('braces overlay: image load failed'));
    img.src = src;
  });
}

const rAF   = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));
const delay = ms => new Promise(r => setTimeout(r, ms));

// ── Shared FaceLandmarker singleton (reuse app's instance, avoid double WASM load) ─────
let _sharedLandmarker      = null;
let _sharedLandmarkerFail  = false;
let _sharedLandmarkerInit  = null;

async function getSharedLandmarker() {
  if (_sharedLandmarkerFail) return null;
  if (_sharedLandmarker) return _sharedLandmarker;
  if (_sharedLandmarkerInit) return _sharedLandmarkerInit;

  _sharedLandmarkerInit = (async () => {
    try {
      const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
      const fs = await Promise.race([
        FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm'
        ),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 20_000)),
      ]);
      _sharedLandmarker = await FaceLandmarker.createFromOptions(fs, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'CPU',
        },
        runningMode: 'IMAGE',
        numFaces: 1,
        minFaceDetectionConfidence: 0.15,
        minFacePresenceConfidence:  0.15,
      });
      return _sharedLandmarker;
    } catch {
      _sharedLandmarkerFail  = true;
      _sharedLandmarkerInit  = null;
      return null;
    }
  })();

  return _sharedLandmarkerInit;
}

/**
 * Detect face landmarks using the shared singleton. Falls back to null on failure.
 */
async function detectLandmarks(canvas) {
  try {
    const landmarker = await Promise.race([
      getSharedLandmarker(),
      new Promise(r => setTimeout(() => r(null), 18_000)),
    ]);
    if (!landmarker) return null;
    const result = landmarker.detect(canvas);
    const lm = result?.faceLandmarks?.[0];
    return lm?.length >= 100 ? lm : null;
  } catch { return null; }
}

/**
 * Draw contact/drop shadows under brackets (blurred rects before studs are drawn).
 */
function drawContactShadows(ctx, anchors, baseW) {
  if (!anchors?.length) return;
  ctx.save();
  ctx.filter = 'blur(3px)';
  anchors.forEach(({ x, y, ang, wMult = 1, depthOpacity = 1 }) => {
    const sz = baseW * wMult * 1.1;
    ctx.save();
    ctx.globalAlpha *= clamp(depthOpacity * 0.35, 0.1, 0.35);
    ctx.translate(x, y + 1.5);
    ctx.rotate(ang ?? 0);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, sz * 0.7);
    g.addColorStop(0, 'rgba(0,0,0,0.6)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, sz * 0.55, sz * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
  ctx.filter = 'none';
  ctx.restore();
}

/**
 * Main entry: apply braces vector overlay onto mergedImageSrc.
 * @param {string} mergedImageSrc — full-frame merged JPEG after AI whitening
 * @param {number} iw — image width
 * @param {number} ih — image height
 * @returns {Promise<string>} data URL of result
 */
export async function applyBracesOverlayFixed(mergedImageSrc, iw, ih) {
  // Load and draw base image
  const img = await loadImage(mergedImageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = iw;
  canvas.height = ih;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');
  ctx.drawImage(img, 0, 0, iw, ih);

  // Detect landmarks on merged frame
  const detCanvas = document.createElement('canvas');
  detCanvas.width = iw;
  detCanvas.height = ih;
  const detCtx = detCanvas.getContext('2d');
  detCtx.drawImage(img, 0, 0, iw, ih);

  await rAF();
  const landmarks = await detectLandmarks(detCanvas);

  if (!landmarks || landmarks.length < 100) {
    // If detection fails, return image as-is (whitening was applied)
    console.warn('Braces overlay: landmark detection failed, returning whitened image');
    return mergedImageSrc;
  }

  let pack = buildBracesPack(landmarks, iw, ih, null);
  
  if (!pack || pack.upperAnchors.length < 2) {
    console.warn('Braces overlay: Geometric pack failed, fallback failed');
    return mergedImageSrc;
  }

  // Scale bracket size proportionally to image width so it's visible on small images
  // At iw=320 → 1.0x (7.5px), at iw=384 → 1.2x (9px), at iw=512 → 1.6x (12px)
  const bracketScale = clamp(iw / 320, 0.9, 4.5);
  pack.baseW = BRACKET_SIDE_PX * bracketScale;
  pack.baseH = BRACKET_SIDE_PX * bracketScale;

  await rAF();
  await delay(30);

  const { upperAnchors, lowerAnchors, upperStuds, lowerStuds,
          wireSamplesUpper, wireSamplesLower, mouthOpen, baseW, baseH } = pack;

  // --- Mandate 2: Sort Coordinates (No Zigzag) ---
  upperAnchors.sort((a, b) => a.x - b.x);
  lowerAnchors.sort((a, b) => a.x - b.x);
  wireSamplesUpper.sort((a, b) => a.x - b.x);
  wireSamplesLower.sort((a, b) => a.x - b.x);

  // --- Aesthetic Pass: Subtle Whitening ---
  ctx.save();
  if (getWhiteningMaskPoints(landmarks, iw, ih)) {
    const pts = getWhiteningMaskPoints(landmarks, iw, ih);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.45;
    ctx.fill();
  }
  ctx.restore();

  // --- Mandate 4: Ironclad Rendering Sequence ---

  ctx.save();
  
  // 1. Draw the clean, inner-lip polygon (Mandate 4.1)
  // We use the strict inner-lip mask points
  const maskPts = getWhiteningMaskPoints(landmarks, iw, ih);
  if (maskPts && maskPts.length >= 3) {
    ctx.beginPath();
    ctx.moveTo(maskPts[0].x, maskPts[0].y);
    for (let i = 1; i < maskPts.length; i++) ctx.lineTo(maskPts[i].x, maskPts[i].y);
    ctx.closePath();
    
    // 2. Clip to the mask (Mandate 4.2)
    ctx.clip();
  }

  // 3. Hard 'source-atop' containment (Mandate 4.3)
  ctx.globalCompositeOperation = 'source-atop';

  // 1. Contact shadows (bottom-most)
  drawContactShadows(ctx, upperAnchors, baseW);
  if (lowerAnchors.length) drawContactShadows(ctx, lowerAnchors, baseW);

  // 4. Draw the wire (Mandate 4.4)
  ctx.globalAlpha = 0.95;
  drawWire(ctx, wireSamplesUpper, 0.75); 
  if (wireSamplesLower.length >= 2) drawWire(ctx, wireSamplesLower, 0.65); 
  ctx.globalAlpha = 1;

  // 5. Draw the brackets (Mandate 4.5)
  // Mandate 1 & 2 are handled inside drawBrackets -> drawBracket (save/restore + primitives)
  drawBrackets(ctx, upperAnchors, baseW, baseH, 0);
  if (lowerAnchors.length) drawBrackets(ctx, lowerAnchors, baseW, baseH, Math.PI);

  // 6. Restore to release clip and composite state (Mandate 4.6)
  ctx.restore();

  // Re-apply lip occlusion for extra safety (erasing what might have bled past the soft clip)
  eraseAboveUpperLip(ctx, landmarks, iw, ih, mouthOpen);


  return canvas.toDataURL('image/jpeg', 0.95);
}
