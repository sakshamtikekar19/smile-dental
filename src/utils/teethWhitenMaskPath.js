import { TEETH_WHITEN_MASK_INDICES } from './teethWhitenMaskIndices';

/**
 * Generates a closed Path2D for the dental arch.
 * Guaranteed to reach distal molars for high-fidelity simulation.
 */
export const generateTeethPath = (landmarks, width, height) => {
    if (!landmarks || landmarks.length === 0) return null;

    const path = new Path2D();
    TEETH_WHITEN_MASK_INDICES.forEach((index, i) => {
        const point = landmarks[index];
        const x = point.x * width;
        const y = point.y * height;

        if (i === 0) {
            path.moveTo(x, y);
        } else {
            path.lineTo(x, y);
        }
    });

    path.closePath();
    return path;
};

/**
 * Compatibility wrapper for tightened points (for non-Path2D context use cases)
 */
export function getTightenedWhiteningMaskPoints(landmarks, width, height, inset = 0) {
    const pts = TEETH_WHITEN_MASK_INDICES.map(idx => {
        const p = landmarks[idx];
        return { x: p.x * width, y: p.y * height };
    });
    if (inset <= 0) return pts;
    
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    
    return pts.map(p => {
        const dx = p.x - cx;
        const dy = p.y - cy;
        const len = Math.hypot(dx, dy) || 1;
        return {
            x: p.x - (dx / len) * inset,
            y: p.y - (dy / len) * inset
        };
    });
}
