import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  limit,
  increment,
  writeBatch,
  runTransaction,
  Query
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, cleanFirestoreData, safeSetDoc, safeUpdateDoc } from '../firebase';
import { useAuth } from './AuthContext';
import { notifyUser } from '../lib/notify';
import { addAwardToBatch, alreadyAwarded, awardPoints as ledgerAward, POINT_VALUES, reactionEntry } from '../lib/ledger';
import { positionById, positionOf, positionTitle } from '../lib/positions';
import { countPublishedVisitorWork } from '../lib/contributions';
import { statedMemberSince } from '../lib/membership';
import { 
  CityChapter, 
  Article, 
  Banner, 
  DonationConfig, 
  PublicProfile, 
  SiteSettings, 
  ContactEnquiry, 
  MemberApplication,
  MemberRecord,
  AuditLog,
  UserActivityRecord,
  MemberHierarchyLevel
} from '../types';
import { 
  INITIAL_CHAPTERS, 
  INITIAL_TIMELINE, 
  INITIAL_FAQS, 
  INITIAL_AREAS_OF_WORK, 
} from '../data/initialData';

interface DataContextType {
  chapters: CityChapter[];
  articles: Article[];
  banners: Banner[];
  activeBanners: Banner[];
  donationConfig: DonationConfig | null;
  publicProfiles: PublicProfile[];
  siteSettings: SiteSettings;
  userActivities: UserActivityRecord[];
  loading: boolean;
  submitContactEnquiry: (enquiry: Omit<ContactEnquiry, 'id' | 'createdAt' | 'status'>) => Promise<void>;
  submitMembershipApplication: (app: Omit<MemberApplication, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => Promise<string>;
  updateMembershipApplication: (id: string, updates: Partial<MemberApplication>, staffNotes?: string, feedback?: string) => Promise<void>;
  createArticleSubmission: (article: Partial<Article>) => Promise<string>;
  updateArticleStatus: (id: string, status: Article['status'], feedback?: string) => Promise<void>;
  incrementArticleView: (articleId: string) => Promise<void>;
  toggleArticleLike: (articleId: string) => Promise<boolean>;
  incrementArticleShare: (articleId: string) => Promise<void>;
  bulkImportMembers: (membersData: Partial<MemberRecord>[]) => Promise<{ success: number; failed: number }>;
  fetchUserActivities: (userId?: string) => Promise<UserActivityRecord[]>;
  updateDonationSettings: (config: Partial<DonationConfig>, isPublish?: boolean, unpublish?: boolean) => Promise<void>;
  saveBanner: (banner: Partial<Banner>) => Promise<void>;
  deleteBanner: (id: string) => Promise<void>;
  saveChapter: (chapter: Partial<CityChapter>) => Promise<void>;
  updateSiteSettings: (updates: Partial<SiteSettings>) => Promise<void>;
  addAuditLog: (action: string, targetType: string, targetId: string, details: string) => Promise<void>;
  seedInitialDataToFirestore: () => Promise<void>;
}

const defaultSiteSettings: SiteSettings = {
  id: 'default',
  mission: 'We inform, connect, and mobilise communities to challenge injustice peacefully, promote transparency, and uphold human rights worldwide.',
  background: '17 Shubat Organization describes its founding date as 17 February 2015, inspired by peaceful civil demonstrations in Kurdistan in February 2011 calling for institutional transparency, freedom of expression, and an end to systemic corruption. Our work is dedicated to peaceful human-rights advocacy, research, and grassroots solidarity.',
  history: INITIAL_TIMELINE,
  faqs: INITIAL_FAQS,
  areasOfWork: INITIAL_AREAS_OF_WORK,
  updatedAt: new Date().toISOString(),
};

const DataContext = createContext<DataContextType | undefined>(undefined);

// Engagement score is derived from the counters on read rather than stored,
// so it can never drift from them or be written by visitors.
const computeEngagement = (a: Partial<Article>) =>
  (a.viewsCount || 0) + (a.likesCount || 0) * 5 + (a.sharesCount || 0) * 10;
const withEngagement = (a: Article): Article => ({ ...a, engagementScore: computeEngagement(a) });

// Directory consent from a CSV cell must be an explicit yes. Anything else
// (blank, "no", "false", missing column) means the person stays private.
const parseConsent = (value: unknown): boolean => {
  if (value === true) return true;
  if (typeof value !== 'string') return false;
  return ['yes', 'y', 'true', '1', 'public', 'consented'].includes(value.trim().toLowerCase());
};

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, isAdmin, hasAnyRole, awardPoints } = useAuth();
  const canSeeAllArticles = isAdmin || hasAnyRole(['content_reviewer', 'publisher']);
  const canPublish = isAdmin || hasAnyRole(['publisher']);
  const currentUid = currentUser?.uid;
  const [chapters, setChapters] = useState<CityChapter[]>(INITIAL_CHAPTERS);
  const [articles, setArticles] = useState<Article[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [donationConfig, setDonationConfig] = useState<DonationConfig | null>(null);
  const [publicProfiles, setPublicProfiles] = useState<PublicProfile[]>([]);
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(defaultSiteSettings);
  const [userActivities, setUserActivities] = useState<UserActivityRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Subscribe to public chapters
  useEffect(() => {
    try {
      const q = collection(db, 'chapters');
      const unsubscribe = onSnapshot(q, (snapshot) => {
        // Saved councils override the built-in six; councils added by
        // administrators are added to them.
        const loaded = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as CityChapter));
        const byId = new Map(loaded.map((c) => [c.id, c]));
        const merged = [
          ...INITIAL_CHAPTERS.map((c) => ({ ...c, ...(byId.get(c.id) || {}) })),
          ...loaded.filter((c) => !INITIAL_CHAPTERS.some((i) => i.id === c.id)),
        ].filter((c) => !c.isArchived);
        merged.sort((a, b) => (a.displayOrder || 99) - (b.displayOrder || 99));
        setChapters(merged);
      }, (err) => {
        console.warn('Councils snapshot note (using initial data):', err);
        setChapters(INITIAL_CHAPTERS);
      });
      return () => unsubscribe();
    } catch {
      setChapters(INITIAL_CHAPTERS);
    }
  }, []);

  // Subscribe to articles. The security rules only allow reading published
  // articles, your own drafts, or (for editorial staff) everything, so each
  // query asks for exactly what this person may see.
  useEffect(() => {
    const sources = new Map<string, Article[]>();
    const publish = () => {
      const merged = new Map<string, Article>();
      sources.forEach(list => list.forEach(a => merged.set(a.id, a)));
      const all = Array.from(merged.values());
      setArticles(all);
    };
    const listen = (key: string, q: Query) => onSnapshot(q, (snapshot) => {
      sources.set(key, snapshot.docs.map(d => withEngagement({ ...d.data(), id: d.id } as Article)));
      publish();
    }, (err) => {
      console.warn(`Articles (${key}) subscription note:`, err);
    });

    const unsubscribers: (() => void)[] = [];
    try {
      const articlesCol = collection(db, 'articles');
      if (canSeeAllArticles) {
        unsubscribers.push(listen('all', articlesCol));
      } else {
        unsubscribers.push(listen('published', query(articlesCol, where('status', '==', 'published'))));
        if (currentUid) {
          unsubscribers.push(listen('mine', query(articlesCol, where('authorUid', '==', currentUid))));
        }
      }
    } catch {
      setArticles([]);
    }
    return () => unsubscribers.forEach(unsub => unsub());
  }, [canSeeAllArticles, currentUid]);

  // Subscribe to public profiles (directory)
  useEffect(() => {
    try {
      const q = collection(db, 'public_profiles');
      const unsubscribe = onSnapshot(q, (snapshot) => {
        // Only real, consented profiles are ever shown publicly.
        // Suspended members are hidden from the directory until reactivated.
        setPublicProfiles(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as PublicProfile)).filter(p => p.membershipStatus !== 'suspended'));
      }, (err) => {
        console.warn('Public profiles note:', err);
        setPublicProfiles([]);
      });
      return () => unsubscribe();
    } catch {
      setPublicProfiles([]);
    }
  }, []);

  // Subscribe to site announcements & banners
  useEffect(() => {
    try {
      const q = collection(db, 'banners');
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const loaded = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Banner));
        setBanners(loaded);
      }, (err) => {
        console.warn('Banners note:', err);
      });
      return () => unsubscribe();
    } catch {
      // No banners
    }
  }, []);

  // Subscribe to donation settings
  useEffect(() => {
    try {
      const docRef = doc(db, 'donation_config', 'published');
      const unsubscribe = onSnapshot(docRef, (snap) => {
        if (snap.exists()) {
          setDonationConfig(snap.data() as DonationConfig);
        } else {
          setDonationConfig(null);
        }
      }, (err) => {
        console.warn('Donation config note:', err);
      });
      return () => unsubscribe();
    } catch {
      setDonationConfig(null);
    }
  }, []);

  // Subscribe to site settings
  useEffect(() => {
    try {
      const docRef = doc(db, 'site_settings', 'default');
      const unsubscribe = onSnapshot(docRef, (snap) => {
        if (snap.exists()) {
          setSiteSettings(snap.data() as SiteSettings);
        } else {
          setSiteSettings(defaultSiteSettings);
        }
        setLoading(false);
      }, (err) => {
        console.warn('Site settings note:', err);
        setSiteSettings(defaultSiteSettings);
        setLoading(false);
      });
      return () => unsubscribe();
    } catch {
      setSiteSettings(defaultSiteSettings);
      setLoading(false);
    }
  }, []);

  // Activity history is private. Only admins see the organisation-wide feed;
  // members load their own history via fetchUserActivities.
  useEffect(() => {
    if (!isAdmin) {
      setUserActivities([]);
      return;
    }
    try {
      const q = query(collection(db, 'user_activities'), orderBy('timestamp', 'desc'), limit(200));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const loaded = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as UserActivityRecord));
        setUserActivities(loaded);
      }, (err) => {
        console.warn('User activities subscription note:', err);
      });
      return () => unsubscribe();
    } catch {
      // ignore if collection is new
    }
  }, [isAdmin]);

  // Active banners based on scheduling
  const activeBanners = banners.filter(b => {
    if (b.status !== 'published') return false;
    const now = new Date().toISOString();
    if (b.startAt && b.startAt > now) return false;
    if (b.endAt && b.endAt < now) return false;
    return true;
  }).sort((a, b) => (b.priority || 0) - (a.priority || 0));

  // Add audit log helper
  const addAuditLog = async (action: string, targetType: string, targetId: string, details: string) => {
    if (!currentUser) return;
    const logId = `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const logData: AuditLog = {
      id: logId,
      actorUid: currentUser.uid,
      actorEmail: currentUser.email || 'unknown',
      action,
      targetType,
      targetId,
      details,
      timestamp: new Date().toISOString(),
    };
    try {
      await safeSetDoc(doc(db, 'audit_logs', logId), logData);
    } catch (e) {
      console.warn('Audit log write error:', e);
    }
  };

  // Submit contact enquiry
  const submitContactEnquiry = async (enquiry: Omit<ContactEnquiry, 'id' | 'createdAt' | 'status'>) => {
    const id = `enq-${Date.now()}`;
    const newEnquiry: ContactEnquiry = {
      ...enquiry,
      id,
      status: 'new',
      createdAt: new Date().toISOString(),
    };
    try {
      await safeSetDoc(doc(db, 'contact_enquiries', id), newEnquiry);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'contact_enquiries');
    }
  };

  // Submit membership application
  const submitMembershipApplication = async (appData: Omit<MemberApplication, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => {
    if (!currentUser) throw new Error('Must be signed in to submit an application');
    const id = `app-${currentUser.uid}`;
    const now = new Date().toISOString();
    const newApplication: MemberApplication = {
      ...appData,
      phone: appData.phone ?? '',
      skills: appData.skills ?? '',
      photoUrl: appData.photoUrl ?? '',
      id,
      userId: currentUser.uid,
      status: 'submitted',
      createdAt: now,
      updatedAt: now,
    };
    try {
      await safeSetDoc(doc(db, 'applications', id), newApplication, { merge: true });
      
      // Update photoUrl on user profile doc if uploaded
      if (appData.photoUrl) {
        try {
          await safeSetDoc(doc(db, 'users', currentUser.uid), {
            photoUrl: appData.photoUrl,
            updatedAt: now
          }, { merge: true });
        } catch (uErr) {
          console.warn('User profile photo sync note:', uErr);
        }
      }

      try {
        await addAuditLog('APPLICATION_SUBMITTED', 'applications', id, `Application submitted by ${appData.fullName} for council ${appData.chapterId}`);
      } catch (logErr) {
        console.warn('Audit log write error ignored:', logErr);
      }

      return id;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `applications/${id}`);
    }
  };

  // Update membership application (approve, reject, changes_requested)
  const updateMembershipApplication = async (
    id: string, 
    updates: Partial<MemberApplication>, 
    staffNotes?: string, 
    feedback?: string
  ) => {
    if (!currentUser) throw new Error('Not authenticated');
    const appRef = doc(db, 'applications', id);
    const now = new Date().toISOString();
    
    const patch: Partial<MemberApplication> = {
      ...updates,
      updatedAt: now,
      reviewerUid: currentUser.uid,
    };
    if (staffNotes !== undefined) patch.staffNotes = staffNotes;
    if (feedback !== undefined) patch.applicantFeedback = feedback;

    try {
      if (updates.status !== 'approved') {
        await safeUpdateDoc(appRef, patch);
      } else {
        // Approval is one transaction: the application status, the private
        // member record, the 'member' role and (only with consent) the public
        // profile either all change or none do. It deliberately does not
        // touch the member-number counter, so approval cannot fail because of
        // it; the number is allocated in a separate step below.
        const appSnap = await getDoc(appRef);
        if (!appSnap.exists()) throw new Error('This application no longer exists.');
        const app = appSnap.data() as MemberApplication;
        const memberId = app.userId;
        const memberRef = doc(db, 'members', memberId);
        const userRef = doc(db, 'users', app.userId);
        const chapter = chapters.find(c => c.id === app.chapterId);

        await runTransaction(db, async (tx) => {
          const existingMember = await tx.get(memberRef);
          const userSnap = await tx.get(userRef);
          const existing = existingMember.exists() ? (existingMember.data() as MemberRecord) : null;

          tx.update(appRef, cleanFirestoreData(patch) as Record<string, unknown>);

          const memberRecord: MemberRecord = {
            id: memberId,
            userId: app.userId,
            // The membership number (M0000000) is assigned when the card is
            // issued, straight after approval.
            memberNumber: existing?.memberNumber || '',
            fullName: app.fullName,
            displayName: app.displayName,
            email: app.email,
            phone: app.phone || '',
            chapterId: app.chapterId,
            status: 'active',
            roles: ['member'],
            // Every approved member is shown publicly (organisation policy).
            consentToDirectory: true,
            photoUrl: app.photoUrl || '',
            ...(app.involvement ? { involvement: app.involvement } : {}),
            // New members start as Member; positions come from appointments
            // (Organisation structure), which update the title.
            positionId: positionOf({ positionId: existing?.positionId }),
            department: positionById(positionOf({ positionId: existing?.positionId }))?.department,
            designation: positionTitle(positionOf({ positionId: existing?.positionId })),
            // The date the applicant said they became a member (or, for new
            // members, the day they applied); the reviewer can change it.
            joinedAt: existing?.joinedAt || statedMemberSince(app),
            appliedAt: existing?.appliedAt || app.createdAt || now,
            updatedAt: now,
          };
          tx.set(memberRef, cleanFirestoreData(memberRecord), { merge: true });

          if (userSnap.exists()) {
            const currentRoles = (userSnap.data()?.roles || []) as string[];
            if (!currentRoles.includes('member')) {
              tx.update(userRef, { roles: [...currentRoles, 'member'], updatedAt: now });
            }
          }

          // Every approved member gets a public directory entry. The
          // motivation statement and skills from the application are NOT
          // copied: they were written for reviewers, not for the public.
          {
            const pubProfile: Partial<PublicProfile> = {
              id: memberId,
              userId: app.userId,
              displayName: app.displayName,
              photoUrl: app.photoUrl || '',
              chapterId: app.chapterId,
              chapterName: chapter?.name || app.chapterId,
              positionId: memberRecord.positionId,
              department: memberRecord.department,
              designation: memberRecord.designation,
              membershipStatus: 'active',
              // When the member joined the website (for council growth figures).
              listedAt: now,
              updatedAt: now,
            };
            tx.set(doc(db, 'public_profiles', memberId), cleanFirestoreData(pubProfile), { merge: true });
          }
        });

      }

      await addAuditLog('APPLICATION_STATUS_UPDATED', 'applications', id, `Status updated to ${updates.status}`);

      // Tell the applicant what happened.
      const applicantId = id.startsWith('app-') ? id.slice(4) : undefined;
      const messages: Partial<Record<string, { title: string; body?: string }>> = {
        approved: { title: 'Your membership application has been approved', body: 'Welcome to 17 Shubat. Your membership card will be issued shortly.' },
        changes_requested: { title: 'The membership committee has asked for changes', body: feedback || 'Please update your application and send it again.' },
        rejected: { title: 'Update on your membership application', body: feedback || 'Your application was not accepted this time.' },
        under_review: { title: 'Your application is being reviewed', body: 'The membership committee has started reviewing your application.' },
      };
      const msg = updates.status ? messages[updates.status] : undefined;
      if (msg) await notifyUser(applicantId, { type: 'application', title: msg.title, body: msg.body, link: updates.status === 'approved' ? '/account' : '/join' });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `applications/${id}`);
    }
  };

  // Create article submission
  const createArticleSubmission = async (articleData: Partial<Article>) => {
    if (!currentUser) throw new Error('Must be signed in to create an article');
    const id = articleData.id || `art-${Date.now()}`;
    const now = new Date().toISOString();
    // Only publishers may publish directly; everyone else goes through review.
    const requestedStatus = articleData.status;
    const status: Article['status'] = canPublish
      ? (requestedStatus || 'published')
      : (requestedStatus === 'draft' ? 'draft' : 'submitted');
    const words = (articleData.content || '').split(/\s+/).filter(Boolean).length;
    const readingTimeMinutes = Math.max(1, Math.ceil(words / 200));

    const fullArticle: Article = {
      id,
      title: articleData.title || 'Untitled Post',
      // Titles in Kurdish have no Latin letters for an address; use the id then.
      slug: (articleData.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || id,
      excerpt: articleData.excerpt || '',
      content: articleData.content || '',
      coverImageUrl: articleData.coverImageUrl,
      coverImageAlt: articleData.coverImageAlt,
      videoUrl: articleData.videoUrl,
      direction: articleData.direction === 'rtl' ? 'rtl' : 'ltr',
      language: articleData.language || (articleData.direction === 'rtl' ? 'ckb' : 'en'),
      category: articleData.category || 'political',
      tags: articleData.tags || [],
      chapterId: articleData.chapterId,
      authorUid: currentUser.uid,
      authorDisplayName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Member Author',
      isOfficialNews: canSeeAllArticles ? (articleData.isOfficialNews || false) : false,
      contentType: articleData.contentType || 'article',
      status,
      publishedAt: status === 'published' ? now : undefined,
      viewsCount: 0,
      likesCount: 0,
      sharesCount: 0,
      readingTimeMinutes,
      engagementScore: 0,
      createdAt: articleData.createdAt || now,
      updatedAt: now,
    };

    try {
      await safeSetDoc(doc(db, 'articles', id), fullArticle);
      await addAuditLog('ARTICLE_SAVED', 'articles', id, `Article "${fullArticle.title}" saved with status: ${fullArticle.status}`);
      
      // Points are awarded when an article is published, not on submission.
      if (fullArticle.status === 'published') {
        try {
          // 25 points, once per article (the ledger id is unique per article).
          await ledgerAward(currentUser.uid, 'article_published', POINT_VALUES.article_published, { targetId: id, targetTitle: fullArticle.title, userName: fullArticle.authorDisplayName });
        } catch (pointsErr) {
          console.warn('Could not award publication points:', pointsErr);
        }
      }

      return id;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `articles/${id}`);
    }
  };

  // Update article status (publish, request changes, reject)
  const updateArticleStatus = async (id: string, status: Article['status'], feedback?: string) => {
    if (!currentUser) throw new Error('Not authenticated');
    const now = new Date().toISOString();
    const patch: Partial<Article> = {
      status,
      updatedAt: now,
    };
    if (status === 'published') {
      patch.publishedAt = now;
    }
    if (feedback !== undefined && feedback.trim()) {
      patch.reviewerFeedback = feedback.trim();
    }
    let previous = articles.find(a => a.id === id);
    if (!previous) {
      try {
        const snap = await getDoc(doc(db, 'articles', id));
        if (snap.exists()) previous = { ...(snap.data() as Article), id: snap.id };
      } catch { /* not readable */ }
    }
    try {
      await safeUpdateDoc(doc(db, 'articles', id), patch);
      // A visitor's published work counts towards their discounts, once.
      if (status === 'published' && previous?.contributorType === 'visitor') {
        try {
          await countPublishedVisitorWork(previous);
        } catch (countErr) {
          console.warn('Could not count the published submission:', countErr);
        }
      }
      if (status === 'published' && previous && previous.status !== 'published' && previous.authorUid && previous.contributorType !== 'visitor') {
        try {
          await ledgerAward(previous.authorUid, 'article_published', POINT_VALUES.article_published, { targetId: id, targetTitle: previous.title, userName: previous.authorDisplayName });
        } catch (pointsErr) {
          console.warn('Could not award publication points:', pointsErr);
        }
      }
      await addAuditLog('ARTICLE_STATUS_UPDATED', 'articles', id, `Article status changed to ${status}. Feedback: ${feedback || 'None'}`);

      // Tell the author.
      if (previous?.authorUid && previous.authorUid !== currentUser.uid) {
        const msgs: Partial<Record<Article['status'], string>> = {
          published: `Your article "${previous.title}" has been published`,
          approved: `Your article "${previous.title}" has been approved`,
          changes_requested: `Changes requested to "${previous.title}"`,
          archived: `Your article "${previous.title}" was not accepted`,
          under_review: `Your article "${previous.title}" is being reviewed`,
        };
        const title = msgs[status];
        if (title) {
          await notifyUser(previous.authorUid, {
            type: 'article',
            title,
            body: feedback?.trim() || undefined,
            link: status === 'published' ? `/news/${encodeURIComponent(previous.slug || previous.id)}` : '/account',
          });
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `articles/${id}`);
    }
  };

  // Engagement counters. Each write moves one counter by exactly one step with
  // increment(), so simultaneous readers never overwrite each other's counts.
  // Reading, liking and sharing no longer earn points: that made the
  // leaderboard trivially gameable and created a public log of who read what.
  const bumpLocalCounter = (articleId: string, field: 'viewsCount' | 'likesCount' | 'sharesCount', delta: number) => {
    setArticles(prev => prev.map(a => a.id === articleId
      ? withEngagement({ ...a, [field]: Math.max(0, (a[field] || 0) + delta) })
      : a));
  };

  const findPublished = (articleId: string) => {
    const art = articles.find(a => a.id === articleId || a.slug === articleId);
    return art && art.status === 'published' ? art : undefined;
  };

  // 1. Increment Article View (once per browser session)
  const incrementArticleView = async (articleId: string) => {
    const art = findPublished(articleId);
    if (!art) return;
    // Count each reader once a day on each device, so refreshing the page or
    // coming back to it later the same day does not inflate the number.
    const key = `17shubat_viewed_${art.id}`;
    try {
      const last = Number(localStorage.getItem(key) || 0);
      if (last && Date.now() - last < 24 * 3_600_000) return;
      localStorage.setItem(key, String(Date.now()));
    } catch {
      try {
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, '1');
      } catch {
        // storage unavailable — count the view anyway
      }
    }

    bumpLocalCounter(art.id, 'viewsCount', 1);
    try {
      await updateDoc(doc(db, 'articles', art.id), { viewsCount: increment(1) });
    } catch (err) {
      console.warn('Could not update article views:', err);
    }
  };

  // 2. Toggle Article Like — one like per signed-in member, enforced by a
  // per-user like document written in the same batch as the counter.
  const toggleArticleLike = async (articleId: string): Promise<boolean> => {
    const art = findPublished(articleId);
    if (!art || !currentUser) return false;

    const articleRef = doc(db, 'articles', art.id);
    const likeRef = doc(db, 'articles', art.id, 'likes', currentUser.uid);
    let wasLiked = false;
    try {
      wasLiked = (await getDoc(likeRef)).exists();
      const batch = writeBatch(db);
      if (wasLiked) {
        batch.delete(likeRef);
        batch.update(articleRef, { likesCount: increment(-1) });
      } else {
        batch.set(likeRef, { createdAt: new Date().toISOString() });
        batch.update(articleRef, { likesCount: increment(1) });
        // Members earn 10 points the first time they react to an article
        // (never for their own article, and never twice for the same one).
        if (art.authorUid !== currentUser.uid) {
          try {
            const entry = reactionEntry(currentUser.uid, art.id, art.title);
            const [profileSnap, earned] = await Promise.all([
              getDoc(doc(db, 'public_profiles', currentUser.uid)),
              alreadyAwarded(entry.id),
            ]);
            if (profileSnap.exists() && !earned) {
              const name = profileSnap.data().displayName as string | undefined;
              addAwardToBatch(batch, name ? { ...entry, userName: name } : entry, ((profileSnap.data().points || {}).all as number) || 0, true);
            }
          } catch (e) {
            console.warn('Reaction points not added:', e);
          }
        }
      }
      await batch.commit();
      bumpLocalCounter(art.id, 'likesCount', wasLiked ? -1 : 1);
      return !wasLiked;
    } catch (err) {
      console.warn('Could not update article like:', err);
      return wasLiked;
    }
  };

  // 3. Increment Article Share
  const incrementArticleShare = async (articleId: string) => {
    const art = findPublished(articleId);
    if (!art) return;
    bumpLocalCounter(art.id, 'sharesCount', 1);
    try {
      await updateDoc(doc(db, 'articles', art.id), { sharesCount: increment(1) });
    } catch (err) {
      console.warn('Could not record article share:', err);
    }
  };

  // 4. Fetch User Activities
  const fetchUserActivities = async (userId?: string): Promise<UserActivityRecord[]> => {
    try {
      const baseCol = collection(db, 'user_activities');
      const q = userId 
        ? query(baseCol, where('userId', '==', userId), orderBy('timestamp', 'desc'))
        : query(baseCol, orderBy('timestamp', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ ...d.data(), id: d.id } as UserActivityRecord));
    } catch {
      return userActivities.filter(a => !userId || a.userId === userId);
    }
  };

  // 5. Bulk Member Import with column mapping
  const bulkImportMembers = async (membersData: Partial<MemberRecord>[]): Promise<{ success: number; failed: number }> => {
    if (!currentUser || !isAdmin) throw new Error('Admin privileges required to bulk import members');
    let success = 0;
    let failed = 0;
    const now = new Date().toISOString();

    for (const mem of membersData) {
      try {
        if (!mem.fullName || !mem.email) {
          failed++;
          continue;
        }

        const id = mem.id || `mem-imp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const memberNumber = mem.memberNumber || `SHB-${Math.floor(1000 + Math.random() * 9000)}`;
        const chapterId = mem.chapterId || 'london';
        const matchedChap = chapters.find(c => 
          c.id === chapterId || 
          c.slug === chapterId || 
          c.name.toLowerCase() === chapterId.toLowerCase()
        );
        const resolvedChapterId = matchedChap ? matchedChap.id : 'london';
        const resolvedChapterName = matchedChap ? matchedChap.name : 'London';

        const hierarchyLevel: MemberHierarchyLevel = mem.hierarchyLevel || (mem.boardTitle ? 'board_executive' : 'general_member');
        const isBoardMember = hierarchyLevel === 'board_executive' || Boolean(mem.boardTitle);

        const record: MemberRecord = {
          id,
          userId: mem.userId || id,
          memberNumber,
          fullName: mem.fullName.trim(),
          displayName: mem.displayName || mem.fullName.trim(),
          email: mem.email.trim().toLowerCase(),
          phone: mem.phone || '',
          chapterId: resolvedChapterId,
          status: mem.status || 'active',
          roles: mem.roles || ['member'],
          isBoardMember,
          boardTitle: mem.boardTitle || '',
          hierarchyLevel,
          displayRankOrder: mem.displayRankOrder || (isBoardMember ? 1 : 10),
          // Every member is shown publicly (organisation policy).
          consentToDirectory: true,
          photoUrl: mem.photoUrl || '',
          bio: mem.bio || '',
          expertise: mem.expertise || '',
          activityScore: isBoardMember ? 250 : 50,
          joinedAt: mem.joinedAt || now,
          updatedAt: now,
        };

        await safeSetDoc(doc(db, 'members', id), record);

        // Every member is shown publicly.
        {
          const pubProfile: PublicProfile = {
            id,
            userId: record.userId,
            displayName: record.displayName,
            photoUrl: record.photoUrl,
            chapterId: resolvedChapterId,
            chapterName: resolvedChapterName,
            boardTitle: record.boardTitle,
            isBoardMember,
            hierarchyLevel,
            displayRankOrder: record.displayRankOrder,
            bio: record.bio,
            expertise: record.expertise,
            activityScore: record.activityScore,
            updatedAt: now,
          };
          await safeSetDoc(doc(db, 'public_profiles', id), pubProfile);
        }

        success++;
      } catch (e) {
        console.warn('Failed to import member row:', mem, e);
        failed++;
      }
    }

    await addAuditLog(
      'BULK_MEMBERS_IMPORTED',
      'members',
      'bulk',
      `Imported ${success} members (${failed} skipped/failed)`
    );

    return { success, failed };
  };

  // Update donation settings (draft vs publish with audit trail)
  /**
   * Save the bank details. Publishing writes the public copy (shown on the
   * Donate page) and the draft together, so the form shows what is live.
   * `publish: false` saves a draft only; `unpublish` hides the details.
   * Errors are thrown so the form can show them.
   */
  const updateDonationSettings = async (config: Partial<DonationConfig>, isPublish: boolean = false, unpublish = false) => {
    if (!currentUser || !isAdmin) throw new Error('Only administrators can change the donation details.');
    const now = new Date().toISOString();
    const base = {
      accountHolder: (config.accountHolder || '').trim(),
      bankName: (config.bankName || '').trim(),
      accountNumber: (config.accountNumber || '').replace(/\s+/g, ''),
      sortCode: (config.sortCode || '').trim(),
      iban: (config.iban || '').replace(/\s+/g, '').toUpperCase(),
      swiftBic: (config.swiftBic || '').replace(/\s+/g, '').toUpperCase(),
      currency: config.currency || 'GBP',
      referenceInstructions: (config.referenceInstructions || '').trim(),
      guidance: (config.guidance || '').trim(),
      hideInstructions: config.hideInstructions ?? false,
      updatedBy: currentUser.email || currentUser.uid,
      updatedAt: now,
    };
    const draft: DonationConfig = { ...base, id: 'draft', isPublished: false };
    await safeSetDoc(doc(db, 'donation_config', 'draft'), draft);
    if (isPublish || unpublish) {
      // The public copy does not carry the editor's email address.
      const { updatedBy: _by, ...publicBase } = base;
      const published: DonationConfig = { ...publicBase, id: 'published', isPublished: !unpublish, publishedAt: now };
      await safeSetDoc(doc(db, 'donation_config', 'published'), published);
      setDonationConfig(published);
    }
    await addAuditLog(
      unpublish ? 'DONATION_CONFIG_HIDDEN' : isPublish ? 'DONATION_CONFIG_PUBLISHED' : 'DONATION_CONFIG_DRAFTED',
      'donation_config',
      isPublish || unpublish ? 'published' : 'draft',
      `Bank details ${unpublish ? 'hidden from the Donate page' : isPublish ? 'published' : 'saved as a draft'} by ${currentUser.email}`,
    );
  };

  // Save banner
  const saveBanner = async (bannerData: Partial<Banner>) => {
    if (!currentUser || !isAdmin) throw new Error('Admin only');
    const id = bannerData.id || `ban-${Date.now()}`;
    const now = new Date().toISOString();
    const banner: Banner = {
      id,
      title: bannerData.title || '',
      supportingText: bannerData.supportingText || '',
      imageUrl: bannerData.imageUrl,
      imageAlt: bannerData.imageAlt,
      actionLabel: bannerData.actionLabel,
      actionUrl: bannerData.actionUrl,
      placement: bannerData.placement || 'announcement_bar',
      priority: bannerData.priority || 0,
      status: bannerData.status || 'published',
      startAt: bannerData.startAt,
      endAt: bannerData.endAt,
      allowDismissal: bannerData.allowDismissal ?? true,
      createdAt: bannerData.createdAt || now,
      updatedAt: now,
    };
    try {
      await safeSetDoc(doc(db, 'banners', id), banner);
      await addAuditLog('BANNER_SAVED', 'banners', id, `Banner "${banner.title}" saved`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `banners/${id}`);
    }
  };

  // Delete banner
  const deleteBanner = async (id: string) => {
    if (!currentUser || !isAdmin) throw new Error('Admin only');
    try {
      await deleteDoc(doc(db, 'banners', id));
      await addAuditLog('BANNER_DELETED', 'banners', id, `Banner deleted`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `banners/${id}`);
    }
  };

  // Save chapter
  const saveChapter = async (chap: Partial<CityChapter>) => {
    if (!currentUser || !isAdmin) throw new Error('Admin only');
    const id = chap.id || (chap.slug || chap.name || 'chapter').toLowerCase().replace(/\s+/g, '-');
    const now = new Date().toISOString();
    const chapter: CityChapter = {
      ...chap,
      id,
      name: chap.name || '',
      slug: chap.slug || id,
      country: chap.country || 'United Kingdom',
      description: chap.description || '',
      displayOrder: chap.displayOrder || chapters.length + 1,
      isArchived: chap.isArchived ?? false,
      createdAt: chap.createdAt || now,
      updatedAt: now,
    };
    try {
      await safeSetDoc(doc(db, 'chapters', id), chapter, { merge: true });
      await addAuditLog('CHAPTER_SAVED', 'chapters', id, `Council ${chapter.name} saved`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `chapters/${id}`);
    }
  };

  // Update site settings
  const updateSiteSettings = async (updates: Partial<SiteSettings>) => {
    if (!currentUser || !isAdmin) throw new Error('Admin only');
    const now = new Date().toISOString();
    const payload: SiteSettings = {
      ...siteSettings,
      ...updates,
      updatedAt: now,
      updatedBy: currentUser.email || currentUser.uid,
    };
    try {
      await safeSetDoc(doc(db, 'site_settings', 'default'), payload, { merge: true });
      setSiteSettings(payload);
      await addAuditLog('SITE_SETTINGS_UPDATED', 'site_settings', 'default', 'Site copy/settings updated');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'site_settings/default');
    }
  };

  // Seed initial data to Firestore (Admin one-click button)
  const seedInitialDataToFirestore = async () => {
    if (!currentUser || !isAdmin) throw new Error('Admin only');
    try {
      // Seed chapters
      for (const chap of INITIAL_CHAPTERS) {
        await safeSetDoc(doc(db, 'chapters', chap.id), chap, { merge: true });
      }
      // Sample articles are deliberately NOT seeded: everything published
      // under the organisation's name should be written by its members.
      // Seed site settings
      await safeSetDoc(doc(db, 'site_settings', 'default'), defaultSiteSettings, { merge: true });

      await addAuditLog('DATABASE_SEEDED', 'system', 'root', 'Initial councils and settings bootstrapped into Firestore');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'seed');
    }
  };

  return (
    <DataContext.Provider
      value={{
        chapters,
        articles,
        banners,
        activeBanners,
        donationConfig,
        publicProfiles,
        siteSettings,
        userActivities,
        loading,
        submitContactEnquiry,
        submitMembershipApplication,
        updateMembershipApplication,
        createArticleSubmission,
        updateArticleStatus,
        incrementArticleView,
        toggleArticleLike,
        incrementArticleShare,
        bulkImportMembers,
        fetchUserActivities,
        updateDonationSettings,
        saveBanner,
        deleteBanner,
        saveChapter,
        updateSiteSettings,
        addAuditLog,
        seedInitialDataToFirestore,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
