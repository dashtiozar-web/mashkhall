import { doc } from 'firebase/firestore';
import { auth, db, safeSetDoc } from '../firebase';
import { UserNotification } from '../types';

/**
 * Send a personal notification to one signed-in user. Called when something
 * real happens to them (application decided, article reviewed, card issued…).
 * Failures never block the action that triggered them.
 */
export const notifyUser = async (
  userId: string | undefined,
  n: Pick<UserNotification, 'type' | 'title'> & Partial<Pick<UserNotification, 'body' | 'link'>>,
  id?: string,
) => {
  if (!userId || userId.startsWith('mem-')) return; // imported members have no account
  try {
    const nid = id || `un-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const record: UserNotification = {
      id: nid,
      userId,
      type: n.type,
      title: n.title.slice(0, 200),
      body: n.body?.slice(0, 2000),
      link: n.link,
      read: false,
      createdAt: new Date().toISOString(),
      createdBy: auth.currentUser?.uid,
    };
    await safeSetDoc(doc(db, 'user_notifications', nid), record);
  } catch (e) {
    console.warn('Notification not sent:', e);
  }
};
