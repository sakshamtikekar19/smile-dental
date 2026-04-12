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

// ── Shared Engine Canvases (Pillar 2: Anti-Crash) ──────────────────────────
let _sharedMainCanvas = null;
let _sharedDetCanvas  = null;

function getSharedCanvases(iw, ih) {
  if (!_sharedMainCanvas) _sharedMainCanvas = document.createElement('canvas');
  if (!_sharedDetCanvas)  _sharedDetCanvas  = document.createElement('canvas');
  
  // Rule 1: High-DPI (Retina) Scaling (Mandate 1)
  const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
  const maxSafeRes = 4096; // Pillar 2: Prevent mobile memory crashes
  
  const width = Math.min(iw, maxSafeRes);
  const height = Math.min(ih, maxSafeRes);

  _sharedMainCanvas.width  = width * dpr;
  _sharedMainCanvas.height = height * dpr;
  _sharedDetCanvas.width   = width; // Internal detection stays 1x
  _sharedDetCanvas.height  = height;

  const ctx = _sharedMainCanvas.getContext('2d');
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // Correct scale for subsequent draws

  return { main: _sharedMainCanvas, det: _sharedDetCanvas, dpr };
}

/**
 * Main entry: apply braces vector overlay onto mergedImageSrc.
 * Mandate 3: Nuclear Overwrite for Invisible Braces.
 * @param {object} landmarks - Pre-detected landmarks to avoid re-detection failure
 */
export async function applyBracesOverlayFixed(mergedImageSrc, iw, ih, landmarks) {
  const img = await loadImage(mergedImageSrc);
  const { main: canvas } = getSharedCanvases(iw, ih);
  const ctx = canvas.getContext('2d');
  
  ctx.drawImage(img, 0, 0, iw, ih);

  if (!landmarks) return mergedImageSrc;

  const pack = buildBracesPack(landmarks, iw, ih, null);
  if (!pack || !pack.upperAnchors.length) return mergedImageSrc;

  const { upperAnchors, lowerAnchors, wireSamplesUpper, wireSamplesLower } = pack;

  // --- Rule 4: Braces Geometry (X-Axis Sorting) ---
  const sortedU = [...upperAnchors].sort((a, b) => a.x - b.x);
  const sortedL = [...lowerAnchors].sort((a, b) => a.x - b.x);

  // --- Rule 3: Braces Rendering Layer (Finality Audit) ---
  ctx.save();
  ctx.globalCompositeOperation = 'source-over'; // Guarantee visibility draw on top

  // 2. Draw Wire (Upper)
  if (sortedU.length >= 2) {
    ctx.beginPath();
    ctx.moveTo(sortedU[0].x, sortedU[0].y);
    for (let i = 1; i < sortedU.length; i++) {
      // Simple curve logic using midpoints
      const xc = (sortedU[i].x + sortedU[i-1].x) / 2;
      const yc = (sortedU[i].y + sortedU[i-1].y) / 2;
      ctx.quadraticCurveTo(sortedU[i-1].x, sortedU[i-1].y, xc, yc);
    }
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#888888';
    ctx.stroke();
  }

  // 2b. Draw Wire (Lower)
  if (sortedL.length >= 2) {
    ctx.beginPath();
    ctx.moveTo(sortedL[0].x, sortedL[0].y);
    for (let i = 1; i < sortedL.length; i++) {
      const xc = (sortedL[i].x + sortedL[i-1].x) / 2;
      const yc = (sortedL[i].y + sortedL[i-1].y) / 2;
      ctx.quadraticCurveTo(sortedL[i-1].x, sortedL[i-1].y, xc, yc);
    }
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#888888';
    ctx.stroke();
  }

  // 3. Draw Primitive Brackets (NO drawImage)
  ctx.fillStyle = '#CCCCCC'; // Silver
  [...sortedU, ...sortedL].forEach(anchor => {
     ctx.fillRect(anchor.x - 5, anchor.y - 4, 10, 8); // Simple visible rectangle
     // Add a tiny slot for detail
     ctx.fillStyle = '#666666';
     ctx.fillRect(anchor.x - 5, anchor.y - 1, 10, 2);
     ctx.fillStyle = '#CCCCCC';
  });

  ctx.restore();
  return canvas.toDataURL('image/jpeg', 0.98);
}
