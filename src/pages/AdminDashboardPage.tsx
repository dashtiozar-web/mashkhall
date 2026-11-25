import { MembersByCity } from '../admin/MembersByCity';
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Shield, 
  Users, 
  FileText, 
  Bell, 
  Heart, 
  MapPin, 
  Mail, 
  Sliders, 
  History, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Search, 
  Plus, 
  Edit2, 
  Eye, 
  Lock, 
  Save, 
  Trash2, 
  ArrowRight, 
  Send, 
  Building2, 
  Check, 
  Copy, 
  Award, 
  RefreshCw, 
  Database,
  Crown,
  Flame,
  Clock,
  Share2,
  Upload,
  Download,
  Table,
  Sparkles,
  Key,
  BarChart3,
  UserCheck,
  ChevronDown,
  ChevronRight,
  Filter
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { ApplicationReview } from '../admin/ApplicationReview';
import { MembershipCards } from '../admin/MembershipCards';
import { BannerManager } from '../admin/BannerManager';
import { AdminOverview } from '../admin/AdminOverview';
import { MembersManager } from '../admin/MembersManager';
import { PointsAdmin } from '../admin/PointsAdmin';
import { StructureAdmin } from '../admin/StructureAdmin';
import { CouncilsAdmin } from '../admin/CouncilsAdmin';
import { ContributionsAdmin } from '../admin/ContributionsAdmin';
import { SecurityAdmin } from '../admin/SecurityAdmin';
import { TranslationsAdmin } from '../admin/TranslationsAdmin';
import { AppearanceAdmin } from '../admin/AppearanceAdmin';
import { VisitorAnalytics } from '../components/VisitorAnalytics';
import { GuestSubmissionsAdmin } from '../admin/GuestSubmissionsAdmin';
import { CommentsAdmin } from '../admin/CommentsAdmin';
import { awardPoints as ledgerAwardPoints, PointsType } from '../lib/ledger';
import { SocialSettings } from '../admin/SocialSettings';
import { MeetingsAdmin } from '../admin/MeetingsAdmin';
import { AppreciationAdmin } from '../admin/AppreciationAdmin';
import { DonationSettings } from '../admin/DonationSettings';
import { PositionId, positionById } from '../lib/positions';
import { resyncMembers } from '../lib/memberApi';
import { WebAdminPermissions } from '../admin/WebAdminPermissions';
import { DEFAULT_POINT_RULES, POINT_LABELS } from '../lib/points';
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  deleteDoc, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { db, safeSetDoc, safeUpdateDoc } from '../firebase';
import { 
  MemberApplication, 
  MemberRecord, 
  Article, 
  Banner, 
  DonationConfig, 
  ContactEnquiry, 
  AuditLog, 
  CityChapter,
  Role,
  Permission,
  UserProfile,
  UserActivityRecord,
  MemberHierarchyLevel,
  ImportColumnMapping,
  PublicProfile
} from '../types';

interface AdminDashboardPageProps {
  onNavigate: (tab: string, param?: string) => void;
  onOpenAuth: () => void;
}

