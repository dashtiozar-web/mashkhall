import { CityChapter, TimelineEvent, FaqItem, AreaOfWork, Article, PublicProfile } from '../types';


export const INITIAL_CHAPTERS: CityChapter[] = [
  {
    id: 'london',
    name: 'London',
    slug: 'london',
    country: 'United Kingdom',
    description: 'London central hub connecting human-rights advocates, researchers, and diaspora community initiatives across Greater London.',
    imageUrl: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=800&q=80',
    displayOrder: 1,
    isArchived: false,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'birmingham',
    name: 'Birmingham',
    slug: 'birmingham',
    country: 'United Kingdom',
    description: 'Active Midlands council focusing on civic awareness forums, language access, and legal rights workshops.',
    imageUrl: 'https://images.unsplash.com/photo-1579273166627-8979848eb33a?auto=format&fit=crop&w=800&q=80',
    displayOrder: 2,
    isArchived: false,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'manchester',
    name: 'Manchester',
    slug: 'manchester',
    country: 'United Kingdom',
    description: 'Northern England coordination centre promoting grassroots community solidarity, academic roundtables, and youth engagement.',
    imageUrl: 'https://images.unsplash.com/photo-1569429593410-b498b3fb3387?auto=format&fit=crop&w=800&q=80',
    displayOrder: 3,
    isArchived: false,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'newcastle',
    name: 'Newcastle',
    slug: 'newcastle',
    country: 'United Kingdom',
    description: 'North East regional council supporting newcomer integration, public awareness lectures, and community wellbeing.',
    imageUrl: 'https://images.unsplash.com/photo-1549880338-65ddcdfd017b?auto=format&fit=crop&w=800&q=80',
    displayOrder: 4,
    isArchived: false,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'glasgow',
    name: 'Glasgow',
    slug: 'glasgow',
    country: 'United Kingdom',
    description: 'Scottish network dedicated to human-rights documentation, refugee advice signposting, and cross-cultural dialogue.',
    imageUrl: 'https://images.unsplash.com/photo-1579294800821-69fc81c38844?auto=format&fit=crop&w=800&q=80',
    displayOrder: 5,
    isArchived: false,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'cardiff',
    name: 'Cardiff',
    slug: 'cardiff',
    country: 'United Kingdom',
    description: 'Wales council coordinating peaceful solidarity gatherings, educational workshops, and translation initiatives.',
    imageUrl: 'https://images.unsplash.com/photo-1599827056335-90141f99c277?auto=format&fit=crop&w=800&q=80',
    displayOrder: 6,
    isArchived: false,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
];

export const INITIAL_TIMELINE: TimelineEvent[] = [
  {
    id: 'hist-1',
    date: '17 February 2011',
    title: 'Inspiration from Peaceful Civic Protests in Kurdistan',
    description: 'In February 2011, peaceful civic demonstrations commenced in Sulaimaniyah and throughout the Kurdistan Region, demanding governmental accountability, freedom of expression, an end to institutional corruption, and equitable social rights. The courage of those assemblies became the foundational inspiration for our name.',
    isApproved: true,
  },
  {
    id: 'hist-2',
    date: '17 February 2015',
    title: 'Founding of Mashkhally Zhyanawa Organisation',
    description: 'The organisation was established on 17 February 2015 by community members, writers, and human-rights advocates committed to institutionalising peaceful advocacy, independent research, and continuous support for affected communities.',
    isApproved: true,
  },
  {
    id: 'hist-5',
    date: 'Present Day',
    title: 'Expanding Nationwide & International Advocacy',
    description: 'Today, Mashkhally Zhyanawa Organisation maintains active city councils, publishes rigorous research across nine primary socio-political topics, and coordinates peaceful awareness campaigns in cooperation with civil society partners.',
    isApproved: true,
  },
];

export const INITIAL_AREAS_OF_WORK: AreaOfWork[] = [
  {
    id: 'area-1',
    title: 'Human Rights & Legal Advocacy',
    description: 'Documenting violations, upholding peaceful civil liberties, and advising community members on fundamental rights and due process.',
    iconName: 'Scale',
  },
  {
    id: 'area-2',
    title: 'Public Transparency & Accountability',
    description: 'Investigating systemic governance failures, advocating for open records, and promoting anti-corruption accountability mechanisms.',
    iconName: 'ShieldCheck',
  },
  {
    id: 'area-3',
    title: 'Community & City Councils',
    description: 'Mobilising regional groups across the UK to offer mutual assistance, educational events, language access, and civic empowerment.',
    iconName: 'Users',
  },
  {
    id: 'area-4',
    title: 'Research, Speeches & Archive',
    description: 'Publishing evidence-based reports, archiving historical testimonies, and disseminating public education on democratic reforms.',
    iconName: 'BookOpen',
  },
];

export const INITIAL_FAQS: FaqItem[] = [
  {
    id: 'faq-1',
    category: 'membership',
    question: 'Who is eligible to apply for membership with Mashkhally Zhyanawa Organisation?',
    answer: 'Membership is open to anyone who shares our commitment to human rights, peaceful awareness, transparency, and freedom of expression. All applicants submit an application which is reviewed by our membership committee.',
    isPublished: true,
  },
  {
    id: 'faq-2',
    category: 'membership',
    question: 'Is my personal information made public if I become a member?',
    answer: 'No. We take privacy extremely seriously. Private information such as full name, email, phone number, and application statements are never shared publicly. You have explicit control over whether an approved public display name, biography, and city appear in our public directory.',
    isPublished: true,
  },
  {
    id: 'faq-3',
    category: 'editorial',
    question: 'How does the content review and publication process work?',
    answer: 'Members may submit articles, field reports, and commentary through their Member Dashboard. Every submission is carefully reviewed by editorial reviewers to ensure adherence to factual integrity, non-violence, and our community standards before publication.',
    isPublished: true,
  },
  {
    id: 'faq-4',
    category: 'donations',
    question: 'How are donations handled and what are they used for?',
    answer: 'Donations sustain our educational programmes, public awareness materials, venue hire for community forums, and digital research archives. We only accept direct bank transfers through our officially published details, ensuring complete donor transparency without hidden intermediary fees.',
    isPublished: true,
  },
  {
    id: 'faq-5',
    category: 'contributions',
    question: 'Can I contribute without writing articles?',
    answer: 'Yes. Members actively participate in organizing local council gatherings, translating vital human rights documents, conducting research, coordinating outreach, and offering peer support to newcomers.',
    isPublished: true,
  },
  {
    id: 'faq-6',
    category: 'privacy',
    question: 'Will my membership be shown publicly?',
    answer: 'Yes. Every approved member is listed on our website with the name they choose to be shown under, their position, department and council. Your legal name, email address, phone number and application answers are never published. If being listed raises a safety concern for you, please contact us before applying. You can ask us to close your membership and remove your data at any time.',
    isPublished: true,
  },
  {
    id: 'faq-7',
    category: 'general',
    question: 'How can our institution or university contact Mashkhally Zhyanawa for speaking engagements?',
    answer: 'You can submit an enquiry through our Contact page selecting Academic & Research Enquiry, and our secretariat will respond within 3–5 working days.',
    isPublished: true,
  },
];


export const TOPICS = [
  { id: 'all', label: 'All Topics' },
  { id: 'political', label: 'Political & Governance' },
  { id: 'economic', label: 'Economic Reforms' },
  { id: 'social', label: 'Social & Community' },
  { id: 'legal', label: 'Legal & Human Rights' },
  { id: 'academic', label: 'Academic & Research' },
  { id: 'environmental', label: 'Environmental Protection' },
  { id: 'healthcare', label: 'Healthcare & Public Health' },
  { id: 'militia', label: 'Militia & Security' },
  { id: 'class_inequality', label: 'Class & Social Inequality' },
];
