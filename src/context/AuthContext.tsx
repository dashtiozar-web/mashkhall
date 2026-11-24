import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  signOut as fbSignOut, 
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, runTransaction, increment } from 'firebase/firestore';
import { periodKeys } from '../lib/points';
import { notifyUser } from '../lib/notify';
import { removeIfDeleted } from '../lib/deleteMember';
import { reportSecurityEvent } from '../lib/visits';
import { auth, db, googleProvider, handleFirestoreError, OperationType, safeSetDoc, safeUpdateDoc } from '../firebase';
import { Role, UserProfile, Permission, UserActivityRecord, ActivityTier } from '../types';
import { collection, deleteDoc } from 'firebase/firestore';

export const ROLE_DEFAULT_PERMISSIONS: Record<Role, Permission[]> = {
  owner: [
    'manage_users',
    'manage_members',
    'manage_content',
    'publish_content',
    'bulk_import',
    'view_analytics',
    'manage_settings',
    'manage_donations',
    'manage_notifications',
    'manage_translations'
  ],
  administrator: [
    'manage_users',
    'manage_members',
    'manage_content',
    'publish_content',
    'bulk_import',
    'view_analytics',
    'manage_settings',
    'manage_donations',
    'manage_notifications',
    'manage_translations'
  ],
  membership_reviewer: ['manage_members', 'view_analytics', 'bulk_import'],
  content_reviewer: ['manage_content', 'view_analytics'],
  publisher: ['manage_content', 'publish_content', 'view_analytics'],
  member: ['manage_content'],
  applicant: [],
  visitor: []
};

export const calculateActivityTier = (score: number = 0): ActivityTier => {
  if (score >= 500) return 'Diamond';
  if (score >= 300) return 'Platinum';
  if (score >= 150) return 'Gold';
  if (score >= 50) return 'Silver';
  return 'Bronze';
};

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  roles: Role[];
  permissions: Permission[];
  loading: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  isReviewer: boolean;
  isPublisher: boolean;
  isMember: boolean;
  hasRole: (role: Role) => boolean;
  hasAnyRole: (roles: Role[]) => boolean;
  hasPermission: (permission: Permission) => boolean;
  updateUserRolesAndPermissions: (targetUid: string, newRoles: Role[], newPermissions: Permission[]) => Promise<void>;
  /**
   * Award points to a member. Staff-only: the security rules reject this for
   * anyone else, so members can no longer give themselves points.
   */
  awardPoints: (targetUid: string, activity: {
    type: UserActivityRecord['type'];
    points: number;
    description: string;
    targetId?: string;
    targetTitle?: string;
  }) => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, displayName: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  updateProfileData: (updates: Partial<UserProfile>) => Promise<void>;
  reloadUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Bootstrapped owner email. Must match firestore.rules, which also requires
// the email to be VERIFIED — otherwise anyone could register this
// address with a password and gain owner rights. Other administrators
// are granted from the admin screen (stored in /admins).
const BOOTSTRAP_OWNER_EMAILS = ['dashtiozar@gmail.com'];
const isOwnerEmail = (user?: Pick<User, 'email' | 'emailVerified'> | null) =>
  Boolean(user?.email && user.emailVerified && BOOTSTRAP_OWNER_EMAILS.includes(user.email.toLowerCase()));

