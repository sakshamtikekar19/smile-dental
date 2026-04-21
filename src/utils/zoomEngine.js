export function applyClinicalZoom(ctx, landmarks, iw, ih, sourceImage) {
  if (!landmarks || !landmarks.length || !sourceImage) return;

  const targetW = ctx.canvas.width;
  const targetH = ctx.canvas.height;

  // 1. Find the Exact Focal Point (Oral Bounding Box Center)
  const mouthIndices = [0, 13, 14, 17, 37, 39, 40, 61, 78, 80, 81, 82, 84, 87, 88, 91, 95, 146, 178, 181, 185, 191, 267, 269, 270, 291, 308, 310, 311, 312, 314, 317, 318, 321, 324, 375, 402, 405, 409, 415];
  
  let sumX = 0, sumY = 0;
  mouthIndices.forEach(idx => {
    const pt = landmarks[idx] || landmarks[0];
    sumX += pt.x <= 1 ? pt.x * iw : pt.x;
    sumY += pt.y <= 1 ? pt.y * ih : pt.y;
  });
  
  const focusX = sumX / mouthIndices.length;
  const focusY = sumY / mouthIndices.length;

  // 2. The 3.0x Magnification Math
  const zoomFactor = 3.0;
  
  // Size of the "cutout" window we are extracting from the original image
  const sourceCropWidth = targetW / zoomFactor;
  const sourceCropHeight = targetH / zoomFactor;

  // Top-left corner of our cutout window, centered precisely on the mouth
  let sx = focusX - (sourceCropWidth / 2);
  let sy = focusY - (sourceCropHeight / 2);

  // 3. Clamp values so the camera doesn't try to look outside the image
  // (Prevents black bars if the patient is standing too far to the edge)
  sx = Math.max(0, Math.min(sx, iw - sourceCropWidth));
  sy = Math.max(0, Math.min(sy, ih - sourceCropHeight));

  // 4. Paint the base layer (Premium Zinc-950 background)
  ctx.fillStyle = "#09090b";
  ctx.fillRect(0, 0, targetW, targetH);

  // 5. 🚀 EXECUTE THE CROP & MAGNIFY
  ctx.drawImage(
    sourceImage,
    sx, sy, sourceCropWidth, sourceCropHeight, // What we extract from the photo
    0, 0, targetW, targetH                     // Where we paste it (scaled up 3x)
  );
}
