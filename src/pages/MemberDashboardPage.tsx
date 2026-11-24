import { MyMeetingsPanel } from '../components/MyMeetingsPanel';
import { MembershipCardPanel } from '../components/MembershipCardPanel';
import { VoluntaryContribution } from '../components/BankTransferDetails';
import { MyPointsPanel } from '../components/MyPointsPanel';
import { levelFor } from '../lib/levels';
import { MediaImage } from '../components/MediaImage';
import { VideoPlayer } from '../components/VideoEmbed';
import { uploadImage } from '../lib/media';
import { VIDEO_HELP, videoEmbed } from '../lib/video';
import React, { useState, useEffect } from 'react';
import { 
  User, 
  FileText, 
  MapPin, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Plus, 
  Edit3, 
  Eye, 
  EyeOff, 
  Save, 
  Send, 
  ShieldCheck, 
  Trash2, 
  Bell, 
  Settings,
  ArrowRight,
  ExternalLink,
  Award,
  Flame,
  Crown,
  Heart,
  Share2,
  Sparkles,
  Upload,
  Image as ImageIcon,
  X,
  Check,
  CreditCard,
  Video, Languages } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { doc, getDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { updateMyProfile } from '../lib/memberApi';
import { db, safeSetDoc, safeUpdateDoc } from '../firebase';
import { MemberApplication, MemberRecord, Article, PublicProfile, UserActivityRecord } from '../types';
import { TranslationsAdmin } from '../admin/TranslationsAdmin';

interface MemberDashboardPageProps {
  /** Open a particular tab, e.g. /account/submissions */
  initialTab?: string;
  onNavigate: (tab: string, param?: string) => void;
  onOpenAuth: () => void;
}

export const MemberDashboardPage: React.FC<MemberDashboardPageProps> = ({ 
  initialTab,
  onNavigate, 
  onOpenAuth 
}) => {
  const { currentUser, userProfile, updateProfileData, signOut, isMember, hasPermission } = useAuth();
  const canTranslate = hasPermission('manage_translations');
  const { chapters, articles, createArticleSubmission, fetchUserActivities } = useData();

  type AccountTab = 'overview' | 'card' | 'meetings' | 'submissions' | 'activity' | 'profile' | 'chapter' | 'settings' | 'translations';
  const ACCOUNT_TABS: AccountTab[] = ['overview', 'card', 'meetings', 'submissions', 'activity', 'profile', 'chapter', 'settings', 'translations'];
  const [activeTab, setActiveTab] = useState<AccountTab>(ACCOUNT_TABS.includes(initialTab as AccountTab) ? (initialTab as AccountTab) : 'overview');
  useEffect(() => {
    if (ACCOUNT_TABS.includes(initialTab as AccountTab)) setActiveTab(initialTab as AccountTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTab]);
  const [myActivities, setMyActivities] = useState<UserActivityRecord[]>([]);

  // Application & Member record state
  const [application, setApplication] = useState<MemberApplication | null>(null);
  const [memberRecord, setMemberRecord] = useState<MemberRecord | null>(null);
  const [publicProfile, setPublicProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Profile edit fields
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editExpertise, setEditExpertise] = useState('');
  const [editPhotoUrl, setEditPhotoUrl] = useState('');
  const [photoFileName, setPhotoFileName] = useState<string | null>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 360;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
          setEditPhotoUrl(dataUrl);
          setPhotoFileName(file.name);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };
  const [directoryConsent, setDirectoryConsent] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Content submission modal/editor
  const [creatingPost, setCreatingPost] = useState(false);
  const [voluntary, setVoluntary] = useState<'yes' | 'no' | ''>('');
  const [postTitle, setPostTitle] = useState('');
  const [postExcerpt, setPostExcerpt] = useState('');
  const [postContent, setPostContent] = useState('');
  const [postCategory, setPostCategory] = useState('political');
  const [postTags, setPostTags] = useState('');
  const [postCoverUrl, setPostCoverUrl] = useState('');
  const [postCoverAlt, setPostCoverAlt] = useState('');
  const [postVideoUrl, setPostVideoUrl] = useState('');
  const [postDirection, setPostDirection] = useState<'ltr' | 'rtl'>('ltr');
  const [directionChosen, setDirectionChosen] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [submittingPost, setSubmittingPost] = useState(false);
  const [postMsg, setPostMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch application, member record, and public profile
  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const loadMemberData = async () => {
      try {
        // 1. Fetch application
        const appRef = doc(db, 'applications', `app-${currentUser.uid}`);
        const appSnap = await getDoc(appRef);
        if (appSnap.exists()) {
          const appData = appSnap.data() as MemberApplication;
          setApplication(appData);
          setDirectoryConsent(appData.consentToDirectory || false);
        }

        // 2. Fetch member record
        const memRef = doc(db, 'members', currentUser.uid);
        const memSnap = await getDoc(memRef);
        if (memSnap.exists()) {
          const memData = memSnap.data() as MemberRecord;
          setMemberRecord(memData);
          setEditDisplayName(memData.displayName || userProfile?.displayName || '');
          setEditBio(memData.bio || '');
          setEditExpertise(memData.expertise || '');
          setEditPhotoUrl(memData.photoUrl || '');
          setDirectoryConsent(memData.consentToDirectory || false);
        } else {
          setEditDisplayName(userProfile?.displayName || currentUser.displayName || '');
        }

        // 3. Fetch public profile
        const pubRef = doc(db, 'public_profiles', currentUser.uid);
        const pubSnap = await getDoc(pubRef);
        if (pubSnap.exists()) {
          setPublicProfile(pubSnap.data() as PublicProfile);
        } else {
          setPublicProfile(null);
        }

        // 4. Fetch personal activity records
        const acts = await fetchUserActivities(currentUser.uid);
        setMyActivities(acts);
      } catch (err) {
        console.warn('Dashboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadMemberData();
  }, [currentUser, userProfile]);

  // The membership card follows the member record live: when an
  // administrator changes the name, photo, position or dates, the card here
  // changes too, without reloading.
  useEffect(() => {
    if (!currentUser) return;
    return onSnapshot(doc(db, 'members', currentUser.uid), (snap) => {
      if (snap.exists()) setMemberRecord({ ...(snap.data() as MemberRecord), id: snap.id });
    }, () => undefined);
  }, [currentUser?.uid]);

  // Handle Directory Consent Toggle (Immediate hide/show)
  const handleToggleDirectoryConsent = async (consent: boolean) => {
    if (!currentUser) return;
    if (!memberRecord) {
      setProfileMsg({ type: 'error', text: 'Your directory listing becomes available once your membership is approved.' });
      return;
    }
    setDirectoryConsent(consent);
    try {
      // Update internal member record (the security rules read consent from here)
      const memRef = doc(db, 'members', currentUser.uid);
      await safeUpdateDoc(memRef, {
        consentToDirectory: consent,
        updatedAt: new Date().toISOString(),
      });

      // Keep the application in sync if there is one (imported members have none)
      if (application) {
        try {
          const appRef = doc(db, 'applications', `app-${currentUser.uid}`);
          await safeUpdateDoc(appRef, {
            consentToDirectory: consent,
            updatedAt: new Date().toISOString(),
          });
        } catch (appErr) {
          console.warn('Application consent sync note:', appErr);
        }
      }

      const pubRef = doc(db, 'public_profiles', currentUser.uid);
      if (consent) {
        // Publish to directory
        const memberChapterId = memberRecord.chapterId || application?.chapterId || 'britain';
        const chapter = chapters.find(c => c.id === memberChapterId);
        const newPub: PublicProfile = {
          id: currentUser.uid,
          userId: currentUser.uid,
          displayName: editDisplayName || memberRecord?.displayName || 'Member',
          photoUrl: editPhotoUrl || memberRecord?.photoUrl || '',
          // Must match the member record's chapter (enforced by the rules)
          chapterId: memberChapterId,
          chapterName: chapter?.name || memberChapterId,
          bio: editBio || memberRecord?.bio || '',
          expertise: editExpertise || memberRecord?.expertise || '',
          // Official position and member number, exactly as the committee recorded them.
          ...(memberRecord?.positionId ? { positionId: memberRecord.positionId } : {}),
          ...(memberRecord?.department ? { department: memberRecord.department } : {}),
          ...(memberRecord?.designation ? { designation: memberRecord.designation } : {}),
          ...(memberRecord?.memberNumber && /^M\d{7}$/.test(memberRecord.memberNumber) ? { memberNumber: memberRecord.memberNumber } : {}),
          updatedAt: new Date().toISOString(),
        };
        await safeSetDoc(pubRef, newPub);
        setPublicProfile(newPub);
        setProfileMsg({ type: 'success', text: 'Public directory profile is now visible to the public.' });
      } else {
        // Immediate removal
        await deleteDoc(pubRef);
        setPublicProfile(null);
        setProfileMsg({ type: 'success', text: 'Profile removed from public directory immediately.' });
      }
    } catch (e: any) {
      console.error('Toggle consent error:', e);
      setDirectoryConsent(!consent);
      setProfileMsg({ type: 'error', text: 'Could not update directory consent.' });
    }
  };

  // Save profile updates
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setSavingProfile(true);
    setProfileMsg(null);

    try {
      // The server saves the member record and refreshes the directory,
      // the organisation chart and the account name in one step.
      const { member } = await updateMyProfile({
        displayName: editDisplayName.trim(),
        bio: editBio.trim(),
        expertise: editExpertise.trim(),
        photoUrl: editPhotoUrl.trim() || '',
      });
      setMemberRecord(member);
      if (publicProfile) {
        setPublicProfile({ ...publicProfile, displayName: member.displayName, bio: member.bio, expertise: member.expertise, photoUrl: member.photoUrl });
      }
      setProfileMsg({ type: 'success', text: 'Saved. Your profile, the directory and the organisation chart now show these details.' });
    } catch (err: any) {
      console.error('Update profile error:', err);
      setProfileMsg({ type: 'error', text: err instanceof Error && err.message ? err.message : 'Your profile could not be saved. Please try again.' });
    } finally {
      setSavingProfile(false);
    }
  };

  // Handle Member Article Submission
  // Switch to right-to-left automatically when someone starts writing in
  // Kurdish or Arabic script, unless they chose a direction themselves.
  const autoDirection = (text: string) => {
    if (directionChosen) return;
    const letters = text.replace(/[\s\d\p{P}]/gu, '');
    if (letters.length < 4) return;
    const arabic = (letters.match(/[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/g) || []).length;
    setPostDirection(arabic / letters.length > 0.5 ? 'rtl' : 'ltr');
  };

  const handleCoverUpload = async (file: File) => {
    if (!currentUser) return;
    if (!file.type.startsWith('image/')) {
      setPostMsg({ type: 'error', text: 'Please choose an image file.' });
      return;
    }
    setUploadingCover(true);
    setPostMsg(null);
    try {
      const { ref } = await uploadImage(file, { uid: currentUser.uid, name: userProfile?.displayName }, postCoverAlt);
      setPostCoverUrl(ref);
    } catch (e) {
      console.error('Cover upload failed:', e);
      setPostMsg({ type: 'error', text: 'The image could not be uploaded. Try a smaller photo, or check that you are signed in as a member.' });
    } finally {
      setUploadingCover(false);
    }
  };

  const handleSavePost = async (status: 'draft' | 'submitted') => {
    if (!currentUser) return;
    if (status === 'submitted' && !voluntary) {
      setPostMsg({ type: 'error', text: 'Please answer the question about a voluntary contribution (either answer is fine).' });
      return;
    }
    if (!postTitle.trim() || !postContent.trim()) {
      setPostMsg({ type: 'error', text: 'Please provide both a title and article body.' });
      return;
    }
    if (postVideoUrl.trim() && !videoEmbed(postVideoUrl)) {
      setPostMsg({ type: 'error', text: 'The video link must be a YouTube, Vimeo or Facebook video link.' });
      return;
    }
    if (uploadingCover) {
      setPostMsg({ type: 'error', text: 'Please wait for the image to finish uploading.' });
      return;
    }

    setSubmittingPost(true);
    setPostMsg(null);

    try {
      await createArticleSubmission({
        title: postTitle.trim(),
        excerpt: postExcerpt.trim() || postContent.slice(0, 150) + '...',
        content: postContent.trim(),
        category: postCategory,
        tags: postTags.split(',').map(t => t.trim()).filter(Boolean),
        coverImageUrl: postCoverUrl.trim() || undefined,
        coverImageAlt: postCoverUrl ? (postCoverAlt.trim() || undefined) : undefined,
        videoUrl: postVideoUrl.trim() || undefined,
        direction: postDirection,
        language: postDirection === 'rtl' ? 'ckb' : 'en',
        chapterId: memberRecord?.chapterId || application?.chapterId || 'britain',
        status,
        isOfficialNews: false,
      });

      setPostMsg({ 
        type: 'success', 
        text: status === 'submitted' 
          ? 'Article successfully submitted for editorial committee review.' 
          : 'Draft saved to your workspace.' 
      });

      // Clear form
      setTimeout(() => {
        setCreatingPost(false);
        setPostTitle('');
        setPostExcerpt('');
        setPostContent('');
        setPostTags('');
        setPostCoverUrl('');
        setPostCoverAlt('');
        setPostVideoUrl('');
        setPostDirection('ltr');
        setDirectionChosen(false);
        setVoluntary('');
        setPostMsg(null);
      }, 1500);
    } catch (err: any) {
      console.error('Save post error:', err);
      setPostMsg({ type: 'error', text: 'Failed to save submission.' });
    } finally {
      setSubmittingPost(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-4">
        <h1 className="text-[2.25rem] font-serif font-semibold text-ink">Sign in to your account</h1>
        <p className="text-[1.0625rem] text-ink-soft">Check your membership application, edit your profile and submit articles.</p>
        <button
          onClick={onOpenAuth}
          className="px-6 py-2.5 bg-navy hover:bg-navy-deep text-white rounded-lg text-sm font-semibold"
        >
          Sign in or create an account
        </button>
      </div>
    );
  }

  // Filter author's submissions
  const myArticles = articles.filter(a => a.authorUid === currentUser.uid);

  const assignedChapter = chapters.find(
    c => c.id === (memberRecord?.chapterId || application?.chapterId || 'britain')
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14 space-y-8">
      
      {/* Top Banner & Member Header */}
      <div className="bg-navy text-white rounded-xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-navy flex items-center justify-center font-bold text-xl text-white overflow-hidden shrink-0">
            {userProfile?.displayName?.slice(0, 2).toUpperCase() || currentUser.email?.slice(0, 2).toUpperCase()}
          </div>
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-serif font-bold text-white truncate">
                {userProfile?.displayName || 'Your account'}
              </h1>
              {memberRecord?.isBoardMember && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[0.8438rem] font-bold bg-amber-400 text-amber-950 border border-amber-300">
                  <Crown className="w-3.5 h-3.5" />
                  <span>{memberRecord.boardTitle || 'Board member'}</span>
                </span>
              )}
              {memberRecord ? (
                <span className="px-2.5 py-0.5 rounded-lg text-[0.8438rem] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Member
                </span>
              ) : application ? (
                <span className="px-2.5 py-0.5 rounded-lg text-[0.8438rem] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 capitalize">
                  {application.status.replace('_', ' ')}
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-lg text-[0.8438rem] font-semibold bg-slate-700 text-slate-300">
                  Applicant
                </span>
              )}
              {/* Activity Tier & Points Badge */}
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[0.8438rem] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>{(publicProfile?.points?.all || 0).toLocaleString('en-GB')} pts • {levelFor(publicProfile?.points?.all || 0).level.name}</span>
              </span>
            </div>

            <p className="text-[0.8438rem] text-slate-400">
              {currentUser.email} {memberRecord && `  Member number ${memberRecord.memberNumber}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto">
          {memberRecord && (
            <button
              onClick={() => {
                setCreatingPost(true);
                setActiveTab('submissions');
              }}
              className="px-4 py-2 bg-navy hover:bg-navy-deep text-white rounded-lg text-[0.8438rem] font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Write an article</span>
            </button>
          )}

          <button
            onClick={() => onNavigate('contact')}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[0.8438rem] font-medium rounded-lg border border-slate-700"
          >
            Get help
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-line overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-lg text-[0.8438rem] font-semibold transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'overview' ? 'bg-navy text-white' : 'text-ink-soft hover:bg-stone'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Membership</span>
        </button>

        <button
          onClick={() => setActiveTab('card')}
          className={`px-4 py-2 rounded-lg text-[0.8438rem] font-semibold transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'card' ? 'bg-navy text-white' : 'text-ink-soft hover:bg-stone'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Membership card</span>
        </button>

        {isMember && (
          <button
            onClick={() => setActiveTab('meetings')}
            className={`px-4 py-2 rounded-lg text-[0.8438rem] font-semibold transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'meetings' ? 'bg-navy text-white' : 'text-ink-soft hover:bg-stone'
            }`}
          >
            <Video className="w-4 h-4" />
            <span>Meetings and participation</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('submissions')}
          className={`px-4 py-2 rounded-lg text-[0.8438rem] font-semibold transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'submissions' ? 'bg-navy text-white' : 'text-ink-soft hover:bg-stone'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Your articles ({myArticles.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('activity')}
          className={`px-4 py-2 rounded-lg text-[0.8438rem] font-semibold transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'activity' ? 'bg-navy text-white' : 'text-ink-soft hover:bg-stone'
          }`}
        >
          <Flame className="w-4 h-4 text-amber-500" />
          <span>Points and level</span>
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-2 rounded-lg text-[0.8438rem] font-semibold transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'profile' ? 'bg-navy text-white' : 'text-ink-soft hover:bg-stone'
          }`}
        >
          <User className="w-4 h-4" />
          <span>Profile and directory</span>
        </button>

        <button
          onClick={() => setActiveTab('chapter')}
          className={`px-4 py-2 rounded-lg text-[0.8438rem] font-semibold transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'chapter' ? 'bg-navy text-white' : 'text-ink-soft hover:bg-stone'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>Your council</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2 rounded-lg text-[0.8438rem] font-semibold transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'settings' ? 'bg-navy text-white' : 'text-ink-soft hover:bg-stone'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </button>

        {canTranslate && (
          <button
            onClick={() => setActiveTab('translations')}
            className={`px-4 py-2 rounded-lg text-[0.8438rem] font-semibold transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'translations' ? 'bg-navy text-white' : 'text-ink-soft hover:bg-stone'
            }`}
          >
            <Languages className="w-4 h-4" />
            <span>Translations</span>
          </button>
        )}
      </div>

      {activeTab === 'translations' && canTranslate && <TranslationsAdmin />}

      {activeTab === 'meetings' && <MyMeetingsPanel />}

      {activeTab === 'card' && (
        <MembershipCardPanel member={memberRecord} onNavigate={onNavigate} />
      )}

      {/* Tab 1: Overview & Status */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          
          {/* Member Card if Approved */}
          {memberRecord ? (
            <div className="text-white rounded-xl p-6 sm:p-8 border border-slate-700 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
                <div>
                  <span className="text-[0.8438rem] text-crimson font-semibold block">
                    Official Member Credential
                  </span>
                  <h3 className="text-2xl font-serif font-bold text-white mt-1">
                    {memberRecord.fullName || memberRecord.displayName}
                  </h3>
                </div>
                <div className="bg-white/10 px-3.5 py-1.5 rounded-lg border border-white/10 text-[0.8438rem] font-mono">
                  {memberRecord.memberNumber}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 text-[0.8438rem] text-slate-300">
                <div>
                  <span className="text-slate-400 block font-medium">Council</span>
                  <strong className="text-white text-sm">{assignedChapter?.name || memberRecord.chapterId}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Status</span>
                  <strong className="text-emerald-400 text-sm capitalize">{memberRecord.status}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Public directory</span>
                  <strong className="text-emerald-400 text-sm">Listed</strong>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Member since</span>
                  <strong className="text-white text-sm">
                    {new Date(memberRecord.joinedAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                  </strong>
                </div>
              </div>
            </div>
          ) : application ? (
            <div className="bg-surface rounded-xl border border-line p-6 sm:p-8 space-y-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-amber-50 text-amber-700 rounded-xl">
                  <Clock className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <span className="text-[0.8438rem] font-bold text-slate-400">
                    Application Under Review
                  </span>
                  <h3 className="text-xl font-serif font-bold text-ink capitalize">
                    Status: {application.status.replace('_', ' ')}
                  </h3>
                  <p className="text-[0.8438rem] text-ink-soft leading-relaxed">
                    Submitted on {new Date(application.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}. The membership committee will communicate any requested adjustments here.
                  </p>
                </div>
              </div>

              {application.applicantFeedback && (
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-[0.8438rem] text-amber-900 space-y-1">
                  <strong className="block font-semibold">Feedback from the committee:</strong>
                  <p>{application.applicantFeedback}</p>
                </div>
              )}

              {application.status === 'changes_requested' && (
                <button
                  onClick={() => onNavigate('apply')}
                  className="px-4 py-2 bg-navy hover:bg-navy-deep text-white rounded-lg text-[0.8438rem] font-semibold"
                >
                  Edit & Resubmit Application &rarr;
                </button>
              )}
            </div>
          ) : (
            <div className="bg-surface rounded-xl border border-line p-8 text-center space-y-4">
              <ShieldCheck className="w-12 h-12 text-slate-300 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-xl font-serif font-bold text-ink">
                  Apply for membership
                </h3>
                <p className="text-[0.8438rem] text-ink-soft max-w-md mx-auto">
                  You have an account but are not yet a member. Apply to join your local council and publish articles.
                </p>
              </div>
              <button
                onClick={() => onNavigate('apply')}
                className="px-6 py-2.5 bg-navy hover:bg-navy-deep text-white text-[0.8438rem] font-semibold rounded-lg shadow-sm"
              >
                Start your application
              </button>
            </div>
          )}

          {/* Activity / Quick links */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-surface p-5 rounded-xl border border-line space-y-2">
              <span className="text-[0.8438rem] text-slate-400 font-semibold">Published articles</span>
              <div className="text-2xl font-serif font-bold text-ink">
                {myArticles.filter(a => a.status === 'published').length}
              </div>
              <p className="text-[0.8438rem] text-muted">Visible on the website</p>
            </div>

            <div className="bg-surface p-5 rounded-xl border border-line space-y-2">
              <span className="text-[0.8438rem] text-slate-400 font-semibold">Awaiting review</span>
              <div className="text-2xl font-serif font-bold text-ink">
                {myArticles.filter(a => a.status === 'submitted' || a.status === 'under_review').length}
              </div>
              <p className="text-[0.8438rem] text-muted">Being checked by our editors</p>
            </div>

            <div className="bg-surface p-5 rounded-xl border border-line space-y-2">
              <span className="text-[0.8438rem] text-slate-400 font-semibold">Public directory</span>
              <div className="text-2xl font-serif font-bold text-ink">
                {publicProfile ? 'Listed' : 'Being added'}
              </div>
              <p className="text-[0.8438rem] text-muted">Every member is listed publicly</p>
            </div>
          </div>

        </div>
      )}

      {/* Tab 2: Submissions & Articles */}
      {activeTab === 'submissions' && (
        <div className="space-y-6">
          
          {/* Create Post Modal / Box */}
          {creatingPost && (
            <div className="bg-surface rounded-xl border-2 border-navy p-6 sm:p-8 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-line pb-4">
                <div>
                  <h3 className="text-xl font-serif font-bold text-ink">
                    Draft New Article or Member Story
                  </h3>
                  <p className="text-[0.8438rem] text-muted">
                    Submissions are peer-reviewed before publication. Unapproved revisions do not alter live articles.
                  </p>
                </div>
                <button
                  onClick={() => setCreatingPost(false)}
                  className="text-[0.8438rem] text-slate-400 hover:text-slate-700"
                >
                  Cancel
                </button>
              </div>

              {postMsg && (
                <div className={`p-3.5 rounded-lg text-[0.8438rem] flex items-center gap-2 ${
                  postMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-crimson/5 text-crimson border border-crimson/30'
                }`}>
                  {postMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span>{postMsg.text}</span>
                </div>
              )}

              <div className="space-y-4">
                <fieldset>
                  <legend className="block text-[0.8438rem] font-semibold text-ink-soft mb-1">Language and writing direction</legend>
                  <div className="flex flex-wrap gap-2" role="radiogroup">
                    {([['ltr', 'English (left to right)'], ['rtl', 'کوردی / Kurdish (right to left)']] as const).map(([v, l]) => (
                      <label key={v} className={`cursor-pointer rounded-lg border px-4 py-1.5 text-[0.875rem] ${postDirection === v ? 'border-navy bg-navy text-white' : 'border-line hover:border-ink/40'}`}>
                        <input type="radio" name="post-direction" className="sr-only" checked={postDirection === v} onChange={() => { setPostDirection(v); setDirectionChosen(true); }} />
                        {l}
                      </label>
                    ))}
                  </div>
                  <p className="mt-1 text-[0.8125rem] text-muted">Kurdish and Arabic articles are shown right to left, in a Kurdish typeface.</p>
                </fieldset>

                <div>
                  <label className="block text-[0.8438rem] font-semibold text-ink-soft mb-1">
                    Article Title <span className="text-navy">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    dir={postDirection}
                    value={postTitle}
                    onChange={(e) => { setPostTitle(e.target.value); autoDirection(e.target.value); }}
                    placeholder="Clear, informative headline..."
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-line focus:ring-2 focus:ring-navy/30 text-ink"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[0.8438rem] font-semibold text-ink-soft mb-1">
                      Topic Category <span className="text-navy">*</span>
                    </label>
                    <select
                      value={postCategory}
                      onChange={(e) => setPostCategory(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm rounded-lg border border-line focus:ring-2 focus:ring-navy/30 text-ink bg-surface"
                    >
                      <option value="political">Politics and governance</option>
                      <option value="economic">Economy</option>
                      <option value="social">Society and community</option>
                      <option value="legal">Law and human rights</option>
                      <option value="academic">Research</option>
                      <option value="environmental">Environment</option>
                      <option value="healthcare">Health</option>
                      <option value="militia">Armed groups and security</option>
                      <option value="class_inequality">Inequality</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[0.8438rem] font-semibold text-ink-soft mb-1">
                      Tags <span className="text-slate-400 font-normal">(separate with commas)</span>
                    </label>
                    <input
                      type="text"
                      value={postTags}
                      onChange={(e) => setPostTags(e.target.value)}
                      placeholder="e.g. Rule of Law, Sulaimaniyah, Human Rights"
                      className="w-full px-3.5 py-2 text-sm rounded-lg border border-line focus:ring-2 focus:ring-navy/30 text-ink"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[0.8438rem] font-semibold text-ink-soft mb-1">
                    Short Summary / Excerpt
                  </label>
                  <input
                    type="text"
                    dir={postDirection}
                    value={postExcerpt}
                    onChange={(e) => setPostExcerpt(e.target.value)}
                    placeholder="Brief 1-2 sentence lead for article cards..."
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-line focus:ring-2 focus:ring-navy/30 text-ink"
                  />
                </div>

                <div>
                  <p className="block text-[0.8438rem] font-semibold text-ink-soft mb-1">
                    Cover image <span className="text-slate-400 font-normal">(optional)</span>
                  </p>
                  {postCoverUrl ? (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                      <MediaImage src={postCoverUrl} alt="" className="aspect-[16/9] w-full rounded-lg object-cover sm:w-64" />
                      <div className="flex-1 space-y-2">
                        <label className="block text-[0.8438rem] font-semibold text-ink-soft">
                          Describe the image <span className="font-normal text-slate-400">(for people who can’t see it)</span>
                          <input type="text" dir="auto" value={postCoverAlt} onChange={(e) => setPostCoverAlt(e.target.value)} maxLength={300} placeholder="e.g. Members at the London vigil, February 2026" className="mt-1 w-full px-3.5 py-2 text-sm rounded-lg border border-line text-ink font-normal" />
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <label className="cursor-pointer rounded-lg border border-line px-3 py-1.5 text-[0.8438rem] font-semibold hover:bg-stone">
                            Choose another image
                            <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) handleCoverUpload(f); }} />
                          </label>
                          <button type="button" onClick={() => { setPostCoverUrl(''); setPostCoverAlt(''); }} className="rounded-lg px-3 py-1.5 text-[0.8438rem] font-semibold text-crimson hover:bg-crimson/5">Remove</button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <label className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-line px-4 py-6 text-center hover:border-navy ${uploadingCover ? 'opacity-60' : ''}`}>
                      <Upload className="h-6 w-6 text-navy" aria-hidden="true" />
                      <span className="text-[0.9375rem] font-semibold text-ink">{uploadingCover ? 'Uploading…' : 'Upload an image from your device'}</span>
                      <span className="text-[0.8125rem] text-muted">JPG, PNG or HEIC photos. Large photos are resized automatically.</span>
                      <input type="file" accept="image/*" disabled={uploadingCover} className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) handleCoverUpload(f); }} />
                    </label>
                  )}
                </div>

                <div>
                  <label className="block text-[0.8438rem] font-semibold text-ink-soft mb-1">
                    Video <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="url"
                    value={postVideoUrl}
                    onChange={(e) => setPostVideoUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=…"
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-line focus:ring-2 focus:ring-navy/30 text-ink"
                  />
                  <p className="mt-1 text-[0.8125rem] text-muted">{VIDEO_HELP}</p>
                  {videoEmbed(postVideoUrl) && <VideoPlayer url={postVideoUrl} title="Video preview" className="mt-2 max-w-md" />}
                </div>

                <div>
                  <label className="block text-[0.8438rem] font-semibold text-ink-soft mb-1">
                    Body Content <span className="text-navy">*</span>
                  </label>
                  <textarea
                    required
                    rows={8}
                    dir={postDirection}
                    value={postContent}
                    onChange={(e) => { setPostContent(e.target.value); autoDirection(e.target.value); }}
                    placeholder="Write your article or field report here. You can separate paragraphs with blank lines and use '### Heading' for sections..."
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-line focus:ring-2 focus:ring-navy/30 text-ink font-mono text-[0.8438rem] sm:text-sm"
                  />
                </div>
              </div>

              <VoluntaryContribution value={voluntary} onChange={setVoluntary} />

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-line">
                <button
                  type="button"
                  onClick={() => handleSavePost('draft')}
                  disabled={submittingPost}
                  className="px-4 py-2 border border-line rounded-lg text-[0.8438rem] font-semibold text-ink-soft hover:bg-stone transition-colors"
                >
                  Save as Private Draft
                </button>
                <button
                  type="button"
                  onClick={() => handleSavePost('submitted')}
                  disabled={submittingPost}
                  className="px-5 py-2 bg-navy hover:bg-navy-deep text-white rounded-lg text-[0.8438rem] font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit for Review</span>
                </button>
              </div>
            </div>
          )}

          {/* Submissions List */}
          <div className="bg-surface rounded-xl border border-line overflow-hidden shadow-xs">
            <div className="p-6 border-b border-line flex items-center justify-between">
              <div>
                <h3 className="font-serif font-bold text-lg text-ink">
                  Your Articles & Submissions
                </h3>
                <p className="text-[0.8438rem] text-muted">
                  Track editorial review, requested changes, and published status.
                </p>
              </div>

              {!creatingPost && (
                <button
                  onClick={() => setCreatingPost(true)}
                  className="px-4 py-2 bg-navy hover:bg-navy-deep text-white rounded-lg text-[0.8438rem] font-semibold flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New article</span>
                </button>
              )}
            </div>

            {myArticles.length > 0 ? (
              <div className="divide-y divide-line">
                {myArticles.map((art) => (
                  <div key={art.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-stone transition-colors">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[0.8125rem] font-bold ${
                          art.status === 'published' ? 'bg-emerald-100 text-emerald-800' :
                          art.status === 'under_review' ? 'bg-amber-100 text-amber-800' :
                          art.status === 'changes_requested' ? 'bg-rose-100 text-rose-800' :
                          'bg-stone text-ink-soft'
                        }`}>
                          {art.status.replace('_', ' ')}
                        </span>
                        <span className="text-[0.8438rem] text-slate-400 capitalize">• {art.category.replace('_', ' ')}</span>
                      </div>

                      <h4 className="font-serif font-bold text-base text-ink">
                        {art.title}
                      </h4>

                      <p className="text-[0.8438rem] text-muted line-clamp-1 max-w-xl">
                        {art.excerpt}
                      </p>

                      {art.status === 'published' && (
                        <div className="flex items-center gap-3 text-[0.8125rem] text-muted font-mono pt-1">
                          <span className="flex items-center gap-1">
                            <Eye className="w-3.5 h-3.5 text-slate-400" />
                            <span>{art.viewsCount || 0} views</span>
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Heart className="w-3.5 h-3.5 text-crimson" />
                            <span>{art.likesCount || 0} likes</span>
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-amber-700 font-bold">
                            <Flame className="w-3.5 h-3.5 text-amber-500" />
                            <span>{art.engagementScore || (art.viewsCount || 0)} score</span>
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {art.status === 'published' ? (
                        <button
                          onClick={() => onNavigate('article', art.slug)}
                          className="px-3 py-1.5 bg-stone hover:bg-stone-deep text-ink-soft rounded-lg text-[0.8438rem] font-medium flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View on website</span>
                        </button>
                      ) : (
                        <span className="text-[0.8438rem] text-slate-400 italic">
                          Awaiting reviewer sign-off
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center space-y-3">
                <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-sm text-ink-soft font-medium">You haven’t written any articles yet.</p>
                <p className="text-[0.8438rem] text-slate-400">Share research, reports or commentary. Our editors review every article before it is published.</p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* Tab: points, level and history */}
      {activeTab === 'activity' && currentUser && <MyPointsPanel uid={currentUser.uid} />}

      {/* Tab 3: Directory & Profile Settings */}
      {activeTab === 'profile' && (
        <div className="bg-surface rounded-xl border border-line p-6 sm:p-8 shadow-xs space-y-8">
          
          <div className="border-b border-line pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-serif font-bold text-ink">
                Directory Visibility & Public Profile
              </h3>
              <p className="text-[0.8438rem] text-muted">
                Every member of Mashkhally Zhyanawa is listed publicly. Choose the name, photo and short description people see.
              </p>
            </div>

            <p className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-[0.8438rem] font-semibold text-emerald-800">
              <Eye className="h-4 w-4 text-emerald-600" />
              <span>You are listed publicly as a member</span>
            </p>
          </div>

          {profileMsg && (
            <div className={`p-3.5 rounded-lg text-[0.8438rem] flex items-center gap-2 ${
              profileMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-crimson/5 text-crimson border border-crimson/30'
            }`}>
              {profileMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{profileMsg.text}</span>
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-[0.8438rem] font-semibold text-ink-soft mb-1">
                  Public Display Name <span className="text-navy">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-line focus:ring-2 focus:ring-navy/30 text-ink"
                />
                <span className="text-[0.8125rem] text-muted mt-1 block">
                  Displayed on your published articles and directory card.
                </span>
              </div>

              <div>
                <label className="block text-[0.8438rem] font-semibold text-ink-soft mb-1">
                  Profile Photograph <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl overflow-hidden border border-line bg-stone flex items-center justify-center shrink-0">
                    {editPhotoUrl ? (
                      <img src={editPhotoUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <label className="cursor-pointer px-3 py-1.5 bg-stone hover:bg-stone-deep text-ink text-[0.8438rem] font-medium rounded-lg border border-line flex items-center gap-1.5 transition-colors">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Choose a photo</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={handlePhotoUpload} 
                          className="hidden" 
                        />
                      </label>
                      {editPhotoUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditPhotoUrl('');
                            setPhotoFileName(null);
                          }}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg text-[0.8438rem]"
                          title="Remove photo"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    {photoFileName && (
                      <span className="text-[0.8125rem] text-emerald-600 block">✓ Attached: {photoFileName}</span>
                    )}
                  </div>
                </div>
                <span className="text-[0.8125rem] text-muted mt-1 block">
                  PNG, JPG, or WebP. Direct upload from your device, no URL required.
                </span>
              </div>
            </div>

            <div>
              <label className="block text-[0.8438rem] font-semibold text-ink-soft mb-1">
                Short Public Biography
              </label>
              <textarea
                rows={3}
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                placeholder="A brief introduction of your civic interests or research areas..."
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-line focus:ring-2 focus:ring-navy/30 text-ink"
              />
            </div>

            <div>
              <label className="block text-[0.8438rem] font-semibold text-ink-soft mb-1">
                Contribution Areas & Expertise <span className="text-slate-400 font-normal">(separate with commas)</span>
              </label>
              <input
                type="text"
                value={editExpertise}
                onChange={(e) => setEditExpertise(e.target.value)}
                placeholder="e.g. Legal Research, Translation, Kurdish Language, Youth Empowerment"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-line focus:ring-2 focus:ring-navy/30 text-ink"
              />
            </div>

            <div className="pt-2 flex items-center justify-end">
              <button
                type="submit"
                disabled={savingProfile}
                className="px-6 py-2.5 bg-navy hover:bg-navy-deep text-white rounded-lg text-[0.8438rem] font-semibold flex items-center gap-2 shadow-xs disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingProfile ? 'Saving...' : 'Save Profile Changes'}</span>
              </button>
            </div>
          </form>

        </div>
      )}

      {/* Tab 4: My Chapter */}
      {activeTab === 'chapter' && (
        <div className="bg-surface rounded-xl border border-line p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[0.8438rem] font-bold text-navy">
                Your council
              </span>
              <h3 className="text-2xl font-serif font-bold text-ink mt-1">
                {assignedChapter?.name || 'Your'} council
              </h3>
            </div>
            {assignedChapter && (
              <button
                onClick={() => onNavigate('chapter', assignedChapter.slug)}
                className="px-3.5 py-1.5 bg-navy hover:bg-navy-deep text-white text-[0.8438rem] font-semibold rounded-lg flex items-center gap-1.5"
              >
                <span>View council page</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>

          <p className="text-sm text-ink-soft leading-relaxed max-w-2xl">
            {assignedChapter?.description || 'You are attached to this council for local workshops, civic meetings, and peer-to-peer solidarity.'}
          </p>

          <div className="p-4 bg-stone rounded-xl border border-line text-[0.8438rem] text-ink-soft space-y-1">
            <strong className="text-ink block">Coordinator:</strong>
            <span>{assignedChapter?.coordinatorName || 'Secretariat Assigned Officer'}</span>
          </div>
        </div>
      )}

      {/* Tab 5: Account Settings */}
      {activeTab === 'settings' && (
        <div className="bg-surface rounded-xl border border-line p-6 sm:p-8 shadow-xs space-y-8">
          <div>
            <h3 className="text-xl font-serif font-bold text-ink">
              Account Security & Data Management
            </h3>
            <p className="text-[0.8438rem] text-muted">
              Manage your credentials and request data subject erasure.
            </p>
          </div>

          <div className="space-y-4 max-w-md">
            <div>
              <span className="text-[0.8438rem] font-semibold text-ink-soft block mb-1">
                Registered Email
              </span>
              <div className="text-sm font-mono text-ink bg-stone p-2.5 rounded-lg border border-line">
                {currentUser.email}
              </div>
            </div>

            <div className="pt-4 border-t border-line flex flex-col gap-3">
              <button
                onClick={() => {
                  signOut();
                  onNavigate('home');
                }}
                className="w-full py-2.5 px-4 bg-slate-800 hover:bg-navy-deep text-white text-[0.8438rem] font-semibold rounded-lg transition-colors text-center"
              >
                Sign Out of This Session
              </button>

              <button
                onClick={() => onNavigate('contact')}
                className="w-full py-2.5 px-4 border border-rose-300 text-rose-700 hover:bg-rose-50 text-[0.8438rem] font-semibold rounded-lg transition-colors text-center"
              >
                Request Account & Data Deletion
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
