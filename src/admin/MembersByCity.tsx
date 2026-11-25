import React, { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { MemberApplication } from '../types';
import { ABROAD_IDS, COUNTRIES, PROVINCES, normaliseCity } from '../lib/places';

/**
 * How many members join from each city: in each province of Kurdistan and in
 * each country abroad, from the membership applications (approved members,
 * and applications still waiting). Only membership staff see this.
 */
export const MembersByCity: React.FC<{ applications: MemberApplication[] }> = ({ applications }) => {
  const [includeWaiting, setIncludeWaiting] = useState(true);

  const groups = useMemo(() => {
    const counted = applications.filter((a) => a.status === 'approved' || (includeWaiting && (a.status === 'submitted' || a.status === 'under_review')));
    const byGroup = new Map<string, Map<string, { approved: number; waiting: number }>>();
    for (const a of counted) {
      const g = a.chapterId || 'unknown';
      const city = normaliseCity(a.city) || 'City not given';
      if (!byGroup.has(g)) byGroup.set(g, new Map());
      const m = byGroup.get(g)!;
      const row = m.get(city) || { approved: 0, waiting: 0 };
      if (a.status === 'approved') row.approved += 1; else row.waiting += 1;
      m.set(city, row);
    }
    const make = (id: string, name: string, region: string) => {
      // Every city of a province is listed, even before anyone joins from it.
      const rows = new Map(byGroup.get(id) || new Map());
      for (const c of PROVINCES.find((p) => p.id === id)?.cities || []) if (!rows.has(c)) rows.set(c, { approved: 0, waiting: 0 });
      const cities = [...rows.entries()]
        .map(([city, r]) => ({ city, ...r, total: r.approved + r.waiting }))
        .sort((x, y) => y.total - x.total || x.city.localeCompare(y.city));
      return { id, name, region, cities, total: cities.reduce((s, c) => s + c.total, 0) };
    };
    return {
      kurdistan: PROVINCES.map((p) => make(p.id, p.name, 'Kurdistan')),
      abroad: ABROAD_IDS.map((id) => make(id, COUNTRIES.find((c) => c.id === id)!.name, 'Abroad')),
      other: [...byGroup.keys()].filter((g) => !PROVINCES.some((p) => p.id === g) && !ABROAD_IDS.includes(g)).map((g) => make(g, g === 'unknown' ? 'No place chosen' : `Earlier group: ${g}`, 'Other')),
    };
  }, [applications, includeWaiting]);

  const all = [...groups.kurdistan, ...groups.abroad, ...groups.other];
  const totalKurdistan = groups.kurdistan.reduce((s, g) => s + g.total, 0);

  const downloadCsv = () => {
    const rows = [['Region', 'Province or country', 'City', 'Approved members', 'Waiting']];
    for (const g of all) for (const c of g.cities) rows.push([g.region, g.name, c.city, String(c.approved), String(c.waiting)]);
    const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `members-by-city-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const Group: React.FC<{ g: (typeof all)[number] }> = ({ g }) => (
    <section className="rounded-2xl border border-line bg-surface">
      <div className="flex items-baseline justify-between gap-3 border-b border-line px-5 py-3">
        <h4 className="font-serif text-[1.25rem] font-semibold">{g.name}</h4>
        <span className="text-[0.9375rem] text-muted">{g.total} {g.total === 1 ? 'member' : 'members'}</span>
      </div>
      {g.cities.length === 0 ? (
        <p className="px-5 py-4 text-[0.9375rem] text-muted">No members yet.</p>
      ) : (
        <table className="w-full text-[0.9375rem]">
          <thead className="text-start text-[0.8125rem] text-muted">
            <tr><th className="px-5 py-2 text-start font-semibold">City or town</th><th className="px-3 py-2 text-end font-semibold">Approved</th><th className="px-5 py-2 text-end font-semibold">Waiting</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {g.cities.map((c) => (
              <tr key={c.city}>
                <td className="px-5 py-2" dir="auto">{c.city}</td>
                <td className="px-3 py-2 text-end tabular-nums">{c.approved}</td>
                <td className="px-5 py-2 text-end tabular-nums text-muted">{c.waiting}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-[1.75rem] font-semibold">Members by place</h2>
          <p className="mt-1 max-w-[60ch] text-ink-soft">How many members join from each city, in each province of Kurdistan and each country abroad. Taken from membership applications.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-[0.9375rem]">
            <input type="checkbox" checked={includeWaiting} onChange={(e) => setIncludeWaiting(e.target.checked)} className="h-4 w-4" />
            Include applications still waiting
          </label>
          <button type="button" onClick={downloadCsv} className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2 font-semibold hover:bg-stone">
            <Download className="h-4 w-4" aria-hidden="true" /> Download (CSV)
          </button>
        </div>
      </div>

      <div>
        <h3 className="mb-4 text-[1.375rem] font-semibold">Kurdistan <span className="text-[1rem] font-normal text-muted">· {totalKurdistan} {totalKurdistan === 1 ? 'member' : 'members'} in five provinces</span></h3>
        <div className="grid gap-5 lg:grid-cols-2">{groups.kurdistan.map((g) => <Group key={g.id} g={g} />)}</div>
      </div>
      <div>
        <h3 className="mb-4 text-[1.375rem] font-semibold">Abroad</h3>
        <div className="grid gap-5 lg:grid-cols-2">{groups.abroad.map((g) => <Group key={g.id} g={g} />)}</div>
      </div>
      {groups.other.some((g) => g.total > 0) && (
        <div>
          <h3 className="mb-4 text-[1.375rem] font-semibold">Without a current place</h3>
          <p className="mb-4 text-ink-soft">Applications made before the provinces and countries were introduced. Edit them in Applicants to move them to a place.</p>
          <div className="grid gap-5 lg:grid-cols-2">{groups.other.filter((g) => g.total > 0).map((g) => <Group key={g.id} g={g} />)}</div>
        </div>
      )}
    </div>
  );
};