// Fields a user may change on their own account document (see firestore.rules).
const SELF_EDITABLE_PROFILE_FIELDS: (keyof UserProfile)[] = ['displayName', 'photoUrl', 'chapterId'];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  // An approved member record for this account (members/{uid}). The database
  // rules count it as membership even when the account's roles were never
  // updated (for example members added or imported by an administrator).
  const [hasMemberRecord, setHasMemberRecord] = useState(false);
  useEffect(() => {
    setHasMemberRecord(false);
    if (!currentUser || currentUser.isAnonymous) return;
    let live = true;
    getDoc(doc(db, 'members', currentUser.uid))
      .then((m) => { if (live) setHasMemberRecord(m.exists() && !['revoked', 'archived', 'suspended'].includes(String(m.data()?.status || ''))); })
      .catch(() => undefined);
    return () => { live = false; };
  }, [currentUser?.uid]);

  // Sync profile from Firestore or bootstrap
  const syncProfile = async (user: User) => {
    try {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      const isBootstrapOwner = isOwnerEmail(user);

      if (userSnap.exists()) {
        const data = userSnap.data() as UserProfile;
        let effectiveRoles = data.roles || ['visitor'];
        
        // Auto-assign owner & admin privileges to bootstrap email
        if (isBootstrapOwner && (!effectiveRoles.includes('owner') || !effectiveRoles.includes('administrator'))) {
          effectiveRoles = Array.from(new Set([...effectiveRoles, 'owner', 'administrator', 'member', 'publisher', 'content_reviewer', 'membership_reviewer']));
          await safeUpdateDoc(userRef, { 
            roles: effectiveRoles, 
            permissions: ROLE_DEFAULT_PERMISSIONS.owner,
            activityTier: data.activityTier || 'Diamond',
            updatedAt: new Date().toISOString() 
          });
          
          // Also guarantee admin doc presence
          const adminRef = doc(db, 'admins', user.uid);
          await safeSetDoc(adminRef, {
            uid: user.uid,
            email: user.email || '',
            role: 'owner',
            createdAt: new Date().toISOString()
          }, { merge: true });
        }

        setUserProfile({
          ...data,
          roles: effectiveRoles,
          permissions: data.permissions || (isBootstrapOwner ? ROLE_DEFAULT_PERMISSIONS.owner : []),
          activityScore: data.activityScore || (isBootstrapOwner ? 500 : 10),
          activityTier: data.activityTier || calculateActivityTier(data.activityScore || (isBootstrapOwner ? 500 : 10)),
        });
      } else {
        // Create initial user document
        const initialRoles: Role[] = isBootstrapOwner
          ? ['owner', 'administrator', 'member', 'publisher', 'content_reviewer', 'membership_reviewer']
          : ['visitor'];

        const initialScore = isBootstrapOwner ? 500 : 15;
        const newProfile: UserProfile = {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || user.email?.split('@')[0] || 'Member',
          photoUrl: user.photoURL || '',
          roles: initialRoles,
          permissions: isBootstrapOwner ? ROLE_DEFAULT_PERMISSIONS.owner : [],
          activityScore: initialScore,
          activityTier: calculateActivityTier(initialScore),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await safeSetDoc(userRef, newProfile);

        if (isBootstrapOwner) {
          const adminRef = doc(db, 'admins', user.uid);
          await safeSetDoc(adminRef, {
            uid: user.uid,
            email: user.email || '',
            role: 'owner',
            createdAt: new Date().toISOString(),
          });
        }

        setUserProfile(newProfile);
      }
    } catch (error) {
      console.warn('Error fetching or creating user profile in Firestore:', error);
      // Fallback in-memory profile if Firestore is initialising
      const isBootstrapOwner = isOwnerEmail(user);
      setUserProfile({
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || user.email?.split('@')[0] || 'Member',
        photoUrl: user.photoURL || undefined,
        roles: isBootstrapOwner 
          ? ['owner', 'administrator', 'member', 'publisher', 'content_reviewer', 'membership_reviewer']
          : ['visitor'],
        permissions: isBootstrapOwner ? ROLE_DEFAULT_PERMISSIONS.owner : [],
        activityScore: isBootstrapOwner ? 500 : 10,
        activityTier: isBootstrapOwner ? 'Diamond' : 'Bronze',
        createdAt: new Date().toISOString(),
      });
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // A visitor's temporary sign-in (used only to comment) is not an account.
      if (user?.isAnonymous) {
        setCurrentUser(null);
        setUserProfile(null);
        setLoading(false);
        return;
      }
      // Accounts of permanently deleted members remove themselves.
      if (user && (await removeIfDeleted())) {
        setCurrentUser(null);
        setUserProfile(null);
        setLoading(false);
        window.alert('This account has been removed by Mashkhally Zhyanawa Organisation.');
        return;
      }
      setCurrentUser(user);
      if (user) {
        await syncProfile(user);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const roles = useMemo<Role[]>(() => {
    if (!currentUser) return ['visitor'];
    if (isOwnerEmail(currentUser)) {
      return ['owner', 'administrator', 'member', 'publisher', 'content_reviewer', 'membership_reviewer'];
    }
    return userProfile?.roles || ['visitor'];
  }, [currentUser, userProfile]);

  const permissions = useMemo<Permission[]>(() => {
    if (!currentUser) return [];
    if (isOwnerEmail(currentUser)) {
      return [
        'manage_users',
        'manage_members',
        'manage_content',
        'publish_content',
        'bulk_import',
        'view_analytics',
        'manage_settings',
        'manage_donations',
        'manage_notifications',
        'manage_translations'
      ];
    }
    const currentRoles = roles;
    const fromRoles = currentRoles.flatMap(r => ROLE_DEFAULT_PERMISSIONS[r] || []);
    const custom = userProfile?.permissions || [];
    return Array.from(new Set([...fromRoles, ...custom]));
  }, [currentUser, roles, userProfile]);

  const hasRole = (role: Role) => roles.includes(role);
  const hasAnyRole = (checkRoles: Role[]) => checkRoles.some(r => roles.includes(r));

  const isOwner = hasRole('owner');
  const isAdmin = hasRole('owner') || hasRole('administrator');
  const isReviewer = isAdmin || hasRole('membership_reviewer') || hasRole('content_reviewer');
  const isPublisher = isAdmin || hasRole('publisher');
  const isMember = isAdmin || hasRole('member') || hasMemberRecord;

  const hasPermission = (permission: Permission): boolean => {
    if (!currentUser) return false;
    if (isOwnerEmail(currentUser)) return true;
    if (isAdmin) return true;
    return permissions.includes(permission);
  };

  const updateUserRolesAndPermissions = async (
    targetUid: string, 
    newRoles: Role[], 
    newPermissions: Permission[]
  ) => {
    if (!isAdmin) throw new Error('Unauthorized: only administrators can manage roles & permissions');
    const targetUserRef = doc(db, 'users', targetUid);
    const targetAdminRef = doc(db, 'admins', targetUid);

    await safeUpdateDoc(targetUserRef, {
      roles: newRoles,
      permissions: newPermissions,
      updatedAt: new Date().toISOString()
    });

    // If roles include admin or owner, ensure admin record
    if (newRoles.includes('administrator') || newRoles.includes('owner')) {
      const snap = await getDoc(targetUserRef);
      const email = snap.exists() ? snap.data().email : '';
      await safeSetDoc(targetAdminRef, {
        uid: targetUid,
        email: email || '',
        role: newRoles.includes('owner') ? 'owner' : 'administrator',
        createdAt: new Date().toISOString()
      }, { merge: true });
    } else {
      // Remove from admin record if present
      try {
        await deleteDoc(targetAdminRef);
      } catch (e) {
        // silent if doc didn't exist
      }
    }

    if (targetUid !== currentUser?.uid) {
      const ROLE_NAMES: Partial<Record<Role, string>> = {
        owner: 'Owner', administrator: 'Administrator', membership_reviewer: 'Membership reviewer',
        content_reviewer: 'Content reviewer', publisher: 'Publisher', member: 'Member', applicant: 'Applicant',
      };
      const names = newRoles.filter((r) => r !== 'visitor').map((r) => ROLE_NAMES[r] || r).join(', ');
      await notifyUser(targetUid, {
        type: 'membership',
        title: 'Your role on the website has changed',
        body: names ? `Your roles are now: ${names}.` : 'Your additional roles have been removed.',
        link: '/account',
      });
    }

    // If current logged-in user was updated, update in-memory profile
    if (currentUser && currentUser.uid === targetUid) {
      setUserProfile(prev => prev ? {
        ...prev,
        roles: newRoles,
        permissions: newPermissions
      } : null);
    }
  };

  const awardPoints = async (targetUid: string, activity: {
    type: UserActivityRecord['type'];
    points: number;
    description: string;
    targetId?: string;
    targetTitle?: string;
  }) => {
    if (!currentUser) throw new Error('Not authenticated');
    const activityId = `act-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const userRef = doc(db, 'users', targetUid);
    const profileRef = doc(db, 'public_profiles', targetUid);
    const actRef = doc(db, 'user_activities', activityId);

    // One transaction: the activity record, the private score and the public
    // leaderboard score always change together, with no lost updates.
    const result = await runTransaction(db, async (tx) => {
      const userSnap = await tx.get(userRef);
      const profileSnap = await tx.get(profileRef);
      const currentScore = (userSnap.exists() ? userSnap.data().activityScore : 0) || 0;
      const newScore = currentScore + activity.points;
      const newTier = calculateActivityTier(newScore);
      const now = new Date().toISOString();

      // No email on activity records: they are a points ledger, not a
      // record of who someone is.
      const actRecord: UserActivityRecord = {
        id: activityId,
        userId: targetUid,
        userEmail: '',
        userName: (userSnap.exists() ? userSnap.data().displayName : '') || 'Member',
        type: activity.type,
        points: activity.points,
        description: activity.description,
        targetId: activity.targetId || '',
        targetTitle: activity.targetTitle || '',
        timestamp: now,
      };
      tx.set(actRef, actRecord);
      if (userSnap.exists()) {
        tx.update(userRef, { activityScore: newScore, activityTier: newTier, updatedAt: now });
      }
      if (profileSnap.exists()) {
        // Public ranking totals: all-time, this month and this quarter.
        const keys = periodKeys();
        tx.update(profileRef, {
          activityScore: newScore,
          activityTier: newTier,
          [`points.${keys.all}`]: increment(activity.points),
          [`points.${keys.month}`]: increment(activity.points),
          [`points.${keys.quarter}`]: increment(activity.points),
          updatedAt: now,
        });
      }
      return { newScore, newTier };
    });

    if (currentUser.uid === targetUid) {
      setUserProfile(prev => prev ? {
        ...prev,
        activityScore: result.newScore,
        activityTier: result.newTier
      } : null);
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (e) {
      // Counted for the security dashboard (no email or address is sent).
      const code = (e as { code?: string }).code || '';
      if (/wrong-password|invalid-credential|user-not-found|too-many-requests/.test(code)) reportSecurityEvent('login_failed');
      throw e;
    }
  };

  const signUpWithEmail = async (email: string, pass: string, displayName: string) => {
    let res;
    try {
      res = await createUserWithEmailAndPassword(auth, email, pass);
    } catch (e) {
      reportSecurityEvent('signup_failed');
      throw e;
    }
    if (res.user) {
      await updateProfile(res.user, { displayName });
      try {
        await sendEmailVerification(res.user);
      } catch (e) {
        console.warn('Could not send verification email automatically:', e);
      }
      await syncProfile(res.user);
    }
  };

  const signInWithGoogle = async () => {
    const res = await signInWithPopup(auth, googleProvider);
    if (res.user) {
      await syncProfile(res.user);
    }
  };

  const signOut = async () => {
    await fbSignOut(auth);
    setCurrentUser(null);
    setUserProfile(null);
  };

  const sendPasswordReset = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const resendVerificationEmail = async () => {
    if (auth.currentUser) {
      await sendEmailVerification(auth.currentUser);
    }
  };

  const updateProfileData = async (updates: Partial<UserProfile>) => {
    if (!currentUser) throw new Error('Not authenticated');
    const userRef = doc(db, 'users', currentUser.uid);
    // Only send fields users are allowed to change themselves; roles,
    // permissions and points are managed by staff.
    const allowed = Object.fromEntries(
      Object.entries(updates).filter(([key]) => SELF_EDITABLE_PROFILE_FIELDS.includes(key as keyof UserProfile))
    ) as Partial<UserProfile>;
    if (Object.keys(allowed).length === 0) return;
    try {
      await safeUpdateDoc(userRef, {
        ...allowed,
        updatedAt: new Date().toISOString(),
      });
      setUserProfile(prev => prev ? { ...prev, ...allowed } : null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${currentUser.uid}`);
    }
  };

  const reloadUser = async () => {
    if (auth.currentUser) {
      await auth.currentUser.reload();
      setCurrentUser(auth.currentUser);
      await syncProfile(auth.currentUser);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        roles,
        permissions,
        loading,
        isOwner,
        isAdmin,
        isReviewer,
        isPublisher,
        isMember,
        hasRole,
        hasAnyRole,
        hasPermission,
        updateUserRolesAndPermissions,
        awardPoints,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        signOut,
        sendPasswordReset,
        resendVerificationEmail,
        updateProfileData,
        reloadUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
