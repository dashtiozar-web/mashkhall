import React, { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { permissionTemplates, savePermissionTemplates } from '../lib/memberApi';
import { WEBADMIN_POSITIONS } from '../lib/positions';

const PERMISSION_LABEL: Record<string, string> = {
  manage_users: 'Manage user accounts',
  manage_members: 'Manage members and positions',
  manage_content: 'Review articles and content',
  publish_content: 'Publish content and banners',
  bulk_import: 'Import members',
  view_analytics: 'See statistics',
  manage_settings: 'Change site text and settings',
  manage_donations: 'Donations and fee payments',
  manage_notifications: 'Send notifications',
  manage_events: 'Manage activities',
  manage_translations: 'Edit Kurdish and Arabic translations',
};

/**
 * Website permissions for each Website Administration position. Holding the
 * position gives nothing by itself; when an administrator appoints someone
 * they can choose to grant these, and removing the person can take them away.
 */
export const WebAdminPermissions: React.FC = () => {
  const [templates, setTemplates] = useState<Record<string, string[]> | null>(null);
  const [all, setAll] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    permissionTemplates().then((t) => { setTemplates(t.templates); setAll(t.permissions); }).catch((e) => setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not load.' }));
  }, []);

  const toggle = (pos: string, perm: string) => setTemplates((t) => {
    if (!t) return t;
    const cur = t[pos] || [];
    return { ...t, [pos]: cur.includes(perm) ? cur.filter((x) => x !== perm) : [...cur, perm] };
  });

  const save = async () => {
    if (!templates) return;
    setBusy(true);
    setMsg(null);
    try {
      const t = await savePermissionTemplates(templates);
      setTemplates(t.templates);
      setMsg({ ok: true, text: 'Saved. These apply the next time you appoint someone and tick “grant the configured permissions”. People already appointed keep their current permissions.' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Not saved.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-line bg-surface p-6" aria-labelledby="webadmin-perms">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-navy" aria-hidden="true" />
        <div>
          <h3 id="webadmin-perms" className="text-[1.25rem] font-semibold">Website Administration positions and their permissions</h3>
          <p className="mt-1 max-w-[75ch] text-[0.9375rem] text-ink-soft">
            A position in Website Administration does not give any access by itself. Choose here what each position may be granted. When you appoint someone, you decide whether to grant these permissions to their account (identified by its account ID, never by name).
            Full administrator access is separate: it is granted only to the accounts listed as administrators below.
          </p>
        </div>
      </div>
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`mt-4 rounded-lg px-4 py-3 text-[0.9375rem] ${msg.ok ? 'bg-navy-tint' : 'border border-crimson/30 bg-crimson/5 text-crimson'}`}>{msg.text}</p>}
      {!templates ? <p className="mt-4 text-muted">Loading…</p> : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-start text-[0.875rem]">
            <thead>
              <tr className="border-b border-line text-muted">
                <th className="py-2 pe-3 font-semibold">Permission</th>
                {WEBADMIN_POSITIONS.map((p) => <th key={p.id} className="px-2 py-2 text-center font-semibold">{p.title.replace('Admin — Head of Website Administration', 'Admin (head)')}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {all.map((perm) => (
                <tr key={perm}>
                  <td className="py-2 pe-3">{PERMISSION_LABEL[perm] || perm}</td>
                  {WEBADMIN_POSITIONS.map((p) => (
                    <td key={p.id} className="px-2 py-2 text-center">
                      <input type="checkbox" aria-label={`${PERMISSION_LABEL[perm] || perm} for ${p.title}`} checked={(templates[p.id] || []).includes(perm)} onChange={() => toggle(p.id, perm)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex justify-end">
            <button type="button" disabled={busy} onClick={save} className="cursor-pointer rounded-lg bg-navy px-5 py-2 font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save permissions'}</button>
          </div>
        </div>
      )}
    </section>
  );
};
