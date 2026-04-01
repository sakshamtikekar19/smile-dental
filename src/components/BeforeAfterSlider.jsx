import { useState, useRef, useEffect, useCallback } from "react";

const BeforeAfterSlider = ({ before, after }) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef(null);

  const handleMouseUp = useCallback(() => setIsResizing(false), []);

  const handleMove = useCallback(
    (e) => {
      if (!isResizing || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = e.type === "mousemove" ? e.pageX : e.touches[0].pageX;
      const position = ((x - rect.left) / rect.width) * 100;

      if (position >= 0 && position <= 100) {
        setSliderPosition(position);
      }
    },
    [isResizing]
  );

  const handleMouseDown = useCallback(() => setIsResizing(true), []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchmove", handleMove);
    window.addEventListener("touchend", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleMouseUp);
    };
  }, [handleMove, handleMouseUp]);

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video md:aspect-[16/9] rounded-2xl overflow-hidden shadow-2xl cursor-ew-resize select-none"
      onMouseDown={handleMouseDown}
      onTouchStart={handleMouseDown}
    >
      {/* After image (background) */}
      <img
        src={after}
        alt="After Treatment"
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Before image (clipped) */}
      <div
        className="absolute inset-0 w-full h-full overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
      >
        <img
          src={before}
          alt="Before Treatment"
          className="absolute inset-0 w-full h-full object-cover"
        />
      </div>

      {/* Slider handle */}
      <div
        className="absolute top-0 bottom-0 w-1 bg-white shadow-xl z-10"
        style={{ left: `${sliderPosition}%` }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow-2xl flex items-center justify-center">
          <div className="flex gap-1">
            <div className="w-1 h-4 bg-zinc-300 rounded-full" />
            <div className="w-1 h-4 bg-zinc-300 rounded-full" />
          </div>
        </div>
      </div>

      {/* Labels */}
      <div className="absolute bottom-6 left-6 px-4 py-2 bg-black/30 backdrop-blur-md rounded-full text-white text-[10px] font-bold uppercase tracking-widest pointer-events-none">
        Before
      </div>
      <div className="absolute bottom-6 right-6 px-4 py-2 bg-black/30 backdrop-blur-md rounded-full text-white text-[10px] font-bold uppercase tracking-widest pointer-events-none">
        After
      </div>
    </div>
  );
};

export default BeforeAfterSlider;
