import { useEffect, useState } from 'react';
import { collection, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { MembershipTier, isTier } from './tiers';

/**
 * Who is Pêşeng, Piştîwan or Komar is private. Only Pêşeng members and
 * membership staff can see it; Piştîwan and Komar members and visitors see
 * only how many members there are.
 */
export const useTiers = () => {
  const { currentUser, isAdmin, userProfile } = useAuth();
  const staff = isAdmin || Boolean(userProfile?.roles?.includes('membership_reviewer'));
  const [peshang, setPeshang] = useState(false);
  const [tiers, setTiers] = useState<Map<string, MembershipTier>>(new Map());

  useEffect(() => {
    let alive = true;
    setPeshang(false);
    if (!currentUser || staff) return;
    getDoc(doc(db, 'members', currentUser.uid))
      .then((s) => { if (alive) setPeshang(s.exists() && s.data().tier === 'peshang' && s.data().status === 'active'); })
      .catch(() => { /* not a member */ });
    return () => { alive = false; };
  }, [currentUser, staff]);

  const canSee = Boolean(currentUser) && (staff || peshang);

  useEffect(() => {
    if (!canSee) { setTiers(new Map()); return; }
    return onSnapshot(collection(db, 'member_tiers'), (snap) => {
      const m = new Map<string, MembershipTier>();
      snap.forEach((d) => { const t = d.data().tier; if (isTier(t)) m.set(d.id, t); });
      setTiers(m);
    }, () => setTiers(new Map()));
  }, [canSee]);

  return { canSee, tierOf: (id: string) => tiers.get(id), tiers };
};
