import React, { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { useLandmarkPhoto } from './LandmarkImage';
import { ABROAD_IDS, COUNTRIES, PROVINCES, PROVINCE_IDS } from '../lib/places';

/** A small landmark photograph for a place (tries the next photo if one fails). */
const Thumb: React.FC<{ id: string }> = ({ id }) => {
  const { src, failed } = useLandmarkPhoto({ id });
  return src
    ? <img src={src.replace('width=1920', 'width=320')} alt="" onError={failed} referrerPolicy="no-referrer" loading="lazy" className="h-11 w-16 shrink-0 rounded-md bg-stone-deep object-cover ring-1 ring-line" />
    : <span className="h-11 w-16 shrink-0 rounded-md bg-stone-deep ring-1 ring-line" aria-hidden="true" />;
};

/**
 * How many approved members there are in each country abroad and in each of
 * the five provinces of Kurdistan, from the public member list.
 */
export const MembersByPlace: React.FC<{ onOpen?: (slug: string) => void }> = ({ onOpen }) => {
  const { chapters, publicProfiles } = useData();
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of publicProfiles) if (p.chapterId) m.set(p.chapterId, (m.get(p.chapterId) || 0) + 1);
    return m;
  }, [publicProfiles]);

  const abroad = ABROAD_IDS.map((id) => ({ id, name: COUNTRIES.find((c) => c.id === id)!.name, ku: COUNTRIES.find((c) => c.id === id)!.ku, n: counts.get(id) || 0 }));
  const provinces = PROVINCE_IDS.map((id) => {
    const p = PROVINCES.find((x) => x.id === id)!;
    return { id, name: p.name, ku: p.ku, n: counts.get(id) || 0 };
  });
  const totalKurdistan = provinces.reduce((a, b) => a + b.n, 0);
  const totalAbroad = abroad.reduce((a, b) => a + b.n, 0);
  const max = Math.max(1, ...abroad.map((a) => a.n), ...provinces.map((p) => p.n));
  const slugOf = (id: string) => chapters.find((c) => c.id === id)?.slug || id;

  const Row: React.FC<{ r: { id: string; name: string; ku: string; n: number } }> = ({ r }) => (
    <li>
      <button type="button" onClick={() => onOpen?.(slugOf(r.id))}
        className="group flex w-full cursor-pointer items-center gap-4 rounded-xl px-3 py-2.5 text-start hover:bg-stone">
        <Thumb id={r.id} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-3">
            <span className="font-semibold text-ink group-hover:underline">{r.name}
              <span className="ku-sub ms-2 font-kurdish text-[0.9375rem] font-normal text-muted" lang="ckb" dir="rtl" translate="no">{r.ku}</span>
            </span>
            <span className="shrink-0 text-[0.9375rem] tabular-nums text-ink-soft">{r.n} {r.n === 1 ? 'member' : 'members'}</span>
          </span>
          <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-stone-deep">
            <span className="block h-full rounded-full bg-gradient-to-r from-crimson via-ember to-amber" style={{ width: `${Math.max(2, (r.n / max) * 100)}%` }} />
          </span>
        </span>
      </button>
    </li>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-3xl border border-line bg-surface p-5 sm:p-6" aria-labelledby="mbp-kurdistan">
        <div className="mb-3 flex items-baseline justify-between gap-3 px-3">
          <h3 id="mbp-kurdistan" className="text-[1.375rem] font-semibold">Members in Kurdistan</h3>
          <span className="text-[0.9375rem] text-muted">{totalKurdistan} in five provinces</span>
        </div>
        <ul className="space-y-1">{provinces.map((r) => <Row key={r.id} r={r} />)}</ul>
      </section>
      <section className="rounded-3xl border border-line bg-surface p-5 sm:p-6" aria-labelledby="mbp-abroad">
        <div className="mb-3 flex items-baseline justify-between gap-3 px-3">
          <h3 id="mbp-abroad" className="text-[1.375rem] font-semibold">Members abroad</h3>
          <span className="text-[0.9375rem] text-muted">{totalAbroad} in five countries</span>
        </div>
        <ul className="space-y-1">{abroad.map((r) => <Row key={r.id} r={r} />)}</ul>
      </section>
    </div>
  );
};
