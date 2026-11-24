export type Role = 
  | 'visitor'
  | 'applicant'
  | 'member'
  | 'membership_reviewer'
  | 'content_reviewer'
  | 'publisher'
  | 'administrator'
  | 'owner';

export type ApplicationStatus = 
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'changes_requested'
  | 'approved'
  | 'rejected'
  | 'withdrawn';

/** Stored membership status. "Expired" is never stored: it is worked out
 *  from expiresAt, so a card expires on time without anyone acting. */
export type MemberStatus = 'active' | 'suspended' | 'revoked' | 'archived';

/** What a verifier sees, including the derived "expired" state. */
export type VerificationState = 'active' | 'expired' | 'suspended' | 'revoked';

export type InvolvementPeriod = 'new' | 'lt6m' | '6to12m' | '1to3y' | 'gt3y' | 'specific';

/** The applicant's own account of prior involvement. It never sets the
 *  official joining date, which is confirmed on approval. */
export interface Involvement {
  period: InvolvementPeriod;
  since?: string;
  note?: string;
}

export type ArticleStatus = 
  | 'awaiting_payment'
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'changes_requested'
  | 'approved'
  | 'published'
  | 'archived';

export type ContentType = 'article' | 'video_speech' | 'monitoring_report' | 'archive';

export type Permission = 
  | 'manage_users'
  | 'manage_members'
  | 'manage_content'
  | 'publish_content'
  | 'bulk_import'
  | 'view_analytics'
  | 'manage_settings'
  | 'manage_donations'
  | 'manage_notifications'
  | 'manage_events'
  | 'manage_translations';

export type ActivityTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';

export type MemberHierarchyLevel = 
  | 'board_executive'     // Tier 1: Board of Directors & Executive Leadership
  | 'chapter_coordinator' // Tier 2: Chapter & Regional Directors
  | 'advisory_fellow'     // Tier 3: Advisory Council, Senior Researchers & Committee Leads
  | 'general_member'      // Tier 4: Active Verified Members
  | 'honorary_member';    // Tier 5: Honorary & Lifetime Patrons

