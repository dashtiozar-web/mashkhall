import React, { useEffect, useMemo, useRef, useState } from 'react';
import { geoDistance, geoGraticule10, geoInterpolate, geoOrthographic, geoPath, GeoPermissibleObjects } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import world from 'world-atlas/countries-110m.json';

/*
 * A real globe, turning slowly, with the countries where we have members
 * coloured by how many there are and joined to Kurdistan along great circles.
 * Visitors can drag it to turn it. Natural Earth data via world-atlas.
 */

export interface GlobePlace {
  id: string;
  name: string;
  lng: number;
  lat: number;
  /** ISO 3166 numeric code of the country, to colour it. */
  iso?: string;
  members: number;
  colour: string;
}

const W = 640;
const H = 600;
const R = 270;
const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export const Globe3D: React.FC<{
  places: GlobePlace[];
  home: { name: string; lng: number; lat: number; members: number };
  focusId: string | null;
  onHover: (id: string | null) => void;
  onPick: (id: string) => void;
}> = ({ places, home, focusId, onHover, onPick }) => {
  const countries = useMemo(() => {
    const topo = world as unknown as Topology<{ countries: GeometryCollection }>;
    return (feature(topo, topo.objects.countries) as unknown as { features: { id: string; properties: { name: string } }[] }).features;
  }, []);
  // Start over Europe and Kurdistan.
  const [rot, setRot] = useState<[number, number]>([-20, -28]);
  const [held, setHeld] = useState(false);
  const drag = useRef<{ x: number; y: number; r: [number, number] } | null>(null);
  const still = reduceMotion();

  // Turn slowly, unless a visitor is reading or dragging.
  useEffect(() => {
    if (still || held || focusId) return;
    let raf = 0;
    let last = performance.now();
    const tick = (t: number) => {
      const dt = Math.min(64, t - last);
      last = t;
      setRot(([l, p]) => [l + dt * 0.006, p]);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [still, held, focusId]);

  // Turn the globe to face a place when it is chosen.
  useEffect(() => {
    if (!focusId) return;
    const p = focusId === 'kurdistan' ? home : places.find((x) => x.id === focusId);
    if (p) setRot([-p.lng, Math.max(-50, Math.min(50, -p.lat * 0.8))]);
  }, [focusId, places, home]);

  const projection = useMemo(() => geoOrthographic().scale(R).translate([W / 2, H / 2]).rotate([rot[0], rot[1], 0]).clipAngle(90), [rot]);
  const path = useMemo(() => geoPath(projection), [projection]);
  const centre: [number, number] = [-rot[0], -rot[1]];
  const visible = (lng: number, lat: number) => geoDistance([lng, lat], centre) < Math.PI / 2 - 0.08;
  const byIso = new Map(places.filter((p) => p.iso).map((p) => [p.iso!, p]));
  const max = Math.max(1, ...places.map((p) => p.members));

  const onDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, r: rot };
    setHeld(true);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const k = 0.35;
    const d = drag.current;
    setRot([d.r[0] + (e.clientX - d.x) * k, Math.max(-70, Math.min(70, d.r[1] - (e.clientY - d.y) * k))]);
  };
  const onUp = () => { drag.current = null; setHeld(false); };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Globe showing our members abroad, joined to Kurdistan. Drag to turn it."
      className="mx-auto block h-auto w-full max-w-[640px] touch-none select-none" style={{ cursor: held ? 'grabbing' : 'grab' }}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={onUp}>
      <defs>
        <radialGradient id="g-ocean" cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor="#3f86b8" />
          <stop offset="0.55" stopColor="#1d5a86" />
          <stop offset="1" stopColor="#0b2a45" />
        </radialGradient>
        <radialGradient id="g-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0.86" stopColor="#7fc4ff" stopOpacity="0.45" />
          <stop offset="1" stopColor="#7fc4ff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="g-shade" cx="36%" cy="30%" r="72%">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="0.45" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.8" stopColor="#000814" stopOpacity="0.25" />
          <stop offset="1" stopColor="#000814" stopOpacity="0.6" />
        </radialGradient>
        <radialGradient id="g-pin" cx="35%" cy="30%" r="70%">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.75" />
          <stop offset="0.35" stopColor="#ffffff" stopOpacity="0.1" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.35" />
        </radialGradient>
        {/* Terrain: hills and valleys lit from the north-west. */}
        <filter id="g-relief" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="4" seed="3" result="n" />
          <feDiffuseLighting in="n" surfaceScale="2.2" diffuseConstant="1.05" lightingColor="#ffffff" result="l">
            <feDistantLight azimuth="225" elevation="42" />
          </feDiffuseLighting>
          <feComposite in="l" in2="SourceGraphic" operator="arithmetic" k1="1.15" k2="0" k3="0" k4="0" result="lit" />
          <feComposite in="lit" in2="SourceGraphic" operator="in" />
        </filter>
        <filter id="g-shadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="2" stdDeviation="2.2" floodOpacity="0.5" /></filter>
      </defs>

      <circle cx={W / 2} cy={H / 2} r={R + 22} fill="url(#g-glow)" />
      <path d={path({ type: 'Sphere' } as GeoPermissibleObjects) || ''} fill="url(#g-ocean)" />
      <path d={path(geoGraticule10()) || ''} fill="none" stroke="#ffffff" strokeOpacity={0.08} strokeWidth={0.6} />

      <g filter="url(#g-relief)">
        {countries.map((c) => {
          const p = byIso.get(c.id);
          const isHome = c.id === '368';
          const on = p && focusId === p.id;
          return (
            <path key={c.id + c.properties.name} d={path(c as unknown as GeoPermissibleObjects) || ''}
              fill={p ? p.colour : isHome ? '#F2C14E' : '#b8b58a'} fillOpacity={p ? (on ? 1 : 0.9) : 1}
              stroke={on ? '#ffffff' : '#5d5a40'} strokeOpacity={on ? 1 : 0.35} strokeWidth={on ? 1.4 : 0.4}
              onMouseEnter={() => p && onHover(p.id)} onMouseLeave={() => onHover(null)} onClick={() => p && onPick(p.id)}
              className={p ? 'cursor-pointer' : ''}>
              <title>{p ? `${p.name}: ${p.members} members` : c.properties.name}</title>
            </path>
          );
        })}
      </g>

      {/* Lines of light from Kurdistan to every country */}
      {places.map((p) => {
        const line = { type: 'LineString', coordinates: Array.from({ length: 48 }, (_, i) => geoInterpolate([home.lng, home.lat], [p.lng, p.lat])(i / 47)) };
        const lit = focusId === p.id;
        return <path key={`arc-${p.id}`} d={path(line as GeoPermissibleObjects) || ''} fill="none" stroke={lit ? '#ffffff' : '#F2C14E'}
          strokeOpacity={focusId && !lit ? 0.35 : 0.9} strokeWidth={lit ? 2.6 : 1.8} strokeLinecap="round" className="map-flow" />;
      })}

      {/* The light falling on the globe */}
      <path d={path({ type: 'Sphere' } as GeoPermissibleObjects) || ''} fill="url(#g-shade)" pointerEvents="none" />

      {places.filter((p) => visible(p.lng, p.lat)).map((p) => {
        const [x, y] = projection([p.lng, p.lat]) || [0, 0];
        const r = 11 + 7 * Math.sqrt(p.members / max);
        const on = focusId === p.id;
        const left = x < W / 2;
        return (
          <g key={p.id} role="button" tabIndex={0} aria-label={`${p.name}: ${p.members} members`} className="cursor-pointer focus:outline-none"
            onMouseEnter={() => onHover(p.id)} onMouseLeave={() => onHover(null)} onFocus={() => onHover(p.id)} onBlur={() => onHover(null)}
            onClick={(e) => { e.stopPropagation(); onPick(p.id); }} onPointerDown={(e) => e.stopPropagation()}>
            <ellipse cx={x} cy={y + r * 0.9} rx={r * 0.9} ry={r * 0.3} fill="#000" opacity={0.3} />
            {on && <circle cx={x} cy={y} r={r * 1.6} fill={p.colour} fillOpacity={0.3} />}
            <circle cx={x} cy={y} r={r} fill={p.colour} stroke="#fff" strokeWidth={2} filter="url(#g-shadow)" />
            <circle cx={x} cy={y} r={r} fill="url(#g-pin)" />
            <text x={x} y={y + 4.5} textAnchor="middle" className="pointer-events-none fill-white font-sans font-bold" style={{ fontSize: 13 }}>{p.members}</text>
            <text x={left ? x - r - 6 : x + r + 6} y={y + 5} textAnchor={left ? 'end' : 'start'} className="pointer-events-none fill-white font-sans font-semibold"
              style={{ fontSize: 15, paintOrder: 'stroke', stroke: 'rgba(5,20,35,0.85)', strokeWidth: 4, strokeLinejoin: 'round' }}>{p.name}</text>
          </g>
        );
      })}

      {visible(home.lng, home.lat) && (() => {
        const [x, y] = projection([home.lng, home.lat]) || [0, 0];
        return (
          <g className="cursor-pointer" onClick={(e) => { e.stopPropagation(); onPick('kurdistan'); }} onPointerDown={(e) => e.stopPropagation()}>
            <circle cx={x} cy={y} r={20} fill="#F2C14E" fillOpacity={0.25} className="map-pulse" />
            <circle cx={x} cy={y} r={12} fill="#7A2414" stroke="#F2C14E" strokeWidth={2.5} filter="url(#g-shadow)" />
            <circle cx={x} cy={y} r={12} fill="url(#g-pin)" />
            <text x={x} y={y + 4} textAnchor="middle" className="pointer-events-none fill-white font-sans font-bold" style={{ fontSize: 11 }}>{home.members}</text>
            <text x={x} y={y + 32} textAnchor="middle" className="pointer-events-none fill-[#F2C14E] font-sans font-bold"
              style={{ fontSize: 16, paintOrder: 'stroke', stroke: 'rgba(5,20,35,0.85)', strokeWidth: 4, strokeLinejoin: 'round' }}>{home.name}</text>
          </g>
        );
      })()}
    </svg>
  );
};
