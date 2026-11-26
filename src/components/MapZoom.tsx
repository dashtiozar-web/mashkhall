import React, { useCallback, useRef, useState } from 'react';
import { Minus, Plus, RotateCcw } from 'lucide-react';

/** Zoom in, zoom out and back to the whole map, shown in a corner of a map. */
export const ZoomControls: React.FC<{
  onIn: () => void; onOut: () => void; onReset: () => void; canIn: boolean; canOut: boolean; zoomed: boolean;
}> = ({ onIn, onOut, onReset, canIn, canOut, zoomed }) => {
  const btn = 'flex h-10 w-10 items-center justify-center text-white transition-colors hover:bg-white/15 disabled:opacity-35 disabled:hover:bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F2C14E]';
  return (
    <div className="absolute end-3 top-3 z-10 flex flex-col overflow-hidden rounded-xl border border-[#F2C14E]/50 bg-black/60 shadow-lg backdrop-blur-sm" role="group" aria-label="Map zoom">
      <button type="button" className={btn} onClick={onIn} disabled={!canIn} aria-label="Zoom in" title="Zoom in"><Plus className="h-5 w-5" aria-hidden="true" /></button>
      <span className="h-px bg-[#F2C14E]/35" aria-hidden="true" />
      <button type="button" className={btn} onClick={onOut} disabled={!canOut} aria-label="Zoom out" title="Zoom out"><Minus className="h-5 w-5" aria-hidden="true" /></button>
      <span className="h-px bg-[#F2C14E]/35" aria-hidden="true" />
      <button type="button" className={btn} onClick={onReset} disabled={!zoomed} aria-label="Show the whole map" title="Show the whole map"><RotateCcw className="h-4 w-4" aria-hidden="true" /></button>
    </div>
  );
};

/**
 * Zoom and pan for a flat SVG map of the given size: apply `transform` to a
 * <g> around the map, and the pointer handlers to the <svg>. When zoomed in,
 * dragging moves the map; otherwise the page scrolls as usual.
 */
export const useSvgZoom = (width: number, height: number, min = 1, max = 4) => {
  const [z, setZ] = useState({ k: 1, x: 0, y: 0 });
  const drag = useRef<{ px: number; py: number; x: number; y: number; scale: number } | null>(null);
  const clamp = (k: number, x: number, y: number) => ({
    k,
    x: Math.min(0, Math.max(width - width * k, x)),
    y: Math.min(0, Math.max(height - height * k, y)),
  });
  const zoomTo = useCallback((k2: number) => setZ((o) => {
    const k = Math.min(max, Math.max(min, k2));
    const cx = width / 2, cy = height / 2;
    return clamp(k, cx - ((cx - o.x) * k) / o.k, cy - ((cy - o.y) * k) / o.k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [width, height, min, max]);
  const zoomed = z.k > 1.001;
  const handlers = {
    onPointerDown: (e: React.PointerEvent<SVGSVGElement>) => {
      if (!zoomed) return;
      const r = e.currentTarget.getBoundingClientRect();
      drag.current = { px: e.clientX, py: e.clientY, x: z.x, y: z.y, scale: width / r.width };
    },
    onPointerMove: (e: React.PointerEvent<SVGSVGElement>) => {
      const d = drag.current;
      if (!d) return;
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.setPointerCapture(e.pointerId);
      setZ((o) => clamp(o.k, d.x + (e.clientX - d.px) * d.scale, d.y + (e.clientY - d.py) * d.scale * 1.15));
    },
    onPointerUp: () => { drag.current = null; },
    onPointerCancel: () => { drag.current = null; },
  };
  return {
    transform: `translate(${z.x} ${z.y}) scale(${z.k})`,
    k: z.k,
    zoomed,
    handlers,
    style: { touchAction: zoomed ? 'none' : 'auto', cursor: zoomed ? 'grab' : undefined } as React.CSSProperties,
    controls: {
      onIn: () => zoomTo(z.k * 1.5), onOut: () => zoomTo(z.k / 1.5), onReset: () => setZ({ k: 1, x: 0, y: 0 }),
      canIn: z.k < max - 0.001, canOut: z.k > min + 0.001, zoomed,
    },
  };
};
