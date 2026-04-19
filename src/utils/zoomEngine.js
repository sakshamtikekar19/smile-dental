/**
 * 🔍 SURGICAL 3.0X CLINICAL ZOOM ENGINE
 * Calculates the exact anatomical center of the mouth and applies
 * an precise 3.0x magnification window (crop) from the source image.
 * 
 * @param {CanvasRenderingContext2D} ctx - The target context to paint into.
 * @param {Array} landmarks - The facial landmarks (MediaPipe format).
 * @param {number} iw - Original source image width.
 * @param {number} ih - Original source image height.
 * @param {HTMLImageElement|HTMLCanvasElement} sourceImage - The stable snapshot source.
 */
export function applyClinicalZoom(ctx, landmarks, iw, ih, sourceImage) {
  if (!landmarks || !landmarks.length || !sourceImage) return;

  const targetW = ctx.canvas.width;
  const targetH = ctx.canvas.height;

  // 🧼 CLEAR Viewport (Zinc-950/Black Base for a professional look)
  ctx.fillStyle = "#09090b";
  ctx.fillRect(0, 0, targetW, targetH);

  // 1. Calculate the focal point (Center of the mouth)
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  // Surgical indices (Lips and Mouth boundaries)
  const mouthIndices = [61, 291, 78, 95, 88, 178, 87, 14, 317, 402, 318, 324];

  mouthIndices.forEach(idx => {
    const pt = landmarks[idx];
    if (!pt) return;
    
    // Handle both absolute pixels and normalized (0-1) MediaPipe data
    const x = pt.x <= 1 ? pt.x * iw : pt.x;
    const y = pt.y <= 1 ? pt.y * ih : pt.y;
    
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  });

  const mouthCenterX = (minX + maxX) / 2;
  const mouthCenterY = (minY + maxY) / 2;

  // 2. Calculate the 3.0x Surgical Crop Box
  const zoomFactor = 3.0;
  
  // The size of the "window" we are cutting out of the original image
  const sourceCropWidth = targetW / zoomFactor;
  const sourceCropHeight = targetH / zoomFactor;

  // Top-left corner of our crop window, centered around the mouth
  let sx = mouthCenterX - (sourceCropWidth / 2);
  let sy = mouthCenterY - (sourceCropHeight / 2);

  // 3. Clamp values to image bounds to prevent edge bleeding/black bars
  sx = Math.max(0, Math.min(sx, iw - sourceCropWidth));
  sy = Math.max(0, Math.min(sy, ih - sourceCropHeight));

  // 🎯 Paint the Magnified Snapshot
  // drawImage(image, sourceX, sourceY, sourceW, sourceH, destX, destY, destW, destH)
  ctx.imageSmoothingEnabled = false; // Surgical Clarity
  ctx.drawImage(
    sourceImage,
    sx, sy, sourceCropWidth, sourceCropHeight, // Selection Box
    0, 0, targetW, targetH                     // Pushed to 3x magnify viewport
  );
}
