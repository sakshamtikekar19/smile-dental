/**
 * Fixed braces overlay pipeline.
 * 1. Re-detect landmarks on merged image
 * 2. Build bracket positions from fixed geometry
 * 3. Draw wire → contact shadows → brackets
 * 4. Erase above upper lip
 */

import { buildBracesPack, BRACKET_SIDE_PX } from './bracesGeometryFixed';
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

const rAF = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));
const delay = ms => new Promise(r => setTimeout(r, ms));

/**
 * Detect face landmarks on image using FaceLandmarker (tasks-vision).
 * Falls back to FaceMesh if needed.
 */
async function detectLandmarks(canvas) {
  // Try FaceLandmarker first
  try {
    const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
    const fs = await Promise.race([
      FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm'
      ),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000))
    ]);
    const fl = await FaceLandmarker.createFromOptions(fs, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'CPU',
      },
      runningMode: 'IMAGE',
      numFaces: 1,
      minFaceDetectionConfidence: 0.15,
      minFacePresenceConfidence: 0.15,
    });
    const result = fl.detect(canvas);
    const lm = result?.faceLandmarks?.[0];
    if (lm?.length >= 100) return lm;
  } catch { /* fall through */ }

  // Try FaceMesh
  return new Promise(resolve => {
    let done = false;
    const finish = lm => {
      if (done) return;
      done = true;
      resolve(lm);
    };
    setTimeout(() => finish(null), 12000);

    import('@mediapipe/face_mesh').then(FaceMeshModule => {
      const fm = new FaceMeshModule.FaceMesh({
        locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`
      });
      fm.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.15, minTrackingConfidence: 0.15 });
      fm.onResults(r => finish(r?.multiFaceLandmarks?.[0] ?? null));
      fm.send({ image: canvas }).catch(() => finish(null));
    }).catch(() => finish(null));
  });
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
    ctx.rotate((ang ?? 0) + Math.PI / 2);
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

  // Build braces geometry
  const pack = buildBracesPack(landmarks, iw, ih, null);
  if (!pack || pack.upperAnchors.length < 2) {
    console.warn('Braces overlay: could not build arch geometry');
    return mergedImageSrc;
  }

  await rAF();
  await delay(30);

  const { upperAnchors, lowerAnchors, upperStuds, lowerStuds,
          wireSamplesUpper, wireSamplesLower, mouthOpen, baseW, baseH } = pack;

  // --- Draw overlay on separate canvas then composite ---
  const overlay = document.createElement('canvas');
  overlay.width = iw;
  overlay.height = ih;
  const octx = overlay.getContext('2d');
  if (!octx) throw new Error('Could not get overlay context');

  // Clip to enamel region (generous hull for braces)
  octx.save();
  const clipped = clipToTeethEnamel(octx, landmarks, iw, ih, 10);
  if (!clipped) {
    // Fallback: clip to mouth oval from landmarks
    const L61 = landmarks[61], L291 = landmarks[291], L13 = landmarks[13], L14 = landmarks[14];
    if (L61 && L291 && L13 && L14) {
      const cx = ((L61.x + L291.x) / 2) * iw;
      const cy = ((L13.y + L14.y) / 2) * ih;
      const rx = Math.abs(L291.x - L61.x) / 2 * iw * 1.15;
      const ry = Math.abs(L14.y - L13.y) / 2 * ih * 1.4 + mouthOpen * 0.3;
      octx.beginPath();
      octx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      octx.clip();
    }
  }

  // 1. Contact shadows (bottom-most)
  drawContactShadows(octx, upperAnchors, baseW);
  if (lowerAnchors.length) drawContactShadows(octx, lowerAnchors, baseW);

  // 2. Archwires
  octx.globalAlpha = 0.92;
  drawWire(octx, wireSamplesUpper, 1.1);
  if (wireSamplesLower.length >= 2) drawWire(octx, wireSamplesLower, 1.0);
  octx.globalAlpha = 1;

  // 3. Brackets
  drawBrackets(octx, upperAnchors, baseW, baseH, 0);
  if (lowerAnchors.length) drawBrackets(octx, lowerAnchors, baseW, baseH, Math.PI);

  octx.restore();

  // 4. Erase above upper lip (soft anti-bleed)
  eraseAboveUpperLip(octx, landmarks, iw, ih, mouthOpen);

  // --- Composite overlay onto base ---
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = 2;
  ctx.shadowOffsetY = 1;
  ctx.drawImage(overlay, 0, 0);
  ctx.shadowBlur = 0;
  ctx.restore();

  return canvas.toDataURL('image/jpeg', 0.95);
}
