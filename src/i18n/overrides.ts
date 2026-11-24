import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { Lang } from './lang';

/**
 * Corrections to the built-in Kurdish and Arabic translations, made by
 * administrators and translators in the website (Administration ›
 * Translations). Stored in translations/{ckb|ar} as { entries: { English: text } }
 * and applied on top of the built-in dictionaries for every visitor.
 */
export type Entries = Record<string, string>;

export const fetchOverrides = async (lang: Exclude<Lang, 'en'>): Promise<Entries> => {
  try {
    const s = await getDoc(doc(db, 'translations', lang));
    const e = s.exists() ? s.data().entries : null;
    return e && typeof e === 'object' ? (e as Entries) : {};
  } catch {
    return {}; // offline or blocked: the built-in translation is used
  }
};
