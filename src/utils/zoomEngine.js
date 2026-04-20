export function applyClinicalZoom(ctx, landmarks, iw, ih, sourceImage) {
  if (!landmarks || !landmarks.length || !sourceImage) return;

  const targetW = ctx.canvas.width;
  const targetH = ctx.canvas.height;

  // 1. Find the Exact Focal Point (The Mouth)
  let focusX, focusY;

  if (landmarks.length >= 400) {
    // We have the full FaceMesh! Target Landmark 13 (Center of upper lip)
    const pt = landmarks[13];
    // Handle both normalized (0-1) and absolute pixel coordinates
    focusX = pt.x <= 1 ? pt.x * iw : pt.x;
    focusY = pt.y <= 1 ? pt.y * ih : pt.y;
  } else {
    // Failsafe: Average center of whatever points are provided
    let sumX = 0, sumY = 0;
    landmarks.forEach(pt => {
      sumX += pt.x <= 1 ? pt.x * iw : pt.x;
      sumY += pt.y <= 1 ? pt.y * ih : pt.y;
    });
    focusX = sumX / landmarks.length;
    focusY = sumY / landmarks.length;
  }

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