// Turn a failed save into a message an administrator can act on.
const describeSaveError = (e: unknown): string => {
  const text = e instanceof Error ? e.message : String(e);
  if (/permission|insufficient/i.test(text)) {
    return 'The database refused this change. If the website was updated recently, the latest database rules may not be deployed yet (see DEPLOYMENT.md), or your account may not have permission.';
  }
  if (/offline|network|unavailable/i.test(text)) {
    return 'Could not reach the database. Check your connection and try again.';
  }
  return 'Something went wrong while saving. Please try again; if it keeps happening, check the browser console for details.';
};

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({ 
  onNavigate, 
  onOpenAuth 
}) => {
  const { 
    currentUser, 
    isOwner, 
    isAdmin, 
    isReviewer, 
    isPublisher,
    hasPermission,
    updateUserRolesAndPermissions,
    awardPoints
  } = useAuth();

  const { 
    chapters, 
    articles, 
    banners, 
    donationConfig, 
    siteSettings, 
    userActivities,
    saveBanner, 
    deleteBanner, 
    saveChapter, 
    updateDonationSettings, 
    updateArticleStatus,
    updateMembershipApplication,
    updateSiteSettings,
    bulkImportMembers,
    addAuditLog,
    seedInitialDataToFirestore
  } = useData();

  const [activeTab, setActiveTab] = useState<
    | 'meetings'
    | 'appreciation'
    | 'overview' 
    | 'applications' 
    | 'places'
    | 'members' 
    | 'cards'
    | 'people'
    | 'users' 
    | 'metrics' 
    | 'rankings'
    | 'structure'
    | 'comments'
    | 'contributions'
    | 'security' 
    | 'visitors'
    | 'publications'
    | 'import' 
    | 'submissions' 
    | 'banners' 
    | 'donations' 
    | 'chapters' 
    | 'enquiries' 
    | 'settings' 
    | 'audit'
    | 'translations'
    | 'appearance'
  >('overview');

  // Real data collections
  const [applications, setApplications] = useState<MemberApplication[]>([]);
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [registeredUsers, setRegisteredUsers] = useState<UserProfile[]>([]);
  const [enquiries, setContactEnquiries] = useState<ContactEnquiry[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Search & Filter States
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [memberHierarchyFilter, setMemberHierarchyFilter] = useState<string>('all');
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // Application Review Modal state
  const [selectedApp, setSelectedApp] = useState<MemberApplication | null>(null);
  const [reviewStaffNotes, setReviewStaffNotes] = useState('');
  const [reviewApplicantFeedback, setReviewApplicantFeedback] = useState('');
  const [processingReview, setProcessingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // Content Review Modal state
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [contentFeedback, setContentFeedback] = useState('');
  const [processingContent, setProcessingContent] = useState(false);

  // Banner Editor state
  const [editingBanner, setEditingBanner] = useState<Partial<Banner> | null>(null);

  // Council Editor state
  const [editingChapter, setEditingChapter] = useState<Partial<CityChapter> | null>(null);

  // Manual Member Add state
  const [addingMember, setAddingMember] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualChapter, setManualChapter] = useState('britain');
  const [manualRole, setManualRole] = useState<Role>('member');
  const [manualHierarchy, setManualHierarchy] = useState<MemberHierarchyLevel>('general_member');
  const [manualBoardTitle, setManualBoardTitle] = useState('');
  const manualPosition: PositionId = 'member';

  // User Role & Permission Editor Modal state
  const [selectedUserForRoles, setSelectedUserForRoles] = useState<UserProfile | null>(null);
  const [editingUserRoles, setEditingUserRoles] = useState<Role[]>([]);
  const [editingUserPermissions, setEditingUserPermissions] = useState<Permission[]>([]);
  const [savingUserRoles, setSavingUserRoles] = useState(false);
  const [userRoleMsg, setUserRoleMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Bonus Points Award Modal
  const [awardingBonusUser, setAwardingBonusUser] = useState<UserProfile | null>(null);
  const [bonusPoints, setBonusPoints] = useState<number>(25);
  const [bonusReason, setBonusReason] = useState<string>('');
  const [bonusType, setBonusType] = useState<keyof typeof POINT_LABELS | 'bonus_awarded'>('event_participation');
  const [awardingBonusLoading, setAwardingBonusLoading] = useState(false);

  // Bulk Member Import state
  const [importCsvText, setImportCsvText] = useState('');
  const [importParsedHeaders, setImportParsedHeaders] = useState<string[]>([]);
  const [importRawRows, setImportRawRows] = useState<string[][]>([]);
  const [importColumnMappings, setImportColumnMappings] = useState<Record<string, string>>({});
  const [importDefaultChapter, setImportDefaultChapter] = useState('britain');
  const [importingInProgress, setImportingInProgress] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);

  // Donation Settings Draft state
  const [donationDraft, setDonationDraft] = useState<Partial<DonationConfig>>({
    accountHolder: '',
    bankName: '',
    accountNumber: '',
    sortCode: '',
    iban: '',
    swiftBic: '',
    currency: 'GBP',
    referenceInstructions: 'Please include your full name as the transfer reference.',
    guidance: 'Transfers usually clear within 1-2 hours depending on UK Faster Payments.',
    hideInstructions: false,
    isPublished: false,
  });
  const [showPublishConfirmModal, setShowPublishConfirmModal] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [donationSaveMsg, setDonationSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Refresh data function
  const refreshAdminData = async () => {
    if (!currentUser) return;
    setLoadingData(true);
    try {
      // 1. Applications
      const appSnap = await getDocs(collection(db, 'applications'));
      const apps = appSnap.docs.map(d => ({ ...d.data(), id: d.id } as MemberApplication));
      setApplications(apps);

      // 2. Members
      const memSnap = await getDocs(collection(db, 'members'));
      const mems = memSnap.docs.map(d => ({ ...d.data(), id: d.id } as MemberRecord));
      setMembers(mems);

      // Every approved member is listed publicly: the server adds any who
      // were approved or imported before this rule.
      const unlisted = mems.filter(m => !m.consentToDirectory && (m.status === 'active' || m.status === 'suspended'));
      if (unlisted.length) resyncMembers(unlisted.slice(0, 50).map(m => m.id)).catch((e) => console.warn('Public listing not added:', e));

      // 3. Registered Users
      try {
        const userSnap = await getDocs(collection(db, 'users'));
        const users = userSnap.docs.map(d => ({ ...d.data(), uid: d.id } as UserProfile));
        users.sort((a, b) => (b.activityScore || 0) - (a.activityScore || 0));
        setRegisteredUsers(users);
      } catch (e) {
        console.warn('Users fetch note:', e);
      }

      // 4. Contact Enquiries
      const enqSnap = await getDocs(collection(db, 'contact_enquiries'));
      const enqs = enqSnap.docs.map(d => ({ ...d.data(), id: d.id } as ContactEnquiry));
      enqs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setContactEnquiries(enqs);

      // 5. Audit Logs
      const logSnap = await getDocs(collection(db, 'audit_logs'));
      const logs = logSnap.docs.map(d => ({ ...d.data(), id: d.id } as AuditLog));
      logs.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
      setAuditLogs(logs);

      // 6. Donation Config Draft
      const draftSnap = await getDoc(doc(db, 'donation_config', 'draft'));
      if (draftSnap.exists()) {
        setDonationDraft(draftSnap.data() as DonationConfig);
      } else if (donationConfig) {
        setDonationDraft(donationConfig);
      }
    } catch (e) {
      console.warn('Error fetching admin datasets:', e);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    refreshAdminData();
  }, [currentUser]);

  if (!currentUser || !isAdmin) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-4">
        <h1 className="text-[2.25rem] font-serif font-semibold text-ink">Administrators only</h1>
        <p className="text-[1.0625rem] text-ink-soft">
          Sign in with an administrator account to manage members, articles and site content.
        </p>
        <button
          onClick={() => onNavigate('home')}
          className="px-5 py-2 bg-navy text-white rounded-lg text-[0.8438rem] font-semibold"
        >
          Go to the homepage
        </button>
      </div>
    );
  }

  // Work Queue summaries
  const pendingApps = applications.filter(a => a.status === 'submitted' || a.status === 'under_review');
  const pendingArticles = articles.filter(a => a.status === 'submitted' || a.status === 'under_review');
  const newEnquiries = enquiries.filter(e => e.status === 'new');

  // Hierarchy categorisation of members
  const categorizedMembers = useMemo(() => {
    const queryLower = memberSearchQuery.toLowerCase().trim();
    const filtered = members.filter(m => {
      if (!queryLower) return true;
      return (
        m.fullName.toLowerCase().includes(queryLower) ||
        m.email.toLowerCase().includes(queryLower) ||
        m.memberNumber.toLowerCase().includes(queryLower) ||
        (m.boardTitle && m.boardTitle.toLowerCase().includes(queryLower)) ||
        (m.chapterId && m.chapterId.toLowerCase().includes(queryLower))
      );
    });

    const isBoard = (m: MemberRecord) => 
      m.hierarchyLevel === 'board_executive' || 
      m.isBoardMember || 
      Boolean(m.boardTitle && !m.boardTitle.toLowerCase().includes('coordinator'));

    const isCoord = (m: MemberRecord) => 
      m.hierarchyLevel === 'chapter_coordinator' || 
      Boolean(m.boardTitle && m.boardTitle.toLowerCase().includes('coordinator'));

    const isFellow = (m: MemberRecord) => 
      m.hierarchyLevel === 'advisory_fellow';

    return {
      board: filtered.filter(isBoard),
      coordinators: filtered.filter(m => isCoord(m) && !isBoard(m)),
      fellows: filtered.filter(m => isFellow(m) && !isBoard(m) && !isCoord(m)),
      general: filtered.filter(m => !isBoard(m) && !isCoord(m) && !isFellow(m)),
      allFiltered: filtered
    };
  }, [members, memberSearchQuery]);

  // Overall Article Metrics Calculations
  const metricsData = useMemo(() => {
    const published = articles.filter(a => a.status === 'published');
    const totalViews = published.reduce((acc, a) => acc + (a.viewsCount || 0), 0);
    const totalLikes = published.reduce((acc, a) => acc + (a.likesCount || 0), 0);
    const totalShares = published.reduce((acc, a) => acc + (a.sharesCount || 0), 0);
    const totalEngagement = published.reduce((acc, a) => acc + (a.engagementScore || ((a.viewsCount || 0) + (a.likesCount || 0) * 5 + (a.sharesCount || 0) * 10)), 0);
    
    // Sort top articles by engagement
    const sorted = [...articles].sort((a, b) => {
      const scoreA = a.engagementScore || ((a.viewsCount || 0) + (a.likesCount || 0) * 5);
      const scoreB = b.engagementScore || ((b.viewsCount || 0) + (b.likesCount || 0) * 5);
      return scoreB - scoreA;
    });

    // Breakdown by category
    const categoryCounts: Record<string, { count: number; views: number }> = {};
    for (const art of articles) {
      const cat = art.category || 'general';
      if (!categoryCounts[cat]) {
        categoryCounts[cat] = { count: 0, views: 0 };
      }
      categoryCounts[cat].count += 1;
      categoryCounts[cat].views += (art.viewsCount || 0);
    }

    return {
      totalArticles: articles.length,
      publishedCount: published.length,
      totalViews,
      totalLikes,
      totalShares,
      totalEngagement,
      topArticles: sorted,
      categoryCounts
    };
  }, [articles]);

  // Filtered registered users for Role/Permission Manager
  const filteredUsers = useMemo(() => {
    const q = userSearchQuery.toLowerCase().trim();
    if (!q) return registeredUsers;
    return registeredUsers.filter(u => 
      u.email.toLowerCase().includes(q) || 
      u.displayName.toLowerCase().includes(q) ||
      u.roles?.some(r => r.toLowerCase().includes(q))
    );
  }, [registeredUsers, userSearchQuery]);

  // Handle Application Decision
  const handleApplicationDecision = async (status: MemberApplication['status']) => {
    if (!selectedApp) return;
    setProcessingReview(true);
    setReviewError(null);
    try {
      await updateMembershipApplication(
        selectedApp.id,
        { status },
        reviewStaffNotes,
        reviewApplicantFeedback
      );
      setSelectedApp(null);
      await refreshAdminData();
    } catch (e) {
      console.error('App decision error:', e);
      setReviewError(describeSaveError(e));
    } finally {
      setProcessingReview(false);
    }
  };

  // Handle Article Decision
  const handleArticleDecision = async (status: Article['status']) => {
    if (!selectedArticle) return;
    setProcessingContent(true);
    try {
      await updateArticleStatus(selectedArticle.id, status, contentFeedback);
      setSelectedArticle(null);
      setContentFeedback('');
      await refreshAdminData();
    } catch (e) {
      console.error('Article decision error:', e);
    } finally {
      setProcessingContent(false);
    }
  };

  // Handle Manual Member Creation with Hierarchy
  const handleCreateManualMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim() || !manualEmail.trim()) return;
    try {
      const memberId = `mem-manual-${Date.now()}`;
      // The membership number (M0000000) is assigned when the card is issued.
      const memberNumber = '';
      const position = positionById(manualPosition)!;
      const now = new Date().toISOString();

      const isBoard = manualHierarchy === 'board_executive' || Boolean(manualBoardTitle);

      const newRecord: MemberRecord = {
        id: memberId,
        userId: memberId,
        memberNumber,
        fullName: manualName.trim(),
        displayName: manualName.trim(),
        email: manualEmail.trim().toLowerCase(),
        phone: manualPhone.trim() || '',
        chapterId: manualChapter,
        status: 'active',
        roles: [manualRole],
        isBoardMember: isBoard,
        boardTitle: manualBoardTitle.trim() || undefined,
        hierarchyLevel: manualHierarchy,
        positionId: position.id,
        department: position.department,
        designation: position.title,
        consentToDirectory: true,
        joinedAt: now,
        updatedAt: now,
      };

      await safeSetDoc(doc(db, 'members', memberId), newRecord);

      const matchedChap = chapters.find(c => c.id === manualChapter);
      const pubProfile: PublicProfile = {
        id: memberId,
        userId: memberId,
        displayName: manualName.trim(),
        chapterId: manualChapter,
        chapterName: matchedChap ? matchedChap.name : 'London',
        boardTitle: manualBoardTitle.trim() || undefined,
        isBoardMember: isBoard,
        hierarchyLevel: manualHierarchy,
        positionId: position.id,
        department: position.department,
        designation: position.title,
        updatedAt: now,
      };
      {
        await safeSetDoc(doc(db, 'public_profiles', memberId), pubProfile);
      }

      await addAuditLog('MEMBER_MANUAL_CREATED', 'members', memberId, `Admin enrolled ${manualName} (${manualEmail}) as ${position.title}`);

      setAddingMember(false);
      setManualName('');
      setManualEmail('');
      setManualPhone('');
      setManualBoardTitle('');
      await refreshAdminData();
    } catch (e) {
      console.error('Error creating manual member:', e);
    }
  };

  // Quick Board Status Toggle
  const handleToggleBoardStatus = async (member: MemberRecord) => {
    const newIsBoard = !member.isBoardMember;
    const newHierarchy: MemberHierarchyLevel = newIsBoard ? 'board_executive' : 'general_member';
    try {
      await safeUpdateDoc(doc(db, 'members', member.id), {
        isBoardMember: newIsBoard,
        hierarchyLevel: newHierarchy,
        updatedAt: new Date().toISOString()
      });

      // Update public profile, if the member has one (no consent = no profile)
      const pubRef = doc(db, 'public_profiles', member.id);
      if ((await getDoc(pubRef)).exists()) {
        await safeUpdateDoc(pubRef, {
          isBoardMember: newIsBoard,
          hierarchyLevel: newHierarchy,
          updatedAt: new Date().toISOString()
        });
      }

      await addAuditLog(
        'MEMBER_BOARD_STATUS_CHANGED',
        'members',
        member.id,
        `${member.fullName} ${newIsBoard ? 'promoted to Executive Board' : 'demoted to General Member'}`
      );

      await refreshAdminData();
    } catch (err) {
      console.error('Toggle board error:', err);
    }
  };

  // User Role & Permission Modal Handlers
  const handleOpenUserRoles = (user: UserProfile) => {
    setSelectedUserForRoles(user);
    setEditingUserRoles(user.roles || ['visitor']);
    setEditingUserPermissions(user.permissions || []);
    setUserRoleMsg(null);
  };

  const handleSaveUserRolesAndPermissions = async () => {
    if (!selectedUserForRoles) return;
    setSavingUserRoles(true);
    setUserRoleMsg(null);
    try {
      await updateUserRolesAndPermissions(
        selectedUserForRoles.uid,
        editingUserRoles,
        editingUserPermissions
      );

      await addAuditLog(
        'USER_PERMISSIONS_UPDATED',
        'users',
        selectedUserForRoles.uid,
        `Assigned roles: [${editingUserRoles.join(', ')}], permissions: [${editingUserPermissions.join(', ')}] to ${selectedUserForRoles.email}`
      );

      setUserRoleMsg({ type: 'success', text: 'Roles & permissions successfully saved!' });
      setTimeout(() => {
        setSelectedUserForRoles(null);
        refreshAdminData();
      }, 1200);
    } catch (e: any) {
      console.error('Save roles error:', e);
      setUserRoleMsg({ type: 'error', text: e.message || 'Failed to update roles and permissions.' });
    } finally {
      setSavingUserRoles(false);
    }
  };

  // Award Bonus Points Handler
  const handleAwardBonusPoints = async () => {
    if (!awardingBonusUser || !bonusPoints) return;
    setAwardingBonusLoading(true);
    try {
      const description = bonusReason.trim() || (bonusType === 'bonus_awarded' ? 'Recognition from the committee' : POINT_LABELS[bonusType]);
      // Activity record, private score and public leaderboard score are
      // updated together in one transaction.
      // Recorded in the points ledger like every other award.
      const ledgerType: PointsType = (['research_report', 'media_contribution', 'discussion_contribution', 'project_support'] as string[]).includes(bonusType) ? (bonusType as PointsType) : 'bonus_awarded';
      await ledgerAwardPoints(awardingBonusUser.uid, ledgerType, bonusPoints, { note: description, userName: awardingBonusUser.displayName });

      await addAuditLog(
        'BONUS_POINTS_AWARDED',
        'users',
        awardingBonusUser.uid,
        `Awarded +${bonusPoints} bonus points to ${awardingBonusUser.email}. Note: ${description}`
      );

      setAwardingBonusUser(null);
      setBonusReason('');
      await refreshAdminData();
    } catch (e) {
      console.error('Bonus points award error:', e);
    } finally {
      setAwardingBonusLoading(false);
    }
  };

  // Bulk Member Import Parsing & Execution
  const handleCsvInput = (rawText: string) => {
    setImportCsvText(rawText);
    setImportResult(null);

    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      setImportParsedHeaders([]);
      setImportRawRows([]);
      return;
    }

    // Auto-detect delimiter: tab or comma
    const delimiter = lines[0].includes('\t') ? '\t' : ',';
    const headers = lines[0].split(delimiter).map(h => h.replace(/^["']|["']$/g, '').trim());
    const dataRows = lines.slice(1).map(line => 
      line.split(delimiter).map(val => val.replace(/^["']|["']$/g, '').trim())
    );

    setImportParsedHeaders(headers);
    setImportRawRows(dataRows);

    // Auto-match headers to target fields
    const initialMap: Record<string, string> = {};
    headers.forEach(h => {
      const lower = h.toLowerCase();
      if (lower.includes('name') || lower.includes('full')) initialMap[h] = 'fullName';
      else if (lower.includes('email') || lower.includes('mail')) initialMap[h] = 'email';
      else if (lower.includes('phone') || lower.includes('tel') || lower.includes('mobile')) initialMap[h] = 'phone';
      else if (lower.includes('city') || lower.includes('chapter') || lower.includes('council')) initialMap[h] = 'chapterId';
      else if (lower.includes('title') || lower.includes('board') || lower.includes('position')) initialMap[h] = 'boardTitle';
      else if (lower.includes('level') || lower.includes('tier') || lower.includes('hierarchy')) initialMap[h] = 'hierarchyLevel';
      else if (lower.includes('bio') || lower.includes('about') || lower.includes('statement')) initialMap[h] = 'bio';
      else if (lower.includes('expert') || lower.includes('skill')) initialMap[h] = 'expertise';
      else if (lower.includes('status')) initialMap[h] = 'status';
      else if (lower.includes('consent') || lower.includes('public')) initialMap[h] = 'consentToDirectory';
      else initialMap[h] = 'ignore';
    });

    setImportColumnMappings(initialMap);
  };

  // Download sample template CSV
  const handleDownloadTemplate = () => {
    const csvContent = 
`Full Name,Email Address,Phone Number,City Council,Board Title,Hierarchy Level,Directory Consent,Bio,Expertise
Example Person,person@example.org,,London,,general_member,no,,`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', '17shubat_bulk_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Execute Bulk Import
  const handleExecuteImport = async () => {
    if (importRawRows.length === 0) return;
    setImportingInProgress(true);
    setImportResult(null);

    const membersToImport: Partial<MemberRecord>[] = [];

    importRawRows.forEach(row => {
      const memObj: any = { chapterId: importDefaultChapter };
      importParsedHeaders.forEach((header, idx) => {
        const targetField = importColumnMappings[header];
        if (targetField && targetField !== 'ignore' && row[idx] !== undefined) {
          memObj[targetField] = row[idx];
        }
      });

      if (memObj.fullName && memObj.email) {
        membersToImport.push(memObj);
      }
    });

    try {
      const res = await bulkImportMembers(membersToImport);
      setImportResult(res);
      await refreshAdminData();
    } catch (err: any) {
      console.error('Import error:', err);
    } finally {
      setImportingInProgress(false);
    }
  };

  // Available permissions definitions with human-friendly descriptions
  const AVAILABLE_PERMISSIONS: { key: Permission; label: string; desc: string }[] = [
    { key: 'manage_users', label: 'Manage Users & Permissions', desc: 'Can grant or revoke user roles and granular permissions' },
    { key: 'manage_members', label: 'Review & Manage Members', desc: 'Can approve membership applications, edit registry, and assign board positions' },
    { key: 'manage_content', label: 'Draft & Review Articles', desc: 'Can create, edit, and review submissions before publication' },
    { key: 'publish_content', label: 'Authorize & Publish Content', desc: 'Can authorize articles to go live and publish announcement banners' },
    { key: 'bulk_import', label: 'Import members', desc: 'Can import member rosters with custom column mapping' },
    { key: 'view_analytics', label: 'View Metrics & Activity Records', desc: 'Can inspect article analytics, user activity scores, and system audit logs' },
    { key: 'manage_settings', label: 'Manage Organization Settings', desc: 'Can edit site mission copy, FAQs, councils, and history' },
    { key: 'manage_donations', label: 'Configure Donation & Bank Details', desc: 'Can update bank accounts and wire instructions' },
    { key: 'manage_notifications', label: 'Broadcast notifications', desc: 'Can write, publish and withdraw notifications shown to visitors and members' },
    { key: 'manage_translations', label: 'Edit translations', desc: 'Can review and correct the Kurdish and Arabic text of the website (from their account page)' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      
      {/* Top Header Bar */}
      <div className="bg-navy text-white rounded-xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm border border-slate-800">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-navy flex items-center justify-center text-white shadow-sm">
            <Shield className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[0.8125rem] font-semibold bg-navy text-white">
                Mashkhally Zhyanawa
              </span>
              <span className="text-[0.8438rem] text-slate-400">
                {isOwner ? '👑 Organization Owner' : '🛡️ Administrator'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-white tracking-tight mt-1">
              Administration
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={refreshAdminData}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[0.8438rem] font-semibold flex items-center gap-1.5 transition-colors border border-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => onNavigate('member-dashboard')}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[0.8438rem] font-semibold border border-slate-700"
          >
            Your account &rarr;
          </button>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-line overflow-x-auto pb-2 scrollbar-none text-[0.8438rem] font-semibold">
        {[
          { id: 'overview', label: 'Overview', badge: (pendingApps.length + pendingArticles.length + newEnquiries.length) || undefined },
          { id: 'applications', label: 'Applicants', badge: pendingApps.length || undefined },
          { id: 'people', label: 'Members' },
          { id: 'places', label: 'Members by place' },
          { id: 'structure', label: 'Organisation structure' },
          { id: 'submissions', label: 'Article review', badge: pendingArticles.length || undefined },
          { id: 'comments', label: 'Comments' },
          { id: 'publications', label: 'Publish with Us submissions' },
          { id: 'contributions', label: 'Contributions and fees' },
          { id: 'cards', label: 'Membership cards' },
          { id: 'banners', label: 'Breaking News banner' },
          { id: 'enquiries', label: 'Messages', badge: newEnquiries.length || undefined },
          { id: 'metrics', label: 'Article statistics' },
          { id: 'rankings', label: 'Points and levels' },
          { id: 'users', label: 'Users and roles' },
          { id: 'members', label: 'Add members' },
          { id: 'import', label: 'Import members' },
          { id: 'chapters', label: 'Provinces and countries' },
          { id: 'donations', label: 'Donations' },
          { id: 'settings', label: 'Site text and Facebook' },
          { id: 'translations', label: 'Translations' },
          { id: 'appearance', label: 'Appearance' },
          { id: 'meetings', label: 'Online meetings' },
          { id: 'appreciation', label: 'Appreciation' },
          { id: 'visitors', label: 'Visitor analytics' },
          { id: 'security', label: 'Security' },
          { id: 'audit', label: 'Audit log' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3.5 py-2 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === tab.id
                ? 'bg-navy text-white shadow-xs'
                : 'text-ink-soft hover:bg-stone'
            }`}
          >
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span className={`px-1.5 py-0.2 rounded-full text-[0.8125rem] ${
                activeTab === tab.id ? 'bg-navy text-white' : 'bg-red-100 text-navy-deep'
              }`}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ======================================================== */}
      {/* 1. OVERVIEW & WORK QUEUES */}
      {/* ======================================================== */}
      {activeTab === 'overview' && (
        <AdminOverview
          applications={applications}
          members={members}
          articles={articles}
          enquiries={enquiries}
          auditLogs={auditLogs}
          donationConfig={donationConfig}
          loading={loadingData}
          onGo={(t) => setActiveTab(t as any)}
          onNavigate={onNavigate}
        />
      )}

      {/* ======================================================== */}
      {/* 2. HIERARCHICAL MEMBERS REGISTRY */}
      {/* ======================================================== */}
      {activeTab === 'cards' && <MembershipCards />}

      {activeTab === 'places' && <MembersByCity applications={applications} />}

      {activeTab === 'members' && (
        <div className="space-y-8">
          
          {/* Header Controls */}
          <div className="bg-surface p-6 rounded-xl border border-line shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="font-serif font-bold text-xl text-ink">
                Hierarchical Member Registry
              </h3>
              <p className="text-[0.8438rem] text-muted mt-0.5">
                Categorized starting from the Executive Board of Directors down to regional leads and general members.
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative w-64">
                <Search className="w-4 h-4 text-slate-400 absolute start-3 top-2.5" />
                <input
                  type="text"
                  value={memberSearchQuery}
                  onChange={(e) => setMemberSearchQuery(e.target.value)}
                  placeholder="Search name, role, city..."
                  className="w-full ps-9 pe-3 py-1.5 text-[0.8438rem] rounded-lg border border-line focus:outline-hidden focus:ring-2 focus:ring-navy/30 text-ink"
                />
              </div>

              <button
                onClick={() => setAddingMember(true)}
                className="px-3.5 py-1.5 bg-navy hover:bg-navy-deep text-white rounded-lg text-[0.8438rem] font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Member</span>
              </button>

              <button
                onClick={() => setActiveTab('import')}
                className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[0.8438rem] font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Bulk Import</span>
              </button>
            </div>
          </div>

          {/* HIERARCHY TIER 1: BOARD OF DIRECTORS */}
          <div className="space-y-4">
            <div className="bg-navy-deep text-white px-6 py-4 rounded-xl flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2.5">
                <Crown className="w-5 h-5 text-amber-400" />
                <div>
                  <h4 className="font-serif font-bold text-base text-white">
                    Executive Board of Directors & Leadership
                  </h4>
                  <p className="text-[0.8125rem] text-amber-200/80">
                    Highest strategic governing body with ultimate oversight of policy and resources.
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 bg-white/10 rounded-lg text-[0.8438rem] font-bold text-amber-200 border border-white/20">
                {categorizedMembers.board.length} Trustees
              </span>
            </div>

            <div className="bg-surface rounded-xl border border-amber-200/80 overflow-hidden shadow-xs">
              <table className="w-full text-start text-[0.8438rem] text-ink-soft">
                <thead className="bg-amber-50/50 text-ink font-semibold border-b border-amber-200 text-[0.8125rem]">
                  <tr>
                    <th className="px-6 py-3">Member ID</th>
                    <th className="px-6 py-3">Full Name & Title</th>
                    <th className="px-6 py-3">Email Address</th>
                    <th className="px-6 py-3">City Council</th>
                    <th className="px-6 py-3">Directory Status</th>
                    <th className="px-6 py-3 text-end">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {categorizedMembers.board.map(mem => (
                    <tr key={mem.id} className="hover:bg-amber-50/20">
                      <td className="px-6 py-3 font-mono font-bold text-ink">{mem.memberNumber}</td>
                      <td className="px-6 py-3">
                        <div className="font-bold text-ink flex items-center gap-1.5">
                          <Crown className="w-3.5 h-3.5 text-amber-500" />
                          <span>{mem.fullName}</span>
                        </div>
                        <span className="inline-block text-[0.8125rem] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded mt-0.5">
                          {mem.boardTitle || 'Board Member'}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-ink-soft">{mem.email}</td>
                      <td className="px-6 py-3 capitalize">{mem.chapterId}</td>
                      <td className="px-6 py-3">
                        <span className={`px-2 py-0.5 rounded text-[0.8125rem] font-semibold ${
                          mem.consentToDirectory ? 'bg-emerald-100 text-emerald-800' : 'bg-stone text-muted'
                        }`}>
                          {mem.consentToDirectory ? 'Public Visible' : 'Hidden'}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-end">
                        <button
                          onClick={() => handleToggleBoardStatus(mem)}
                          className="px-2.5 py-1 text-[0.8125rem] font-semibold text-ink-soft hover:text-navy hover:bg-stone rounded"
                        >
                          Step Down to General
                        </button>
                      </td>
                    </tr>
                  ))}
                  {categorizedMembers.board.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-6 text-center text-slate-400">
                        No board members in this view. Use "Promote to Board" below to appoint board members.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* HIERARCHY TIER 2: REGIONAL CHAPTER COORDINATORS */}
          <div className="space-y-4">
            <div className="bg-slate-800 text-white px-6 py-3.5 rounded-xl flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-crimson" />
                <h4 className="font-serif font-bold text-base">Regional Council Coordinators</h4>
              </div>
              <span className="px-2.5 py-0.5 bg-white/10 rounded text-[0.8438rem] font-semibold">
                {categorizedMembers.coordinators.length} Coordinators
              </span>
            </div>

            <div className="bg-surface rounded-xl border border-line overflow-hidden shadow-xs">
              <table className="w-full text-start text-[0.8438rem] text-ink-soft">
                <thead className="bg-stone text-ink-soft font-semibold border-b border-line text-[0.8125rem]">
                  <tr>
                    <th className="px-6 py-3">Member ID</th>
                    <th className="px-6 py-3">Name</th>
                    <th className="px-6 py-3">Assigned Council</th>
                    <th className="px-6 py-3">Contact Email</th>
                    <th className="px-6 py-3 text-end">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {categorizedMembers.coordinators.map(mem => (
                    <tr key={mem.id} className="hover:bg-stone">
                      <td className="px-6 py-3 font-mono font-bold text-ink">{mem.memberNumber}</td>
                      <td className="px-6 py-3 font-medium text-ink">
                        {mem.fullName}
                        <span className="block text-[0.8125rem] text-navy font-semibold">{mem.boardTitle || 'Council Lead'}</span>
                      </td>
                      <td className="px-6 py-3 capitalize font-semibold">{mem.chapterId}</td>
                      <td className="px-6 py-3">{mem.email}</td>
                      <td className="px-6 py-3 text-end">
                        <button
                          onClick={() => handleToggleBoardStatus(mem)}
                          className="px-2.5 py-1 text-[0.8125rem] font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded border border-amber-200"
                        >
                          Promote to Board
                        </button>
                      </td>
                    </tr>
                  ))}
                  {categorizedMembers.coordinators.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-6 text-center text-slate-400">
                        No council coordinators listed yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* HIERARCHY TIER 3 & 4: GENERAL MEMBERS & FELLOWS */}
          <div className="space-y-4">
            <div className="bg-stone text-ink px-6 py-3.5 rounded-xl flex items-center justify-between border border-line">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-ink-soft" />
                <h4 className="font-serif font-bold text-base">Verified Active Membership & Fellows</h4>
              </div>
              <span className="px-2.5 py-0.5 bg-surface rounded text-[0.8438rem] font-bold text-ink-soft border border-line">
                {categorizedMembers.general.length + categorizedMembers.fellows.length} Members
              </span>
            </div>

            <div className="bg-surface rounded-xl border border-line overflow-hidden shadow-xs">
              <table className="w-full text-start text-[0.8438rem] text-ink-soft">
                <thead className="bg-stone text-ink-soft font-semibold border-b border-line text-[0.8125rem]">
                  <tr>
                    <th className="px-6 py-3">Member ID</th>
                    <th className="px-6 py-3">Name</th>
                    <th className="px-6 py-3">City Council</th>
                    <th className="px-6 py-3">Email Address</th>
                    <th className="px-6 py-3">Directory Visibility</th>
                    <th className="px-6 py-3 text-end">Promote</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {[...categorizedMembers.fellows, ...categorizedMembers.general].map(mem => (
                    <tr key={mem.id} className="hover:bg-stone">
                      <td className="px-6 py-3 font-mono font-bold text-ink">{mem.memberNumber}</td>
                      <td className="px-6 py-3 font-medium text-ink">{mem.fullName}</td>
                      <td className="px-6 py-3 capitalize">{mem.chapterId}</td>
                      <td className="px-6 py-3 text-ink-soft">{mem.email}</td>
                      <td className="px-6 py-3">
                        <span className={`px-2 py-0.5 rounded text-[0.8125rem] font-semibold ${
                          mem.consentToDirectory ? 'bg-emerald-100 text-emerald-800' : 'bg-stone text-muted'
                        }`}>
                          {mem.consentToDirectory ? 'Public' : 'Hidden'}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-end">
                        <button
                          onClick={() => handleToggleBoardStatus(mem)}
                          className="px-2.5 py-1 text-[0.8125rem] font-semibold text-ink-soft bg-stone hover:bg-stone-deep rounded border border-line"
                        >
                          Appoint to Board
                        </button>
                      </td>
                    </tr>
                  ))}
                  {categorizedMembers.general.length === 0 && categorizedMembers.fellows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                        No general members matching current filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ======================================================== */}
      {/* 3. USER ROLES & GRANULAR PERMISSIONS */}
      {/* ======================================================== */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="bg-surface p-6 rounded-xl border border-line shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1 rounded-lg bg-purple-100 text-purple-700">
                  <Key className="w-4 h-4" />
                </span>
                <h3 className="font-serif font-bold text-xl text-ink">
                  User Roles & Granular Permissions Management
                </h3>
              </div>
              <p className="text-[0.8438rem] text-muted mt-1">
                Configure roles (Owner, Admin, Reviewer, Publisher, Member) and assign granular security permissions to strictly limit access.
              </p>
            </div>

            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute start-3 top-2.5" />
              <input
                type="text"
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                placeholder="Search user email or name..."
                className="w-full ps-9 pe-3 py-1.5 text-[0.8438rem] rounded-lg border border-line focus:outline-hidden focus:ring-2 focus:ring-navy/30 text-ink"
              />
            </div>
          </div>

          {isAdmin && <WebAdminPermissions />}

          <div className="bg-surface rounded-xl border border-line overflow-hidden shadow-xs">
            <table className="w-full text-start text-[0.8438rem] text-ink-soft">
              <thead className="bg-stone text-ink-soft font-semibold border-b border-line text-[0.8125rem]">
                <tr>
                  <th className="px-6 py-3">User</th>
                  <th className="px-6 py-3">Assigned Roles</th>
                  <th className="px-6 py-3">Granular Permissions</th>
                  <th className="px-6 py-3">Activity Score</th>
                  <th className="px-6 py-3 text-end">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredUsers.map(user => (
                  <tr key={user.uid} className="hover:bg-stone">
                    <td className="px-6 py-4">
                      <div className="font-bold text-ink text-sm">{user.displayName || 'Unnamed User'}</div>
                      <div className="text-[0.8438rem] text-muted font-mono">{user.email}</div>
                      <div className="text-[0.75rem] text-muted font-mono" title="Permissions are tied to this account ID">Account ID {user.uid}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {user.roles && user.roles.length > 0 ? (
                          user.roles.map(r => (
                            <span 
                              key={r} 
                              className={`px-2 py-0.5 rounded text-[0.8125rem] font-bold ${
                                r === 'owner' || r === 'administrator' 
                                  ? 'bg-purple-100 text-purple-800 border border-purple-200' 
                                  : r === 'publisher' || r === 'content_reviewer' || r === 'membership_reviewer'
                                  ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                  : 'bg-stone text-ink-soft'
                              }`}
                            >
                              {r.replace('_', ' ')}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-400 italic">visitor</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 max-w-xs">
                      <div className="flex flex-wrap gap-1">
                        {user.permissions && user.permissions.length > 0 ? (
                          user.permissions.map(p => (
                            <span key={p} className="px-1.5 py-0.5 bg-stone text-ink-soft rounded text-[0.8125rem] font-medium">
                              {p.replace('_', ' ')}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-400 text-[0.8125rem] italic">Inherited from roles</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <Flame className="w-3.5 h-3.5 text-amber-500" />
                        <span className="font-bold text-ink">{user.activityScore || 0} pts</span>
                        {user.activityTier && (
                          <span className="text-[0.8125rem] px-1.5 py-0.5 rounded bg-stone text-ink-soft font-medium">
                            {user.activityTier}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-end">
                      <button
                        onClick={() => handleOpenUserRoles(user)}
                        className="px-3 py-1 bg-navy hover:bg-navy-deep text-white rounded text-[0.8438rem] font-semibold flex items-center gap-1.5 ms-auto transition-colors"
                      >
                        <Key className="w-3.5 h-3.5" />
                        <span>Edit Permissions</span>
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-slate-400">
                      No user accounts found matching query.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. PUBLICATION & ARTICLE METRICS */}
      {/* ======================================================== */}
      {activeTab === 'metrics' && (
        <div className="space-y-8">
          
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-surface p-5 rounded-xl border border-line shadow-xs">
              <span className="text-[0.8438rem] font-bold text-slate-400">Total Articles</span>
              <div className="text-3xl font-serif font-bold text-ink mt-1">{metricsData.totalArticles}</div>
              <p className="text-[0.8125rem] text-muted mt-1">{metricsData.publishedCount} active published</p>
            </div>

            <div className="bg-surface p-5 rounded-xl border border-line shadow-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[0.8438rem] font-bold">Total Views</span>
                <Eye className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-3xl font-serif font-bold text-ink mt-1">{metricsData.totalViews}</div>
              <p className="text-[0.8125rem] text-muted mt-1">Reader article impressions</p>
            </div>

            <div className="bg-surface p-5 rounded-xl border border-line shadow-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[0.8438rem] font-bold">Total Appreciations</span>
                <Heart className="w-4 h-4 text-crimson" />
              </div>
              <div className="text-3xl font-serif font-bold text-ink mt-1">{metricsData.totalLikes}</div>
              <p className="text-[0.8125rem] text-muted mt-1">Community member likes</p>
            </div>

            <div className="bg-surface p-5 rounded-xl border border-line shadow-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[0.8438rem] font-bold">Total Shares</span>
                <Share2 className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-3xl font-serif font-bold text-ink mt-1">{metricsData.totalShares}</div>
              <p className="text-[0.8125rem] text-muted mt-1">External citations & shares</p>
            </div>

            <div className="bg-amber-50 p-5 rounded-xl border border-amber-200 shadow-xs">
              <div className="flex items-center justify-between text-amber-800">
                <span className="text-[0.8438rem] font-bold">Engagement Score</span>
                <Flame className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-3xl font-serif font-bold text-amber-900 mt-1">{metricsData.totalEngagement}</div>
              <p className="text-[0.8125rem] text-amber-700 mt-1">Views + (Likes*5) + (Shares*10)</p>
            </div>
          </div>

          {/* Top Performing Publications Table */}
          <div className="bg-surface rounded-xl border border-line overflow-hidden shadow-xs space-y-4">
            <div className="p-6 border-b border-line flex items-center justify-between">
              <div>
                <h3 className="font-serif font-bold text-lg text-ink">
                  Publication Performance & Engagement Ranking
                </h3>
                <p className="text-[0.8438rem] text-muted">
                  Ranked by engagement index (views, appreciations, and reading time)
                </p>
              </div>
              <span className="text-[0.8438rem] font-bold text-slate-400">
                Sorted by Engagement Score &darr;
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-start text-[0.8438rem] text-ink-soft">
                <thead className="bg-stone text-ink-soft font-semibold border-b border-line text-[0.8125rem]">
                  <tr>
                    <th className="px-6 py-3">Rank</th>
                    <th className="px-6 py-3">Publication Title</th>
                    <th className="px-6 py-3">Author</th>
                    <th className="px-6 py-3">Category</th>
                    <th className="px-6 py-3">Views</th>
                    <th className="px-6 py-3">Likes</th>
                    <th className="px-6 py-3">Shares</th>
                    <th className="px-6 py-3">Read Time</th>
                    <th className="px-6 py-3">Engagement Score</th>
                    <th className="px-6 py-3 text-end">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {metricsData.topArticles.map((art, idx) => {
                    const score = art.engagementScore || ((art.viewsCount || 0) + (art.likesCount || 0) * 5 + (art.sharesCount || 0) * 10);
                    return (
                      <tr key={art.id} className="hover:bg-stone">
                        <td className="px-6 py-4 font-mono font-bold text-ink">
                          {idx === 0 ? '🥇 #1' : idx === 1 ? '🥈 #2' : idx === 2 ? '🥉 #3' : `#${idx + 1}`}
                        </td>
                        <td className="px-6 py-4 font-serif font-bold text-ink max-w-xs truncate">
                          {art.title}
                        </td>
                        <td className="px-6 py-4 text-ink-soft">{art.authorDisplayName}</td>
                        <td className="px-6 py-4 capitalize">
                          <span className="px-2 py-0.5 rounded bg-stone text-ink-soft font-medium">
                            {art.category.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-semibold text-ink flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5 text-slate-400" />
                          <span>{art.viewsCount || 0}</span>
                        </td>
                        <td className="px-6 py-4 font-semibold text-navy">
                          ❤️ {art.likesCount || 0}
                        </td>
                        <td className="px-6 py-4 font-semibold text-ink-soft">
                          📋 {art.sharesCount || 0}
                        </td>
                        <td className="px-6 py-4 text-muted">
                          {art.readingTimeMinutes || 3} min
                        </td>
                        <td className="px-6 py-4 font-semibold text-amber-700 bg-amber-50/50">
                          🔥 {score}
                        </td>
                        <td className="px-6 py-4 text-end">
                          <button
                            onClick={() => onNavigate('article', art.slug)}
                            className="px-2.5 py-1 bg-stone hover:bg-stone-deep text-ink rounded font-semibold text-[0.8438rem]"
                          >
                            View Post
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. USER ACTIVITY RECORDS & COMMUNITY RANKINGS */}
      {/* ======================================================== */}
      {activeTab === 'rankings' && <PointsAdmin />}

      {activeTab === 'structure' && <StructureAdmin />}

      {activeTab === 'comments' && <CommentsAdmin />}

      {activeTab === 'contributions' && <ContributionsAdmin />}

      {activeTab === 'security' && <SecurityAdmin />}

      {activeTab === 'visitors' && <VisitorAnalytics mode="admin" />}

      {activeTab === 'publications' && <GuestSubmissionsAdmin />}
      {activeTab === 'meetings' && <MeetingsAdmin />}
      {activeTab === 'appreciation' && <AppreciationAdmin />}
      {activeTab === 'translations' && <TranslationsAdmin />}
      {activeTab === 'appearance' && <AppearanceAdmin />}

      {activeTab === 'import' && (
        <div className="space-y-8">
          
          <div className="bg-surface p-6 rounded-xl border border-line shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1 rounded-lg bg-indigo-100 text-indigo-700">
                  <Table className="w-5 h-5" />
                </span>
                <h3 className="font-serif font-bold text-xl text-ink">
                  Bulk Member Import & Column Mapping Suite
                </h3>
              </div>
              <p className="text-[0.8438rem] text-muted mt-1">
                Import dozens or hundreds of member records at once. Match spreadsheet headers or predefine columns before executing.
              </p>
            </div>

            <button
              onClick={handleDownloadTemplate}
              className="px-4 py-2 bg-stone hover:bg-stone-deep text-ink rounded-lg text-[0.8438rem] font-semibold flex items-center gap-1.5 transition-colors border border-line"
            >
              <Download className="w-4 h-4 text-ink-soft" />
              <span>Download Sample CSV Template</span>
            </button>
          </div>

          {/* Input step */}
          <div className="bg-surface p-6 rounded-xl border border-line shadow-xs space-y-4">
            <h4 className="font-serif font-bold text-base text-ink">
              Step 1: Paste CSV / TSV or Upload Member Spreadsheet
            </h4>
            <p className="text-[0.8438rem] text-muted">
              Paste rows directly from Excel or Google Sheets, or paste a standard comma-separated (.csv) text block.
            </p>

            <textarea
              rows={6}
              value={importCsvText}
              onChange={(e) => handleCsvInput(e.target.value)}
              placeholder={`Full Name,Email Address,Phone Number,City Council,Board Title,Hierarchy Level,Directory Consent\nExample Person,person@example.org,,London,,general_member,no`}
              className="w-full p-4 rounded-xl border border-line font-mono text-[0.8438rem] focus:outline-hidden focus:ring-2 focus:ring-navy/30 text-ink bg-stone"
            />

            <div className="flex items-center justify-between text-[0.8438rem] text-muted pt-1">
              <span>
                {importRawRows.length} rows detected • {importParsedHeaders.length} columns recognized
              </span>
            </div>
          </div>

          {/* Step 2: Column Mapping */}
          {importParsedHeaders.length > 0 && (
            <div className="bg-surface p-6 rounded-xl border border-line shadow-xs space-y-6">
              <div className="border-b border-line pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="font-serif font-bold text-base text-ink">
                    Step 2: Predefine & Match Table Columns
                  </h4>
                  <p className="text-[0.8438rem] text-muted">
                    Map each column in your uploaded table to an official member record field.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[0.8438rem] text-muted">Default Council:</span>
                  <select
                    value={importDefaultChapter}
                    onChange={(e) => setImportDefaultChapter(e.target.value)}
                    className="text-[0.8438rem] border border-line rounded-lg p-1.5 bg-surface text-ink"
                  >
                    {chapters.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Mappings Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {importParsedHeaders.map((header) => (
                  <div key={header} className="p-3.5 rounded-xl border border-line bg-stone space-y-2">
                    <div className="text-[0.8125rem] font-bold text-muted truncate" title={header}>
                      CSV: "{header}"
                    </div>
                    <select
                      value={importColumnMappings[header] || 'ignore'}
                      onChange={(e) => setImportColumnMappings({
                        ...importColumnMappings,
                        [header]: e.target.value
                      })}
                      className="w-full text-[0.8438rem] font-semibold p-2 rounded-lg border border-line bg-surface text-ink focus:ring-2 focus:ring-navy/30"
                    >
                      <option value="fullName">Full Name (Required)</option>
                      <option value="email">Email Address (Required)</option>
                      <option value="phone">Phone Number</option>
                      <option value="chapterId">City / Council</option>
                      <option value="boardTitle">Board Title / Position</option>
                      <option value="hierarchyLevel">Hierarchy Level (Board / Coord / Member)</option>
                      <option value="bio">Bio / Statement</option>
                      <option value="expertise">Expertise / Skills</option>
                      <option value="status">Status (Active / Suspended)</option>
                      <option value="consentToDirectory">Directory Consent</option>
                      <option value="ignore">❌ Ignore This Column</option>
                    </select>
                  </div>
                ))}
              </div>

              {/* Step 3: Tabular Preview */}
              <div className="space-y-3 pt-4 border-t border-line">
                <h5 className="font-serif font-bold text-sm text-ink">
                  Step 3: Live Preview & Validation (First 5 Rows)
                </h5>

                <div className="overflow-x-auto border border-line rounded-xl">
                  <table className="w-full text-start text-[0.8438rem] text-ink-soft">
                    <thead className="bg-stone text-ink-soft font-semibold border-b border-line text-[0.8125rem]">
                      <tr>
                        <th className="px-4 py-2.5">Row</th>
                        <th className="px-4 py-2.5">Full Name</th>
                        <th className="px-4 py-2.5">Email</th>
                        <th className="px-4 py-2.5">Council</th>
                        <th className="px-4 py-2.5">Board Title / Level</th>
                        <th className="px-4 py-2.5">Validation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {importRawRows.slice(0, 5).map((row, i) => {
                        const nameIdx = importParsedHeaders.findIndex(h => importColumnMappings[h] === 'fullName');
                        const emailIdx = importParsedHeaders.findIndex(h => importColumnMappings[h] === 'email');
                        const titleIdx = importParsedHeaders.findIndex(h => importColumnMappings[h] === 'boardTitle');
                        const levelIdx = importParsedHeaders.findIndex(h => importColumnMappings[h] === 'hierarchyLevel');
                        const chapIdx = importParsedHeaders.findIndex(h => importColumnMappings[h] === 'chapterId');

                        const nameVal = nameIdx !== -1 ? row[nameIdx] : 'Missing';
                        const emailVal = emailIdx !== -1 ? row[emailIdx] : 'Missing';
                        const titleVal = titleIdx !== -1 ? row[titleIdx] : '';
                        const levelVal = levelIdx !== -1 ? row[levelIdx] : '';
                        const chapVal = chapIdx !== -1 ? row[chapIdx] : importDefaultChapter;

                        const isValid = Boolean(nameVal && emailVal && emailVal.includes('@'));

                        return (
                          <tr key={i} className="hover:bg-stone">
                            <td className="px-4 py-2.5 font-mono text-slate-400">#{i + 1}</td>
                            <td className="px-4 py-2.5 font-bold text-ink">{nameVal}</td>
                            <td className="px-4 py-2.5">{emailVal}</td>
                            <td className="px-4 py-2.5 capitalize">{chapVal}</td>
                            <td className="px-4 py-2.5">
                              {titleVal ? (
                                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[0.8125rem] font-bold">
                                  {titleVal}
                                </span>
                              ) : (
                                <span className="text-slate-400">{levelVal || 'General Member'}</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5">
                              {isValid ? (
                                <span className="text-emerald-600 font-semibold flex items-center gap-1">
                                  <Check className="w-3.5 h-3.5" /> Valid
                                </span>
                              ) : (
                                <span className="text-crimson font-semibold flex items-center gap-1">
                                  <AlertCircle className="w-3.5 h-3.5" /> Invalid Email/Name
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Execute Import Action */}
              <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="text-[0.8438rem] text-muted">
                  Ready to import <strong>{importRawRows.length}</strong> records into Firestore member registry.
                </div>

                <button
                  onClick={handleExecuteImport}
                  disabled={importingInProgress || importRawRows.length === 0}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-[0.8438rem] font-bold flex items-center gap-2 shadow-sm transition-colors"
                >
                  {importingInProgress ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Importing records...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Execute Bulk Import</span>
                    </>
                  )}
                </button>
              </div>

              {/* Result Notification */}
              {importResult && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[0.8438rem] flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <strong className="font-bold">Import Completed!</strong> Successfully imported{' '}
                    <strong>{importResult.success}</strong> member records.{' '}
                    {importResult.failed > 0 && `(${importResult.failed} rows were skipped due to missing data).`}
                  </div>
                </div>
              )}

            </div>
          )}

        </div>
      )}

      {/* ======================================================== */}
      {/* 7. APPLICATIONS QUEUE */}
      {/* ======================================================== */}
      {(activeTab === 'applications' || activeTab === 'people') && (
        <MembersManager
          initialView={activeTab === 'applications' ? 'applicants' : 'members'}
          onGo={(t) => setActiveTab(t as any)}
          onChanged={refreshAdminData}
        />
      )}

      {activeTab === 'submissions' && (
        <div className="bg-surface rounded-xl border border-line overflow-hidden shadow-xs space-y-4">
          <div className="p-6 border-b border-line">
            <h3 className="font-serif font-bold text-lg text-ink">
              Articles & Content Review
            </h3>
            <p className="text-[0.8438rem] text-muted">
              Verify accuracy, evidence standards, and non-violent principles before authorizing publication.
              Visitors’ submissions appear here only after their publication fee is confirmed (Contributions tab). Every submission is judged by the same standards, whether a fee was paid or not.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-start text-[0.8438rem] text-ink-soft">
              <thead className="bg-stone text-ink-soft font-semibold border-b border-line text-[0.8125rem]">
                <tr>
                  <th className="px-6 py-3">Title</th>
                  <th className="px-6 py-3">Author</th>
                  <th className="px-6 py-3">Category</th>
                  <th className="px-6 py-3">Views / Likes</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-end">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {articles.filter(a => a.status !== 'awaiting_payment').map(art => (
                  <tr key={art.id} className="hover:bg-stone">
                    <td className="px-6 py-4 font-serif font-bold text-ink max-w-xs truncate">
                      {art.title}
                    </td>
                    <td className="px-6 py-4">{art.authorDisplayName}{art.contributorType === 'visitor' && <span className="ms-1.5 rounded-full bg-stone px-2 py-0.5 text-[0.75rem]">Visitor</span>}</td>
                    <td className="px-6 py-4 capitalize">{art.category.replace('_', ' ')}</td>
                    <td className="px-6 py-4 font-mono text-[0.8125rem]">
                      {art.viewsCount || 0} views • {art.likesCount || 0} likes
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-[0.8125rem] font-bold ${
                        art.status === 'published' ? 'bg-emerald-100 text-emerald-800' :
                        art.status === 'submitted' ? 'bg-blue-100 text-blue-800' :
                        art.status === 'changes_requested' ? 'bg-amber-100 text-amber-800' :
                        'bg-stone text-ink-soft'
                      }`}>
                        {art.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-end">
                      <button
                        onClick={() => setSelectedArticle(art)}
                        className="px-3 py-1 bg-navy hover:bg-navy-deep text-white rounded text-[0.8438rem] font-semibold"
                      >
                        Inspect & Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 9. BANNERS & ANNOUNCEMENTS */}
      {/* ======================================================== */}
      {activeTab === 'banners' && <BannerManager />}

      {activeTab === 'donations' && <DonationSettings onNavigate={onNavigate} />}

      {/* ======================================================== */}
      {/* 11. CITY CHAPTERS */}
      {/* ======================================================== */}
      {activeTab === 'chapters' && <CouncilsAdmin />}

      {/* ======================================================== */}
      {/* 12. CONTACT ENQUIRIES */}
      {/* ======================================================== */}
      {activeTab === 'enquiries' && (
        <div className="bg-surface rounded-xl border border-line overflow-hidden shadow-xs">
          <div className="p-6 border-b border-line">
            <h3 className="font-serif font-bold text-lg text-ink">Contact & Research Enquiries</h3>
            <p className="text-[0.8438rem] text-muted">Public messages submitted via contact form.</p>
          </div>

          <div className="divide-y divide-line">
            {enquiries.map(enq => (
              <div key={enq.id} className="p-6 space-y-2 hover:bg-stone">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-ink text-sm">{enq.name} ({enq.email})</span>
                  <span className="text-[0.8125rem] text-slate-400">{new Date(enq.createdAt).toLocaleDateString('en-GB')}</span>
                </div>
                <div className="text-[0.8438rem] font-semibold text-navy">{enq.subject}</div>
                <p className="text-[0.8438rem] text-ink-soft leading-relaxed whitespace-pre-wrap">{enq.message}</p>
              </div>
            ))}
            {enquiries.length === 0 && (
              <div className="p-10 text-center text-slate-400 text-[0.8438rem]">No contact messages received yet.</div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 13. EDITABLE SITE SETTINGS */}
      {/* ======================================================== */}
      {activeTab === 'settings' && <SocialSettings onNavigate={onNavigate} />}

      {activeTab === 'settings' && (
        <div className="bg-surface rounded-xl border border-line p-6 space-y-6 shadow-xs max-w-3xl">
          <div className="border-b border-line pb-4">
            <h3 className="font-serif font-bold text-lg text-ink">Site Mission & Founding Copy</h3>
            <p className="text-[0.8438rem] text-muted">Edit core organization texts without code deployment.</p>
          </div>

          <div className="space-y-4 text-[0.8438rem]">
            <div className="space-y-1">
              <label className="font-semibold text-ink-soft">Official Mission Statement</label>
              <textarea
                rows={3}
                value={siteSettings.mission}
                onChange={(e) => updateSiteSettings({ mission: e.target.value })}
                className="w-full p-3 border border-line rounded-lg text-ink"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-ink-soft">Background</label>
              <textarea
                rows={5}
                value={siteSettings.background}
                onChange={(e) => updateSiteSettings({ background: e.target.value })}
                className="w-full p-3 border border-line rounded-lg text-ink"
              />
            </div>
          </div>

          <div className="pt-4 flex items-center justify-between border-t border-line">
            <button
              onClick={seedInitialDataToFirestore}
              className="px-4 py-2 bg-stone hover:bg-stone-deep text-ink-soft rounded-lg text-[0.8438rem] font-semibold flex items-center gap-1.5"
            >
              <Database className="w-3.5 h-3.5" />
              <span>Bootstrap Default Database</span>
            </button>
            <span className="text-[0.8125rem] text-emerald-600 font-semibold">
              Live updates saved automatically
            </span>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 14. AUDIT LOG */}
      {/* ======================================================== */}
      {activeTab === 'audit' && (
        <div className="bg-surface rounded-xl border border-line overflow-hidden shadow-xs">
          <div className="p-6 border-b border-line">
            <h3 className="font-serif font-bold text-lg text-ink">Administrative Audit Trail</h3>
            <p className="text-[0.8438rem] text-muted">Immutable record of governance decisions, role alterations, and publications.</p>
          </div>

          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-start text-[0.8438rem] text-ink-soft">
              <thead className="bg-stone text-ink-soft font-semibold border-b border-line text-[0.8125rem] sticky top-0">
                <tr>
                  <th className="px-6 py-3">Timestamp</th>
                  <th className="px-6 py-3">Admin / Actor</th>
                  <th className="px-6 py-3">Action</th>
                  <th className="px-6 py-3">Target Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {auditLogs.map(log => (
                  <tr key={log.id} className="hover:bg-stone">
                    <td className="px-6 py-3 font-mono text-[0.8125rem] text-slate-400">
                      {new Date(log.timestamp).toLocaleString('en-GB')}
                    </td>
                    <td className="px-6 py-3 font-medium text-ink">{log.actorEmail}</td>
                    <td className="px-6 py-3 font-mono text-navy font-bold">{log.action}</td>
                    <td className="px-6 py-3 text-ink-soft max-w-sm truncate">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: EDIT USER ROLES & PERMISSIONS */}
      {/* ======================================================== */}
      {selectedUserForRoles && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-surface rounded-xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-sm border border-line max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-line pb-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[0.8125rem] font-bold mb-1">
                  <Key className="w-3 h-3" /> Security Access Control
                </div>
                <h3 className="font-serif font-bold text-xl text-ink">
                  Manage Access for {selectedUserForRoles.displayName}
                </h3>
                <p className="text-[0.8438rem] text-muted font-mono mt-0.5">
                  {selectedUserForRoles.email} • UID: {selectedUserForRoles.uid}
                </p>
              </div>
              <button 
                onClick={() => setSelectedUserForRoles(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Role Toggles */}
            <div className="space-y-3">
              <label className="block text-[0.8438rem] font-bold text-ink-soft">
                1. Assigned Roles
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { r: 'administrator', label: 'Administrator', color: 'border-purple-300 text-purple-900 bg-purple-50' },
                  { r: 'membership_reviewer', label: 'Membership Reviewer', color: 'border-blue-300 text-blue-900 bg-blue-50' },
                  { r: 'content_reviewer', label: 'Content Reviewer', color: 'border-blue-300 text-blue-900 bg-blue-50' },
                  { r: 'publisher', label: 'Publisher', color: 'border-emerald-300 text-emerald-900 bg-emerald-50' },
                  { r: 'member', label: 'Member', color: 'border-line text-ink bg-stone' },
                  { r: 'visitor', label: 'Visitor', color: 'border-line text-ink-soft bg-stone' },
                ].map(({ r, label, color }) => {
                  const isChecked = editingUserRoles.includes(r as Role);
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => {
                        if (isChecked) {
                          setEditingUserRoles(editingUserRoles.filter(item => item !== r));
                        } else {
                          setEditingUserRoles([...editingUserRoles, r as Role]);
                        }
                      }}
                      className={`p-2.5 rounded-xl border text-xs font-bold text-start transition-all flex items-center justify-between ${
                        isChecked 
                          ? `${color} ring-2 ring-purple-400/40 shadow-xs` 
                          : 'border-line bg-surface text-muted hover:border-slate-300'
                      }`}
                    >
                      <span>{label}</span>
                      {isChecked && <Check className="w-3.5 h-3.5" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Granular Permissions Checkboxes */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-[0.8438rem] font-bold text-ink-soft">
                  2. Granular Permission Grants
                </label>
                <div className="flex items-center gap-2 text-[0.8125rem]">
                  <button
                    type="button"
                    onClick={() => setEditingUserPermissions(AVAILABLE_PERMISSIONS.map(p => p.key))}
                    className="text-purple-600 font-semibold hover:underline"
                  >
                    Select All
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => setEditingUserPermissions([])}
                    className="text-slate-400 font-semibold hover:underline"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pe-1">
                {AVAILABLE_PERMISSIONS.map(perm => {
                  const isGranted = editingUserPermissions.includes(perm.key);
                  return (
                    <label
                      key={perm.key}
                      className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                        isGranted
                          ? 'bg-purple-50/50 border-purple-200'
                          : 'bg-surface border-line hover:bg-stone'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isGranted}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEditingUserPermissions([...editingUserPermissions, perm.key]);
                          } else {
                            setEditingUserPermissions(editingUserPermissions.filter(k => k !== perm.key));
                          }
                        }}
                        className="mt-0.5 rounded text-purple-600 focus:ring-navy/30 h-4 w-4"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[0.8438rem] font-bold text-ink">{perm.label}</div>
                        <div className="text-[0.8125rem] text-muted leading-tight">{perm.desc}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {userRoleMsg && (
              <div className={`p-3 rounded-xl text-[0.8438rem] font-semibold ${
                userRoleMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-crimson/5 text-crimson'
              }`}>
                {userRoleMsg.text}
              </div>
            )}

            {/* Modal Actions */}
            <div className="pt-4 border-t border-line flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelectedUserForRoles(null)}
                className="px-4 py-2 text-[0.8438rem] font-semibold text-ink-soft hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveUserRolesAndPermissions}
                disabled={savingUserRoles}
                className="px-5 py-2.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-[0.8438rem] font-bold flex items-center gap-2 shadow-sm transition-colors"
              >
                {savingUserRoles ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>Save Permissions & Roles</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: AWARD BONUS ACTIVITY POINTS */}
      {/* ======================================================== */}
      {awardingBonusUser && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-xl max-w-md w-full p-6 space-y-5 shadow-sm border border-line">
            <div className="flex items-start justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <h3 className="font-serif font-bold text-lg text-ink">
                  Award Activity Points
                </h3>
              </div>
              <button onClick={() => setAwardingBonusUser(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-[0.8438rem] text-ink-soft space-y-1">
              <div>Recipient: <strong>{awardingBonusUser.displayName}</strong></div>
              <div className="font-mono text-slate-400">{awardingBonusUser.email}</div>
              <div className="text-muted">Current Score: <strong>{awardingBonusUser.activityScore || 0} pts</strong></div>
            </div>

            <div className="space-y-3 text-[0.8438rem]">
              <div>
                <label className="font-bold text-ink-soft block mb-1" htmlFor="contribution-type">What did they do?</label>
                <select
                  id="contribution-type"
                  value={bonusType}
                  onChange={(e) => {
                    const t = e.target.value as typeof bonusType;
                    setBonusType(t);
                    if (t !== 'bonus_awarded') setBonusPoints((siteSettings.pointRules || DEFAULT_POINT_RULES)[t]);
                  }}
                  className="w-full p-2 border border-line rounded-lg bg-surface text-ink"
                >
                  {(Object.keys(POINT_LABELS) as (keyof typeof POINT_LABELS)[]).map((k) => (
                    <option key={k} value={k}>{POINT_LABELS[k]} ({(siteSettings.pointRules || DEFAULT_POINT_RULES)[k]} points)</option>
                  ))}
                  <option value="bonus_awarded">Other recognition (choose points)</option>
                </select>
                <p className="mt-1 text-muted">Points count towards the public Top 10. Only award them for real, checked contributions.</p>
              </div>
              <div>
                <label className="font-bold text-ink-soft block mb-1">Points to Award</label>
                <div className="flex items-center gap-2">
                  {[10, 25, 50, 100].map(pt => (
                    <button
                      key={pt}
                      type="button"
                      onClick={() => setBonusPoints(pt)}
                      className={`px-3 py-1.5 rounded-lg border font-bold text-[0.8438rem] ${
                        bonusPoints === pt ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-surface text-ink-soft border-line'
                      }`}
                    >
                      +{pt}
                    </button>
                  ))}
                  <input
                    type="number"
                    value={bonusPoints}
                    onChange={(e) => setBonusPoints(Number(e.target.value))}
                    className="w-20 p-1.5 border border-line rounded-lg text-ink font-bold text-center"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-ink-soft block mb-1">Reason / Citation</label>
                <input
                  type="text"
                  value={bonusReason}
                  onChange={(e) => setBonusReason(e.target.value)}
                  placeholder="e.g. Volunteer coordination at London peaceful rally"
                  className="w-full p-2 border border-line rounded-lg text-ink text-[0.8438rem]"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-line flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setAwardingBonusUser(null)}
                className="px-3.5 py-1.5 text-[0.8438rem] text-ink-soft hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAwardBonusPoints}
                disabled={awardingBonusLoading || !bonusPoints}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[0.8438rem] font-bold flex items-center gap-1.5"
              >
                {awardingBonusLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>Award Points Now</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: MANUAL MEMBER ADD */}
      {/* ======================================================== */}
      {addingMember && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateManualMember} className="bg-surface rounded-xl max-w-lg w-full p-6 space-y-4 shadow-sm border border-line">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="font-serif font-bold text-lg text-ink">Enrol Member into Registry</h3>
              <button type="button" onClick={() => setAddingMember(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-[0.8438rem]">
              <div className="space-y-1">
                <label className="font-semibold text-ink-soft">Full Name *</label>
                <input
                  type="text"
                  required
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="Full legal name"
                  className="w-full p-2 border border-line rounded-lg text-ink"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-ink-soft">Email Address *</label>
                <input
                  type="email"
                  required
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                  placeholder="member@example.org"
                  className="w-full p-2 border border-line rounded-lg text-ink"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="font-semibold text-ink-soft">Position</p>
                  <p className="text-[0.875rem] text-muted">New members start as Member. Appoint them to a position in the Organisation structure tab.</p>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-ink-soft">City Council</label>
                  <select
                    value={manualChapter}
                    onChange={(e) => setManualChapter(e.target.value)}
                    className="w-full p-2 border border-line rounded-lg bg-surface text-ink"
                  >
                    {chapters.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-ink-soft">Extra title <span className="font-normal text-muted">(optional, e.g. Trustee)</span></label>
                <input
                  type="text"
                  value={manualBoardTitle}
                  onChange={(e) => setManualBoardTitle(e.target.value)}
                  placeholder="e.g. Board President, Secretary General, Research Director"
                  className="w-full p-2 border border-line rounded-lg text-ink"
                />
              </div>

              <p className="text-muted">The member will be listed publicly with their position and council, like every member.</p>
            </div>

            <div className="pt-4 border-t border-line flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setAddingMember(false)}
                className="px-3.5 py-1.5 text-[0.8438rem] text-ink-soft hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-navy hover:bg-navy-deep text-white rounded-lg text-[0.8438rem] font-bold"
              >
                Create Member Record
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: APPLICATION REVIEW */}
      {/* ======================================================== */}
      {selectedApp && (
        <ApplicationReview
          app={selectedApp}
          chapters={chapters}
          onClose={() => setSelectedApp(null)}
          onDone={() => { setSelectedApp(null); refreshAdminData(); }}
        />
      )}

      {/* ======================================================== */}
      {/* MODAL: CONTENT REVIEW */}
      {/* ======================================================== */}
      {selectedArticle && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-xl max-w-2xl w-full p-6 space-y-4 shadow-sm border border-line">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="font-serif font-bold text-lg text-ink">{selectedArticle.title}</h3>
                <span className="text-[0.8438rem] text-muted">By {selectedArticle.authorDisplayName}</span>
              </div>
              <button onClick={() => setSelectedArticle(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-[0.8438rem] text-ink-soft space-y-2 max-h-56 overflow-y-auto">
              <p className="font-semibold text-ink">{selectedArticle.excerpt}</p>
              <p dir={selectedArticle.direction || 'auto'} className="whitespace-pre-wrap">{selectedArticle.content}</p>
            </div>

            <div className="space-y-1 text-[0.8438rem] pt-2 border-t border-line">
              <label className="font-semibold text-ink-soft">Editorial Feedback to Author</label>
              <textarea
                rows={2}
                value={contentFeedback}
                onChange={(e) => setContentFeedback(e.target.value)}
                placeholder="Guidance or required citations..."
                className="w-full p-2 border border-line rounded-lg text-ink text-[0.8438rem]"
              />
            </div>

            <p className="text-[0.8438rem] text-muted">The author is notified of your decision, with your feedback.</p>
            <div className="pt-3 flex flex-wrap items-center justify-end gap-2 border-t border-line">
              <button
                type="button"
                onClick={() => { if (window.confirm('Decline this article? The author will be told it was not accepted.')) handleArticleDecision('archived'); }}
                disabled={processingContent}
                className="px-3 py-1.5 text-crimson hover:bg-crimson/5 rounded-lg text-[0.8438rem] font-semibold"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={() => handleArticleDecision('changes_requested')}
                disabled={processingContent}
                className="px-3 py-1.5 bg-amber-50 text-amber-800 hover:bg-amber-100 rounded-lg text-[0.8438rem] font-semibold"
              >
                Ask for changes
              </button>
              <button
                type="button"
                onClick={() => handleArticleDecision('published')}
                disabled={processingContent}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[0.8438rem] font-bold"
              >
                Approve and publish
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
