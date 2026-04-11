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
import { clipToTeethEnamel, eraseAboveUpperLip } from './bracesClipFixed';

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

  // Extract raw pixel data to empower the geometric solver to snap mathematically placed brackets to physical teeth gaps
  const imgData = ctx.getImageData(0, 0, iw, ih);
  let pack = buildBracesPack(landmarks, iw, ih, null, imgData.data);
  
  if (!pack || pack.upperAnchors.length < 2) {
    console.warn('Braces overlay: Geometric pack failed, fallback failed');
    return mergedImageSrc;
  }

  // Scale bracket size proportionally to image width so it's visible on small images
  // At iw=320 → 1.0x (7.5px), at iw=384 → 1.2x (9px), at iw=512 → 1.6x (12px)
  const bracketScale = clamp(iw / 320, 0.9, 2.2);
  pack.baseW = BRACKET_SIDE_PX * bracketScale;
  pack.baseH = BRACKET_SIDE_PX * bracketScale;

  await rAF();
  await delay(30);

  const { upperAnchors, lowerAnchors, upperStuds, lowerStuds,
          wireSamplesUpper, wireSamplesLower, mouthOpen, baseW, baseH } = pack;

  // --- Mandate 4: Hard Wire Containment (Clipping) ---
  // We use an overlay canvas to draw the braces and then composite it back 
  // using 'source-atop' against a mask of the teeth enamel.
  const overlay = document.createElement('canvas');
  overlay.width = iw;
  overlay.height = ih;
  const octx = overlay.getContext('2d');
  if (!octx) throw new Error('Could not get overlay context');

  // 1. First, define the 'destination' which is the teeth enamel area
  // We draw this solid on the overlay canvas
  octx.save();
  const maskSuccess = clipToTeethEnamel(octx, landmarks, iw, ih, 4); // Tight fit
  if (maskSuccess) {
    octx.fillStyle = '#fff';
    octx.fillRect(0, 0, iw, ih);
  }
  octx.restore();

  // 2. Set composition to 'source-atop'
  // Everything drawn now will ONLY appear where the enamel mask (the white pixels) exists
  octx.globalCompositeOperation = 'source-atop';

  // 1. Contact shadows (bottom-most)
  drawContactShadows(octx, upperAnchors, baseW);
  if (lowerAnchors.length) drawContactShadows(octx, lowerAnchors, baseW);

  // 2. Archwires
  octx.globalAlpha = 0.92;
  drawWire(octx, wireSamplesUpper, 0.7); // Made wire very thin
  if (wireSamplesLower.length >= 2) drawWire(octx, wireSamplesLower, 0.6); // Made wire very thin
  octx.globalAlpha = 1;

  // 3. Brackets
  drawBrackets(octx, upperAnchors, baseW, baseH, 0);
  if (lowerAnchors.length) drawBrackets(octx, lowerAnchors, baseW, baseH, Math.PI);

  // --- End Mandate 4 composition ---

  // 4. Erase above upper lip (soft anti-bleed)
  eraseAboveUpperLip(octx, landmarks, iw, ih, mouthOpen);

  // --- Composite overlay onto base image ---
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = 2;
  ctx.shadowOffsetY = 1;
  ctx.drawImage(overlay, 0, 0);
  ctx.restore();

  return canvas.toDataURL('image/jpeg', 0.95);
}
