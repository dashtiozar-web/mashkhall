import React from 'react';
import { Users } from 'lucide-react';
import { useData } from '../context/DataContext';

/**
 * Live number of approved, active members. It is counted from the public
 * member profiles, which exist only for approved members: one per member
 * account (so nobody is counted twice), created on approval and removed when
 * a member is revoked or permanently deleted. Suspended members and
 * applications that are pending or declined are not counted.
 */
export const useMemberCount = () => {
  const { publicProfiles } = useData();
  const active = publicProfiles.filter((p) => p.membershipStatus !== 'suspended');
  return { total: new Set(active.map((p) => p.id)).size, profiles: active };
};

export const MemberCount: React.FC<{ onNavigate?: (tab: string) => void }> = ({ onNavigate }) => {
  const { chapters } = useData();
  const { total, profiles } = useMemberCount();
  const byCouncil = chapters
    .map((c) => ({ c, n: profiles.filter((p) => p.chapterId === c.id).length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n);

  return (
    <section aria-labelledby="membership-count" className="overflow-hidden rounded-3xl bg-navy text-white">
      <div className="grid gap-8 p-7 sm:p-10 lg:grid-cols-[auto_1fr] lg:items-center lg:gap-14">
        <div>
          <p className="flex items-center gap-2 text-[0.9375rem] font-semibold text-white/85"><Users className="h-5 w-5" aria-hidden="true" /> Our Membership</p>
          <h2 id="membership-count" className="sr-only">Total approved members</h2>
          <p className="mt-2 font-serif text-[4.5rem] leading-none font-semibold tabular-nums sm:text-[5.5rem]" aria-live="polite">{total.toLocaleString('en-GB')}</p>
          <p className="mt-2 text-[1.125rem] font-semibold">Total approved members</p>
        </div>
        <div>
          <p className="max-w-[52ch] text-[1.0625rem] leading-relaxed text-white/90">
            People in the five provinces of Kurdistan and in Britain, Australia, Canada, Germany and the USA who stand together for human rights, transparency and freedom of expression.
            The number updates by itself whenever a membership is approved.
          </p>
          {byCouncil.length > 0 && (
            <ul className="mt-5 flex flex-wrap gap-2">
              {byCouncil.map(({ c, n }) => (
                <li key={c.id} className="rounded-full bg-white/12 px-3 py-1 text-[0.9375rem]">
                  {c.name} <span className="font-semibold tabular-nums">{n}</span>
                </li>
              ))}
            </ul>
          )}
          {onNavigate && (
            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" onClick={() => onNavigate('apply')} className="cursor-pointer rounded-lg bg-[#F2C14E] px-6 py-3 text-[1.0625rem] font-bold text-[#2A110A] hover:bg-[#FFD36B]">Become a member</button>
              <button type="button" onClick={() => onNavigate('directory')} className="cursor-pointer rounded-lg px-3 py-2.5 font-semibold text-white underline underline-offset-4">Members by province and country</button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