export interface UserActivityRecord {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  type: 
    | 'article_published' 
    | 'research_report'
    | 'event_participation'
    | 'media_contribution'
    | 'discussion_contribution'
    | 'project_support'
    | 'article_submitted' 
    | 'article_read' 
    | 'article_liked' 
    | 'article_shared'
    | 'membership_applied' 
    | 'membership_approved'
    | 'profile_updated' 
    | 'bonus_awarded';
  points: number;
  description: string;
  targetId?: string;
  targetTitle?: string;
  timestamp: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoUrl?: string;
  roles: Role[];
  permissions?: Permission[];
  activityScore?: number;
  activityTier?: ActivityTier;
  rank?: number;
  chapterId?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AdminDoc {
  uid: string;
  email: string;
  role: 'owner' | 'administrator';
  createdAt: string;
}

export interface MemberApplication {
  id: string;
  userId: string;
  fullName: string;
  displayName: string;
  email: string;
  phone?: string;
  country: string;
  /** The member group: a country abroad or a province of Kurdistan (see lib/places). */
  chapterId: string;
  /** The city or town the applicant is joining from. */
  city?: string;
  reason: string;
  skills?: string;
  photoUrl?: string;
  agreedToPolicies: boolean;
  consentToDirectory: boolean;
  involvement?: Involvement;
  /** The one official position the applicant is applying for (see lib/positions). */
  positionId?: string;
  status: ApplicationStatus;
  staffNotes?: string;
  applicantFeedback?: string;
  reviewerUid?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MemberRecord {
  id: string;
  userId: string;
  memberNumber: string;
  fullName: string;
  displayName: string;
  email: string;
  phone?: string;
  chapterId: string;
  status: MemberStatus;
  roles: Role[];
  isBoardMember?: boolean;
  boardTitle?: string;
  hierarchyLevel?: MemberHierarchyLevel;
  displayRankOrder?: number;
  consentToDirectory: boolean;
  photoUrl?: string;
  bio?: string;
  expertise?: string;
  activityScore?: number;
  /** Official date the person became a member (confirmed by the committee). */
  joinedAt: string;
  /** When they applied on the website (the default card expiry is one year later). */
  appliedAt?: string;
  /** Official position (see lib/positions); `designation` holds its title for the card. */
  positionId?: string;
  /** Department of the position. */
  department?: string;
  /** Role or professional designation shown on the card, e.g. Journalist. */
  designation?: string;
  /** Validity of the current membership card. */
  validFrom?: string;
  expiresAt?: string;
  credentialIssuedAt?: string;
  /** Fixed verification link encoded in the member's QR code. */
  verifyUrl?: string;
  involvement?: Involvement;
  updatedAt: string;
}

/** Public verification record, readable by document id (the member number)
 *  only. It cannot be listed, so member numbers cannot be harvested. */
export interface Verification {
  id: string;
  memberNumber: string;
  name: string;
  designation: string;
  status: 'active' | 'suspended' | 'revoked';
  validFrom?: string;
  expiresAt?: string;
  verifyUrl: string;
  /** Directory profile id (the member record id), so the QR page can show the profile. */
  profileId?: string;
  positionId?: string;
  department?: string;
  updatedAt: string;
}

export interface PublicProfile {
  id: string;
  userId: string;
  displayName: string;
  photoUrl?: string;
  chapterId: string;
  chapterName: string;
  boardTitle?: string;
  isBoardMember?: boolean;
  hierarchyLevel?: MemberHierarchyLevel;
  displayRankOrder?: number;
  bio?: string;
  expertise?: string;
  activityScore?: number;
  activityTier?: ActivityTier;
  rank?: number;
  /** Role or professional designation, set by administrators. */
  designation?: string;
  /** Official position and department, copied from the member record. */
  positionId?: string;
  department?: string;
  /** Official joining date, shown only if the member chose to show it. */
  memberSince?: string;
  /** Member number, for the public verification link. */
  memberNumber?: string;
  /** 'suspended' hides the person from the directory. */
  membershipStatus?: 'active' | 'suspended';
  /** When the member was approved and added to the website. */
  listedAt?: string;
  /** Points for the Top 10 ranking: { all, m202610, q20264 } */
  points?: Record<string, number>;
  updatedAt: string;
}

export interface ImportColumnMapping {
  csvHeader: string;
  targetField: 
    | 'fullName'
    | 'email'
    | 'phone'
    | 'chapterId'
    | 'boardTitle'
    | 'hierarchyLevel'
    | 'status'
    | 'bio'
    | 'expertise'
    | 'ignore';
}

export interface CityChapter {
  id: string;
  name: string;
  slug: string;
  country: string;
  description: string;
  imageUrl?: string;
  /** Landmark photo chosen by an administrator (media:<id> or a link). */
  landmarkImage?: string;
  /** What the landmark photo shows. */
  landmarkName?: string;
  /** Photographer or source of the administrator's photo. */
  landmarkCredit?: string;
  /** Short video of the city's landmarks for the homepage cover (.mp4 or .webm link). */
  coverVideoUrl?: string;
  /** Position on the UK map. */
  lat?: number;
  lng?: number;
  coordinatorName?: string;
  coordinatorUid?: string;
  leadCoordinator?: string;
  memberCount?: number;
  meetingCadence?: string;
  contactEmail?: string;
  displayOrder: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImageUrl?: string;
  coverImageAlt?: string;
  category: string;
  tags: string[];
  chapterId?: string;
  authorUid: string;
  authorDisplayName: string;
  isOfficialNews: boolean;
  contentType: ContentType;
  status: ArticleStatus;
  currentRevisionId?: string;
  publishedRevisionId?: string;
  sourceLinks?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  // Metrics & engagement
  viewsCount?: number;
  likesCount?: number;
  sharesCount?: number;
  readingTimeMinutes?: number;
  engagementScore?: number;
  lastViewedAt?: string;
  /** YouTube or Vimeo link for talks and video reports. */
  videoUrl?: string;
  /** Who sent it: a member, or a visitor who pays a publication fee. Never shown publicly. */
  contributorType?: 'member' | 'visitor';
  /** Which publication fee applies to a visitor's submission. */
  feeCategory?: 'article' | 'video';
  /** Text direction: 'rtl' for Kurdish (Sorani) and Arabic articles. */
  direction?: 'ltr' | 'rtl';
  /** Language code, e.g. 'en' or 'ckb' (Central Kurdish). */
  language?: string;
  /** Message from the editors when changes are requested or it is declined. */
  reviewerFeedback?: string;
}

export interface ArticleRevision {
  id: string;
  articleId: string;
  revisionNumber: number;
  title: string;
  excerpt: string;
  content: string;
  coverImageUrl?: string;
  coverImageAlt?: string;
  category: string;
  tags: string[];
  authorUid: string;
  status: ArticleStatus;
  reviewFeedback?: string;
  reviewerUid?: string;
  createdAt: string;
}

export interface Banner {
  id: string;
  title: string;
  supportingText?: string;
  imageUrl?: string;
  imageAlt?: string;
  actionLabel?: string;
  actionUrl?: string;
  placement: 'announcement_bar' | 'homepage_feature';
  priority: number;
  status: 'draft' | 'published' | 'archived';
  startAt?: string;
  endAt?: string;
  allowDismissal: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Red scrolling "breaking news" banner. */
export interface NewsBanner {
  id: string;
  /** default: the organisation name; announcement: an activity; breaking: urgent news */
  mode: 'default' | 'announcement' | 'breaking';
  message: string;
  linkUrl?: string;
  /** Date and time of the activity being announced, shown in the banner. */
  eventAt?: string;
  /** Where the activity takes place (address, city or "Online"). */
  location?: string;
  /** Longer description shown on the activity page. */
  details?: string;
  /** YouTube, Vimeo or Facebook video link, played on the activity page. */
  videoUrl?: string;
  /** The council organising the activity, if it is a council activity. */
  councilId?: string;
  /** Members can register to attend (activity announcements; on by default). */
  registrationOpen?: boolean;
  /** Number of members registered to attend. */
  attendeeCount?: number;
  status: 'draft' | 'published' | 'archived';
  startAt?: string;
  endAt?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export type EventType = 'workshop' | 'meeting' | 'demonstration' | 'conference' | 'campaign' | 'commemoration' | 'other';

export interface OrgEvent {
  id: string;
  title: string;
  description: string;
  type: EventType;
  startAt: string;
  endAt?: string;
  location?: string;
  councilId?: string;
  status: 'draft' | 'published' | 'cancelled';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** A personal notification for one signed-in user, created by a real event. */
export interface UserNotification {
  id: string;
  userId: string;
  type: 'application' | 'article' | 'membership' | 'card' | 'event' | 'announcement' | 'system';
  title: string;
  body?: string;
  link?: string;
  read: boolean;
  createdAt: string;
  createdBy?: string;
}

export type CommentParentType = 'article' | 'activity';

/** A comment on an article, video or activity, from a member or a visitor. */
export interface ArticleComment {
  id: string;
  parentType: CommentParentType;
  parentId: string;
  authorUid: string;
  authorName: string;
  /** Written by a visitor without an account. */
  visitor: boolean;
  text: string;
  /** The comment this one replies to (one level of replies). */
  replyTo?: string;
  status: 'visible' | 'hidden';
  createdAt: string;
  editedAt?: string;
}

export type ReactionType = 'like' | 'solidarity' | 'important' | 'sad';

export interface ContentReport {
  id: string;
  targetType: 'comment' | 'article';
  parentType?: CommentParentType;
  /** The article or activity. */
  articleId: string;
  commentId?: string;
  commentText?: string;
  commentAuthor?: string;
  reason: string;
  reporterUid: string;
  status: 'open' | 'resolved';
  createdAt: string;
  resolvedBy?: string;
}

/** An uploaded image, stored compressed in the database. */
export interface MediaItem {
  id: string;
  dataUrl: string;
  width: number;
  height: number;
  bytes: number;
  alt?: string;
  ownerUid: string;
  ownerName?: string;
  createdAt: string;
}

export interface PointRules {
  article_published: number;
  research_report: number;
  event_participation: number;
  media_contribution: number;
  discussion_contribution: number;
  project_support: number;
}

export interface DonationConfig {
  id: string;
  accountHolder?: string;
  bankName?: string;
  accountNumber?: string;
  sortCode?: string;
  iban?: string;
  swiftBic?: string;
  currency?: string;
  referenceInstructions?: string;
  guidance?: string;
  isPublished: boolean;
  hideInstructions: boolean;
  updatedBy?: string;
  publishedAt?: string;
  updatedAt: string;
}

export interface ContactEnquiry {
  id: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  privacyAgreed: boolean;
  status: 'new' | 'in_progress' | 'resolved';
  staffNotes?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorUid: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  details: string;
  timestamp: string;
}

export interface TimelineEvent {
  id: string;
  date: string;
  title: string;
  description: string;
  isApproved: boolean;
  sourceUrl?: string;
}

export interface FaqItem {
  id: string;
  category: 'membership' | 'contributions' | 'editorial' | 'donations' | 'privacy' | 'general';
  question: string;
  answer: string;
  isPublished: boolean;
}

export interface AreaOfWork {
  id: string;
  title: string;
  description: string;
  iconName: string;
}

export interface SiteSettings {
  id: string;
  mission: string;
  background: string;
  history: TimelineEvent[];
  faqs: FaqItem[];
  areasOfWork: AreaOfWork[];
  /** Public address of the website, used in membership QR codes. */
  siteUrl?: string;
  /** The organisation's Facebook Page, whose posts are shown as activities. */
  facebookPageUrl?: string;
  interactions?: {
    commentsEnabled: boolean;
    commentsMembersOnly: boolean;
    reactionsEnabled: boolean;
  };
  ranking?: {
    enabled: boolean;
    period: 'all' | 'month' | 'quarter';
  };
  pointRules?: PointRules;
  updatedAt: string;
  updatedBy?: string;
}

/** A message broadcast to visitors or members, shown in the header bell and
 *  as a popup banner while it is published and within its time window. */
export interface SiteNotification {
  id: string;
  title: string;
  body: string;
  linkLabel?: string;
  linkUrl?: string;
  level: 'info' | 'important' | 'urgent';
  audience: 'everyone' | 'members';
  status: 'draft' | 'published' | 'archived';
  startAt?: string;
  endAt?: string;
  createdBy: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export type AttendanceResponse = 'attending' | 'not_attending';

export interface ActivityRegistration {
  userId: string;
  name: string;
  photoUrl?: string;
  memberNumber?: string;
  positionId?: string;
  chapterId?: string;
  note?: string;
  /** The member's answer; older registrations without it mean attending. */
  status?: AttendanceResponse;
  /** Confirmed by an organiser after the activity (earns attendance points). */
  attended?: boolean;
  attendedAt?: string;
  attendedBy?: string;
  createdAt: string;
  updatedAt?: string;
}
