/**
 * The 17 Shubat 2011 memorial: the historical record as it stands in the
 * sources, kept in the code so it cannot be silently changed.
 *
 * Rules for this file:
 * - Nothing here is invented. Every statement names its source.
 * - The timeline follows TEVDA Press's day-by-day chronicle. Its text is
 *   summarised here in our own words (English and Kurdish); the original is
 *   linked. Accusations are attributed as the source makes them.
 * - Where sources disagree (names, ages, dates), every version is kept with
 *   its source and the disagreement is flagged; nothing is reconciled.
 * - The date someone was shot or injured is kept apart from the date they died.
 * - Administrators add corrections, evidence, photographs and further
 *   entries from the website (Administration → 17 Shubat 2011 Memorial).
 *   Those are recorded alongside this record, never in place of it.
 */

export interface Bi { en: string; ckb: string }

export type SourceId = 'tevda' | 'amnesty-2011' | 'rudaw-2021' | 'placards' | 'org-list' | 'poster';

export interface MemorialSource {
  id: SourceId | string;
  title: Bi;
  publisher: string;
  /** Publication date as given (YYYY-MM-DD), when known. */
  date?: string;
  url?: string;
  language: 'ckb' | 'en';
  note?: Bi;
  /** The source exists but has not been identified or added in full yet. */
  pending?: boolean;
}

/** One version of a fact, from one source. */
export interface Claim { value: Bi; source: SourceId | string }

export interface MemorialPerson {
  id: string;
  /** English transliteration. */
  nameEn: string;
  /** Kurdish spelling as written in the source. */
  nameKu?: Claim;
  /** Every spelling found in the sources. */
  variants: { name: string; source: SourceId | string }[];
  /** Ages as reported, one per source. */
  ages: Claim[];
  /** When and where they were shot or injured, if documented. */
  incident?: { date?: string; place?: Bi; source: SourceId | string };
  /** When and where they died, if documented. */
  death?: { date?: string; place?: Bi; source: SourceId | string };
  circumstances?: Claim[];
  /** Place the source associates them with. */
  place?: Claim;
  /** What still needs checking. */
  flags: Bi[];
  /** documented: named in a published account; listed: only in the organisation's list so far. */
  status: 'documented' | 'listed';
  photo?: { mediaId: string };
}

export interface MemorialEvent {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  time?: Bi;
  place: Bi;
  title: Bi;
  summary: Bi;
  /** Ids of people in the memorial, or names of others named in the source. */
  people?: string[];
  figures?: Bi;
  sources: (SourceId | string)[];
  flags?: Bi[];
  /** Shown in the slideshow of the days. */
  key?: boolean;
}

export const MEMORIAL_TITLE: Bi = {
  en: '17 Shubat 2011 — The Days of the Bloody Streets',
  ckb: '17ی شوباتی 2011 — ڕۆژانی شەقامە خوێناوییەکان',
};

export const MEMORIAL_SUBTITLE: Bi = {
  en: 'Remembering the Demonstrations, Preserving the Truth, Honouring the Martyrs.',
  ckb: 'یادکردنەوەی خۆپیشاندانەکان، پاراستنی ڕاستی، ڕێزگرتن لە شەهیدان.',
};

export const MARTYRS_TITLE: Bi = {
  en: 'The Martyrs of 17 Shubat and the Days That Followed',
  ckb: 'شەهیدانی 17ی شوبات و ڕۆژانی دواتر',
};

export const DEDICATION: Bi = {
  en: 'Remembered for Their Sacrifice. Preserved in History. Never Forgotten.',
  ckb: 'بە قوربانییەکەیان یاد دەکرێنەوە. لە مێژوودا دەپارێزرێن. هەرگیز لەبیر ناکرێن.',
};

export const MEMORIAL_INTRO: Bi = {
  en: 'On 17 February 2011, people gathered in Sara Square in Sulaimani to demand reform, freedom of expression and an end to corruption. Shots were fired at them that afternoon. For about two months, demonstrations, sit-ins, strikes and Friday prayers continued in Sulaimani and in towns across the Kurdistan Region, from Kalar and Chamchamal to Halabja, Ranya and Koya. Protesters were killed, hundreds were injured and many were arrested, until security forces cleared the square on 19 April 2011. This memorial keeps their names and the record of those days.',
  ckb: 'لە 17ی شوباتی 2011، خەڵک لە گۆڕەپانی سەرای سلێمانی کۆبوونەوە بۆ داواکردنی چاکسازی، ئازادیی ڕادەربڕین و کۆتاییهێنان بە گەندەڵی. هەمان ئێوارە تەقەیان لێکرا. نزیکەی دوو مانگ، خۆپیشاندان، مانگرتن، ڕاگرتنی کار و نوێژی هەینی لە سلێمانی و شارۆچکەکانی سەرانسەری هەرێمی کوردستان بەردەوام بوون، لە کەلار و چەمچەماڵەوە تا هەڵەبجە، ڕانیە و کۆیە. خۆپیشاندەران کوژران، سەدان کەس بریندار بوون و زۆر کەس دەستگیر کران، تا هێزە ئەمنییەکان لە 19ی نیسانی 2011 گۆڕەپانەکەیان چۆڵ کرد. ئەم یادگارە ناوەکانیان و تۆماری ئەو ڕۆژانە دەپارێزێت.',
};

export const MEMORIAL_INTRO_SOURCES: SourceId[] = ['tevda', 'amnesty-2011', 'rudaw-2021'];

/** What the sources say about totals, kept apart because they differ. */
export const TOTALS: Claim[] = [
  {
    value: {
      en: 'Eight people killed and more than a hundred injured in the 2011 protests.',
      ckb: 'هەشت کەس کوژران و زیاتر لە سەد کەس بریندار بوون لە خۆپیشاندانەکانی 2011دا.',
    },
    source: 'rudaw-2021',
  },
  {
    value: {
      en: 'The day-by-day account names nine people killed between 17 February and 18 April 2011, and reports an unnamed policeman killed in Halabja on 23 February.',
      ckb: 'گێڕانەوە ڕۆژ بە ڕۆژەکە ناوی نۆ کەس دەهێنێت کە لە نێوان 17ی شوبات و 18ی نیسانی 2011دا کوژران، و باسی پۆلیسێکی بێناو دەکات کە لە 23ی شوبات لە هەڵەبجە کوژرا.',
    },
    source: 'tevda',
  },
];

export const SOURCES: MemorialSource[] = [
  {
    id: 'tevda',
    title: {
      en: 'A day-by-day chronicle of the bloody streets of 17 February 2011',
      ckb: 'ڕۆژ ژمێری شەقامە خوێناوییەکانی 17ی شوباتی 2011',
    },
    publisher: 'TEVDA Press',
    date: '2023-02-16',
    url: 'https://www.tevdapress.com/?mod=news&id=1865',
    language: 'ckb',
    note: {
      en: 'The primary source for this memorial: a Kurdish-language, day-by-day account from 14 February to 20 April 2011. The timeline here summarises it in our own words, in Kurdish and English; read the full original on TEVDA Press. Where it accuses a party or force, the accusation is the source’s.',
      ckb: 'سەرچاوەی سەرەکیی ئەم یادگارە: گێڕانەوەیەکی ڕۆژ بە ڕۆژی کوردی لە 14ی شوباتەوە تا 20ی نیسانی 2011. ڕیزبەندیی ڕووداوەکان لێرەدا بە وشەی خۆمان، بە کوردی و ئینگلیزی، کورتی دەکاتەوە؛ دەقە ڕەسەنە تەواوەکە لە TEVDA Press بخوێنەرەوە. لەو شوێنانەی تۆمەت دەخاتە پاڵ لایەن یان هێزێک، تۆمەتەکە هی سەرچاوەکەیە.',
    },
  },
  {
    id: 'amnesty-2011',
    title: { en: 'Days of Rage: Protests and Repression in Iraq', ckb: 'ڕۆژانی تووڕەیی: خۆپیشاندان و سەرکوت لە عێراق' },
    publisher: 'Amnesty International (AI Index: MDE 14/020/2011)',
    date: '2011-04-12',
    url: 'https://amnesty.org/en/wp-content/uploads/2021/07/mde140202011en.pdf',
    language: 'en',
  },
  {
    id: 'rudaw-2021',
    title: { en: 'Sulaimani’s 2011 protests, ten years on', ckb: 'خۆپیشاندانەکانی 2011ی سلێمانی، دە ساڵ دواتر' },
    publisher: 'Rudaw (Dilan Sirwan)',
    date: '2021-02-20',
    url: 'https://www.rudaw.net/english/kurdistan/18022021',
    language: 'en',
  },
  {
    id: 'org-list',
    title: { en: 'List of martyrs with ages, supplied by the organisation', ckb: 'لیستی شەهیدان لەگەڵ تەمەنەکانیان، لەلایەن ڕێکخراوەکەوە' },
    publisher: '17 Shubat Organisation (list of martyrs)',
    language: 'en',
    pending: true,
    note: {
      en: 'The ages in this list, and the name Sarkar Hama Saeed, do not appear in the TEVDA Press account. The original source of the list is to be confirmed.',
      ckb: 'تەمەنەکانی ئەم لیستە و ناوی سەرکار حەمە سەعید لە گێڕانەوەکەی TEVDA Pressدا نین. سەرچاوەی ڕەسەنی لیستەکە دەبێت پشتڕاست بکرێتەوە.',
    },
  },
  {
    id: 'placards',
    title: { en: 'Memorial placards, 17 Shubat anniversary campaign', ckb: 'پلاکاردەکانی یادکردنەوە، کەمپینی ساڵیادی 17ی شوبات' },
    publisher: '“کەمپینی ساڵیادی 17ی شوبات” (anniversary campaign), Sulaimani',
    language: 'ckb',
    note: {
      en: 'Placards reading “17ی شوبات بەردەوامە” (17 Shubat continues), each naming one martyr.',
      ckb: 'پلاکاردەکانی «17ی شوبات بەردەوامە»، هەر یەکەیان ناوی شەهیدێکی لەسەرە.',
    },
  },
  {
    id: 'poster',
    title: { en: 'Memorial poster: “The Days of the Bloody Streets of 17 Shubat 2011”', ckb: 'پۆستەری یادکردنەوە: «ڕۆژژمێری شەقامە خوێناویەکانی 17ی شوباتی 2011»' },
    publisher: '17 Shubat Organisation',
    language: 'ckb',
    note: {
      en: 'A poster supplied by the organisation, showing seven of the martyrs with their names over a photograph of the crowd. The portraits on this page are taken from it.',
      ckb: 'پۆستەرێک کە ڕێکخراوەکە دابینی کردووە، وێنەی حەوت لە شەهیدەکان بە ناوەکانیانەوە لەسەر وێنەیەکی جەماوەرەکە پیشان دەدات. وێنەکانی ئەم پەڕەیە لەوێوە وەرگیراون.',
    },
  },
];

const age = (en: string, ckb: string, source: SourceId): Claim => ({ value: { en, ckb }, source });
const ku = (name: string, source: SourceId = 'tevda'): Claim => ({ value: { en: name, ckb: name }, source });
const SUL: Bi = { en: 'Sulaimani', ckb: 'سلێمانی' };
const ORG_AGE: Bi = { en: 'The age in the organisation’s list is not given in the TEVDA Press account.', ckb: 'تەمەنەکەی ناو لیستی ڕێکخراوەکە لە گێڕانەوەکەی TEVDA Pressدا نییە.' };

export const PEOPLE: MemorialPerson[] = [
  {
    id: 'rezhwan',
    nameEn: 'Rezhwan Ali',
    nameKu: ku('ڕێژوان عەلی'),
    variants: [
      { name: 'ڕێژوان عەلی', source: 'tevda' },
      { name: 'Rezhwan Haji Ali', source: 'org-list' },
      { name: 'ڕێژوان حاجی عەلی', source: 'poster' },
      { name: 'Rezhwan ‘Ali', source: 'amnesty-2011' },
      { name: 'Rezhwan Ali', source: 'rudaw-2021' },
    ],
    ages: [age('young man (no age given)', 'گەنج (تەمەن نەنووسراوە)', 'tevda'), age('14', '14', 'org-list'), age('15', '15', 'amnesty-2011'), age('17', '17', 'rudaw-2021')],
    incident: { date: '2011-02-17', place: { en: 'Sulaimani: the start of Salim Street, near the office of KDP Branch 4', ckb: 'سلێمانی: سەرەتای شەقامی سالم، نزیک بارەگای لقی 4ی پارتی' }, source: 'tevda' },
    death: { date: '2011-02-17', place: SUL, source: 'tevda' },
    circumstances: [
      { value: { en: 'Killed when, after a confrontation at the start of Salim Street, guards of KDP Branch 4 fired on protesters.', ckb: 'کوژرا کاتێک، دوای ڕووبەڕووبوونەوەیەک لە سەرەتای شەقامی سالم، پاسەوانانی لقی 4ی پارتی تەقەیان لە خۆپیشاندەران کرد.' }, source: 'tevda' },
      { value: { en: 'Shot in the head by security forces firing live ammunition; died instantly.', ckb: 'هێزە ئەمنییەکان بە فیشەکی ڕاستەقینە تەقەیان لێکرد و فیشەک بەر سەری کەوت؛ دەستبەجێ گیانی لەدەستدا.' }, source: 'amnesty-2011' },
      { value: { en: 'The first victim of the protests.', ckb: 'یەکەم قوربانیی خۆپیشاندانەکان.' }, source: 'rudaw-2021' },
    ],
    flags: [
      { en: 'Age differs between sources: 14, 15 and 17; the day-by-day account gives no age.', ckb: 'تەمەن لە نێوان سەرچاوەکاندا جیاوازە: 14، 15 و 17؛ گێڕانەوە ڕۆژ بە ڕۆژەکە تەمەن نانووسێت.' },
      { en: 'The organisation’s list gives the name as “Rezhwan Haji Ali”.', ckb: 'لیستی ڕێکخراوەکە ناوەکە بە «ڕێژوان حاجی عەلی» دەنووسێت.' },
    ],
    status: 'documented',
  },
  {
    id: 'sorkew',
    nameEn: 'Sorkew Zahid Mahmud',
    nameKu: ku('سورکێو زاهید مەحمود'),
    variants: [
      { name: 'سورکێو زاهید مەحمود', source: 'tevda' },
      { name: 'Sorkew Zaher', source: 'org-list' },
      { name: 'سۆرکێو زاهر', source: 'poster' },
      { name: 'Surkew Zahid', source: 'amnesty-2011' },
      { name: 'Surkew Zahid', source: 'rudaw-2021' },
    ],
    ages: [age('17', '17', 'org-list'), age('16', '16', 'amnesty-2011'), age('16', '16', 'rudaw-2021')],
    incident: { date: '2011-02-19', place: { en: 'Sulaimani, on the way from Sara Square towards the KDP headquarters', ckb: 'سلێمانی، لە ڕێگای گۆڕەپانی سەراوە بەرەو بارەگای پارتی' }, source: 'amnesty-2011' },
    death: { date: '2011-02-20', place: { en: 'Sulaimani: the Chwarbakh quarter', ckb: 'سلێمانی: گەڕەکی چوارباخ' }, source: 'tevda' },
    circumstances: [
      { value: { en: 'Killed in the Chwarbakh quarter on 20 February; described as the second martyr of the protests, and buried on 21 February.', ckb: 'لە 20ی شوبات لە گەڕەکی چوارباخ شەهید کرا؛ وەک دووەم شەهیدی خۆپیشاندانەکان باسکراوە، و لە 21ی شوبات بەخاک سپێردرا.' }, source: 'tevda' },
      { value: { en: 'Shot by security forces after the protest in Sara Square ended on 19 February; seriously injured, he died in hospital the next day.', ckb: 'دوای کۆتاییهاتنی خۆپیشاندانەکەی گۆڕەپانی سەرا لە 19ی شوبات، هێزە ئەمنییەکان تەقەیان لێکرد؛ بە سەختی بریندار بوو و ڕۆژی دواتر لە نەخۆشخانە گیانی لەدەستدا.' }, source: 'amnesty-2011' },
      { value: { en: 'Shot by security forces on a road leading off Sara Square; died in hospital. His father is named as Zahid Mahmood.', ckb: 'لەسەر ڕێگایەک کە لە گۆڕەپانی سەراوە دەردەچێت هێزە ئەمنییەکان تەقەیان لێکرد؛ لە نەخۆشخانە گیانی لەدەستدا. ناوی باوکی زاهید مەحموود هاتووە.' }, source: 'rudaw-2021' },
      { value: { en: 'In late May 2011, Dr Faiq Gulpi testified in court about the shooters on Khanaqa Street, where Sorkew and Sherzad were killed.', ckb: 'لە کۆتایی ئایاری 2011، د. فایەق گوڵپی لە دادگا شایەتیی دا دەربارەی تەقەکەرانی شەقامی خانەقا، کە سورکێو و شێرزادی لێ شەهید کران.' }, source: 'tevda' },
    ],
    flags: [
      { en: 'Date he was shot differs: 19 February (Amnesty International) or 20 February (TEVDA Press). Both give 20 February as the day he died.', ckb: 'بەرواری پێکانی جیاوازە: 19ی شوبات (لێبووردنی نێودەوڵەتی) یان 20ی شوبات (TEVDA Press). هەردووکیان 20ی شوبات وەک ڕۆژی گیانلەدەستدانی دەنووسن.' },
      { en: 'Place differs: the Chwarbakh quarter, Khanaqa Street, or a road leading off Sara Square.', ckb: 'شوێن جیاوازە: گەڕەکی چوارباخ، شەقامی خانەقا، یان ڕێگایەک کە لە گۆڕەپانی سەراوە دەردەچێت.' },
      { en: 'Age differs: 17 (organisation’s list) and 16 (Amnesty International, Rudaw). Spelling differs: Sorkew Zaher / Surkew Zahid.', ckb: 'تەمەن جیاوازە: 17 (لیستی ڕێکخراوەکە) و 16 (لێبووردنی نێودەوڵەتی، ڕووداو). ڕێنووس جیاوازە: Sorkew Zaher / Surkew Zahid.' },
    ],
    status: 'documented',
  },
  {
    id: 'sherzad',
    nameEn: 'Sherzad Taha',
    nameKu: ku('شێرزاد تەها'),
    variants: [
      { name: 'شێرزاد تەها', source: 'tevda' },
      { name: 'Sherzad Taha', source: 'org-list' },
      { name: 'Sherzad Taha', source: 'amnesty-2011' },
    ],
    ages: [age('29', '29', 'org-list'), age('28', '28', 'amnesty-2011')],
    incident: { date: '2011-02-20', place: SUL, source: 'tevda' },
    death: { date: '2011-02-21', place: SUL, source: 'tevda' },
    circumstances: [
      { value: { en: 'One of those injured in the protest of 20 February; he died on 21 February.', ckb: 'یەکێک بوو لە بریندارانی خۆپیشاندانی 20ی شوبات؛ لە 21ی شوبات گیانی لەدەستدا.' }, source: 'tevda' },
      { value: { en: 'Shot by security forces after the protest in Sara Square ended on 19 February; seriously injured, he died in hospital the next day.', ckb: 'دوای کۆتاییهاتنی خۆپیشاندانەکەی گۆڕەپانی سەرا لە 19ی شوبات، هێزە ئەمنییەکان تەقەیان لێکرد؛ بە سەختی بریندار بوو و ڕۆژی دواتر لە نەخۆشخانە گیانی لەدەستدا.' }, source: 'amnesty-2011' },
    ],
    flags: [
      { en: 'Dates differ: shot on 20 February and died on 21 February (TEVDA Press), or shot on 19 February and died on 20 February (Amnesty International).', ckb: 'بەروارەکان جیاوازن: لە 20ی شوبات پێکرا و لە 21ی شوبات گیانی لەدەستدا (TEVDA Press)، یان لە 19ی شوبات پێکرا و لە 20ی شوبات گیانی لەدەستدا (لێبووردنی نێودەوڵەتی).' },
      { en: 'Age differs: 29 (organisation’s list) and 28 (Amnesty International).', ckb: 'تەمەن جیاوازە: 29 (لیستی ڕێکخراوەکە) و 28 (لێبووردنی نێودەوڵەتی).' },
    ],
    status: 'documented',
  },
  {
    id: 'garmian',
    nameEn: 'Garmian Ahmed',
    nameKu: ku('گەرمیان ئەحمەد'),
    variants: [{ name: 'گەرمیان ئەحمەد', source: 'tevda' }, { name: 'Garmian Ahmed', source: 'org-list' }],
    ages: [age('12', '12', 'tevda'), age('11', '11', 'org-list')],
    incident: { date: '2011-02-25', place: { en: 'Chamchamal', ckb: 'چەمچەماڵ' }, source: 'tevda' },
    death: { date: '2011-02-25', place: { en: 'Chamchamal', ckb: 'چەمچەماڵ' }, source: 'tevda' },
    circumstances: [
      { value: { en: 'A 12-year-old boy, killed in Chamchamal when, according to the source, guards of KDP Branch 19 opened fire; five people were injured.', ckb: 'منداڵێکی تەمەن 12 ساڵ، لە چەمچەماڵ شەهید کرا کاتێک، بەپێی سەرچاوەکە، پاسەوانانی لقی 19ی پارتی تەقەیان کرد؛ پێنج کەس بریندار بوون.' }, source: 'tevda' },
      { value: { en: 'A square in Chamchamal bears his name, and on 7 April 2011 a statue of him was unveiled there.', ckb: 'گۆڕەپانێک لە چەمچەماڵ ناوی ئەوی لەسەرە، و لە 7ی نیسانی 2011 پەیکەرێکی لەوێ پەردەی لەسەر لابرا.' }, source: 'tevda' },
    ],
    flags: [{ en: 'Age differs: 12 (TEVDA Press) and 11 (organisation’s list).', ckb: 'تەمەن جیاوازە: 12 (TEVDA Press) و 11 (لیستی ڕێکخراوەکە).' }],
    status: 'documented',
  },
  {
    id: 'bilal',
    nameEn: 'Bilal Ahmed',
    nameKu: ku('بیلال ئەحمەد'),
    variants: [{ name: 'بیلال ئەحمەد', source: 'tevda' }, { name: 'Bilal Ahmed', source: 'org-list' }],
    ages: [age('young man (no age given)', 'گەنج (تەمەن نەنووسراوە)', 'tevda'), age('15', '15', 'org-list')],
    incident: { date: '2011-02-25', place: { en: 'Kalar', ckb: 'کەلار' }, source: 'tevda' },
    death: { date: '2011-02-25', place: { en: 'Kalar', ckb: 'کەلار' }, source: 'tevda' },
    circumstances: [
      { value: { en: 'Killed in Kalar when, according to the source, guards of a KDP branch fired on protesters; more than ten people were injured.', ckb: 'لە کەلار شەهید کرا کاتێک، بەپێی سەرچاوەکە، پاسەوانانی لقێکی پارتی تەقەیان لە خۆپیشاندەران کرد؛ زیاتر لە دە کەس بریندار بوون.' }, source: 'tevda' },
    ],
    flags: [ORG_AGE],
    status: 'documented',
  },
  {
    id: 'rashid',
    nameEn: 'Rashid Ahmed Lalo',
    nameKu: ku('ڕەشید ئەحمەد لالۆ'),
    variants: [{ name: 'ڕەشید ئەحمەد لالۆ', source: 'tevda' }, { name: 'Rashid Ahmed Lalo', source: 'org-list' }],
    ages: [age('50', '50', 'tevda'), age('over 50', 'زیاتر لە 50', 'org-list')],
    incident: { date: '2011-02-25', place: { en: 'Kalar', ckb: 'کەلار' }, source: 'tevda' },
    death: { date: '2011-02-27', source: 'tevda' },
    circumstances: [
      { value: { en: 'Injured in the Kalar protest of 25 February; he died of his injuries on 27 February.', ckb: 'لە خۆپیشاندانەکەی 25ی شوباتی کەلار بریندار بوو؛ لە 27ی شوبات بەهۆی برینەکانییەوە گیانی لەدەستدا.' }, source: 'tevda' },
    ],
    flags: [{ en: 'Age: 50 (TEVDA Press) or over 50 (organisation’s list).', ckb: 'تەمەن: 50 (TEVDA Press) یان زیاتر لە 50 (لیستی ڕێکخراوەکە).' }],
    status: 'documented',
  },
  {
    id: 'omed',
    nameEn: 'Omed Jalal',
    nameKu: ku('ئومێد جەلال'),
    variants: [{ name: 'ئومێد جەلال', source: 'tevda' }, { name: 'Omed Jalal', source: 'org-list' }, { name: 'ئۆمێد جەلال', source: 'poster' }],
    ages: [age('young man (no age given)', 'گەنج (تەمەن نەنووسراوە)', 'tevda'), age('27', '27', 'org-list')],
    incident: { date: '2011-02-26', place: { en: 'Sulaimani: near the Grand Mosque', ckb: 'سلێمانی: نزیک مزگەوتی گەورە' }, source: 'tevda' },
    death: { date: '2011-02-26', place: SUL, source: 'tevda' },
    circumstances: [
      { value: { en: 'Killed near the Grand Mosque in Sulaimani during clashes between protesters and security forces; eleven people were injured.', ckb: 'لە نزیک مزگەوتی گەورەی سلێمانی لە کاتی پێکدادانی نێوان خۆپیشاندەران و هێزە ئەمنییەکاندا شەهید کرا؛ یازدە کەس بریندار بوون.' }, source: 'tevda' },
    ],
    flags: [ORG_AGE],
    status: 'documented',
  },
  {
    id: 'herdi',
    nameEn: 'Herdi Farouq',
    nameKu: ku('هەردی فاروق'),
    variants: [{ name: 'هەردی فاروق', source: 'tevda' }, { name: 'Herdi Farouq', source: 'org-list' }, { name: 'هەردی فارۆق', source: 'poster' }],
    ages: [age('28', '28', 'org-list')],
    death: { date: '2011-04-18', place: SUL, source: 'tevda' },
    circumstances: [
      { value: { en: 'One of those injured in Sulaimani; he died after being hit in the head by a bullet. Recorded under 18 April 2011, when more than 102 people were injured.', ckb: 'یەکێک بوو لە بریندارانی سلێمانی؛ دوای ئەوەی گوللەیەک بەر سەری کەوت گیانی لەدەستدا. لە ژێر 18ی نیسانی 2011 تۆمار کراوە، کە زیاتر لە 102 کەس بریندار بوون.' }, source: 'tevda' },
    ],
    flags: [
      { en: 'The day he was shot is not stated; the source records his death under 18 April 2011.', ckb: 'ڕۆژی پێکانی نەنووسراوە؛ سەرچاوەکە مردنەکەی لە ژێر 18ی نیسانی 2011 تۆمار دەکات.' },
      ORG_AGE,
    ],
    status: 'documented',
  },
  {
    id: 'ali-rasul',
    nameEn: 'Ali Rasul',
    nameKu: ku('عەلی ڕەسول'),
    variants: [{ name: 'عەلی ڕەسول', source: 'tevda' }, { name: 'Ali Rasul', source: 'org-list' }],
    ages: [age('27', '27', 'org-list')],
    incident: { date: '2011-03-22', place: { en: 'Halabja', ckb: 'هەڵەبجە' }, source: 'tevda' },
    death: { date: '2011-03-22', place: { en: 'Halabja', ckb: 'هەڵەبجە' }, source: 'tevda' },
    circumstances: [
      { value: { en: 'A civil defence policeman, killed when an armed group attacked protesters in Halabja; five people were injured by bullets and ten by stones.', ckb: 'پۆلیسێکی بەرگریی شارستانی، کوژرا کاتێک گرووپێکی چەکدار هێرشیان کردە سەر خۆپیشاندەران لە هەڵەبجە؛ پێنج کەس بە گوللە و دە کەس بە بەرد بریندار بوون.' }, source: 'tevda' },
    ],
    flags: [ORG_AGE],
    status: 'documented',
  },
  {
    id: 'sarkar',
    nameEn: 'Sarkar Hama Saeed',
    variants: [{ name: 'Sarkar Hama Saeed', source: 'org-list' }],
    ages: [age('28', '28', 'org-list')],
    place: { value: { en: 'Halabja', ckb: 'هەڵەبجە' }, source: 'org-list' },
    flags: [
      { en: 'Named only in the organisation’s list so far; this name does not appear in the TEVDA Press account. Date, place, circumstances and the Kurdish spelling of the name are to be confirmed from a published source.', ckb: 'تا ئێستا تەنها لە لیستی ڕێکخراوەکەدا ناوی هاتووە؛ ئەم ناوە لە گێڕانەوەکەی TEVDA Pressدا نییە. بەروار، شوێن، بارودۆخ و ڕێنووسی کوردیی ناوەکە دەبێت لە سەرچاوەیەکی بڵاوکراوەوە پشتڕاست بکرێنەوە.' },
      { en: 'The TEVDA Press account reports that a policeman, whom it does not name, was killed in Halabja on 23 February 2011. No link between the two is assumed here.', ckb: 'گێڕانەوەکەی TEVDA Press باس لەوە دەکات کە پۆلیسێک، کە ناوی نانووسێت، لە 23ی شوباتی 2011 لە هەڵەبجە کوژرا. لێرەدا هیچ پەیوەندییەک لە نێوانیاندا دانانرێت.' },
    ],
    status: 'listed',
  },
];

const T = 'tevda' as const;
const e = (id: string, date: string, place: Bi, title: Bi, summary: Bi, o: Partial<MemorialEvent> = {}): MemorialEvent =>
  ({ id, date, place, title, summary, sources: [T], ...o });
const P = (en: string, ckb: string): Bi => ({ en, ckb });

export const EVENTS: MemorialEvent[] = [
  // ---------------- February ----------------
  e('02-14-call', '2011-02-14', SUL,
    P('The call to demonstrate', 'بانگەوازی خۆپیشاندان'),
    P('The Network for Defending the Rights and Freedoms of the People called for a peaceful demonstration on 17 February 2011, in support of the revolutions in Tunisia and Egypt and to press the leaders of the Kurdistan Region for reform.',
      'تۆڕی بەرگری لە ماف و ئازادییەکانی خەڵک بانگەوازی خۆپیشاندانێکی ئاشتییانەی کرد بۆ 17ی شوباتی 2011، بۆ پشتگیریی شۆڕشەکانی تونس و میسر و فشارخستنە سەر سەرکردەکانی هەرێمی کوردستان بۆ چاکسازی.'),
    { key: true }),
  e('02-17-sara', '2011-02-17', P('Sulaimani: Sara Square (in front of the Governorate), then Mawlawi Street and Salim Street', 'سلێمانی: گۆڕەپانی سەرا (بەردەم پارێزگا)، پاشان شەقامی مەولەوی و شەقامی سالم'),
    P('The demonstration in Sara Square; Rezhwan Ali is killed', 'خۆپیشاندانی گۆڕەپانی سەرا؛ ڕێژوان عەلی شەهید دەکرێت'),
    P('The demonstration began at about 2pm and was peaceful; the organisers then ended it. Some participants walked on to Mawlawi Street and then Salim Street. At the start of Salim Street, after a confrontation, guards of KDP Branch 4 fired on the protesters, according to the source. Rezhwan Ali was killed and more than 50 people were injured. Amnesty International reports that he was shot in the head with live ammunition.',
      'خۆپیشاندانەکە نزیکەی کاتژمێر 2ی پاشنیوەڕۆ دەستی پێکرد و ئاشتییانە بوو؛ پاشان ڕێکخەران کۆتاییان پێهێنا. هەندێک لە بەشداربووان بەرەو شەقامی مەولەوی و پاشان شەقامی سالم ڕۆیشتن. لە سەرەتای شەقامی سالم، دوای ڕووبەڕووبوونەوەیەک، بەپێی سەرچاوەکە پاسەوانانی لقی 4ی پارتی تەقەیان لە خۆپیشاندەران کرد. ڕێژوان عەلی شەهید کرا و زیاتر لە 50 کەس بریندار بوون. ڕێکخراوی لێبووردنی نێودەوڵەتی دەڵێت فیشەکی ڕاستەقینە بەر سەری کەوت.'),
    { time: P('From about 2pm', 'لە نزیکەی کاتژمێر 2ی پاشنیوەڕۆوە'), people: ['rezhwan'], figures: P('1 killed; more than 50 injured.', '1 شەهید؛ زیاتر لە 50 بریندار.'), sources: [T, 'amnesty-2011', 'rudaw-2021'], key: true }),
  e('02-17-night', '2011-02-17', P('Erbil, Soran and Duhok; Sulaimani', 'هەولێر، سۆران و دهۆک؛ سلێمانی'),
    P('Gorran offices burned; a curfew in Sulaimani', 'بارەگاکانی گۆڕان دەسووتێنرێن؛ قەدەغەی هاتوچۆ لە سلێمانی'),
    P('That night, offices of the Gorran (Change) Movement in Erbil, Soran and Duhok were burned. A curfew was imposed in Sulaimani from 7pm to 7am.',
      'هەمان شەو، بارەگاکانی بزووتنەوەی گۆڕان لە هەولێر، سۆران و دهۆک سووتێنران. لە سلێمانی لە کاتژمێر 7ی ئێوارەوە تا 7ی بەیانی قەدەغەی هاتوچۆ ڕاگەیەنرا.'),
    { time: P('Night', 'شەو') }),
  e('02-18', '2011-02-18', SUL,
    P('Forces deployed; the funeral of Rezhwan Ali', 'بڵاوبوونەوەی هێزەکان؛ پرسەی ڕێژوان عەلی'),
    P('Police and armed forces were deployed across Sulaimani. According to the source, thousands of KDP armed men were moved from Erbil towards Sulaimani. Large crowds gathered at Gorran’s headquarters to form a “human shield”. Rezhwan Ali was buried; his father said he would file a complaint against the officials of KDP Branch 4.',
      'پۆلیس و هێزی چەکدار لە سەرانسەری سلێمانی بڵاوکرانەوە. بەپێی سەرچاوەکە، هەزاران چەکداری پارتی لە هەولێرەوە بەرەو سلێمانی گوازرانەوە. کۆمەڵانی خەڵک لە بارەگای سەرەکیی گۆڕان کۆبوونەوە بۆ پێکهێنانی «قەڵغانی مرۆیی». ڕێژوان عەلی بەخاک سپێردرا؛ باوکی گوتی سکاڵا لە بەرپرسانی لقی 4ی پارتی تۆمار دەکات.'),
    { people: ['rezhwan'] }),
  e('02-19-square', '2011-02-19', P('Sulaimani: Sara Square, the bazaar and Sulaimani University', 'سلێمانی: گۆڕەپانی سەرا، بازاڕ و زانکۆی سلێمانی'),
    P('The square is named “Freedom Square”; 14 injured', 'گۆڕەپانەکە ناو دەنرێت «مەیدانی ئازادی»؛ 14 بریندار'),
    P('Sulaimani University students protested against the killing and the injuries. The demonstration in Sara Square resumed, demanding the withdrawal of the Zerevani forces from Sulaimani. The writer Farouq Rafiq and his wife joined, and the square was named “Freedom Square”. There was shooting and clashes near the bazaar and the square; 14 people were injured. Gorran called for the withdrawal of the forces, the release of detainees, punishment of those who fired and an independent inquiry. That night, Gorran’s office in Shaqlawa was burned.',
      'خوێندکارانی زانکۆی سلێمانی دژی کوشتن و برینداربوونەکان خۆپیشاندانیان کرد. خۆپیشاندانی گۆڕەپانی سەرا دەستی پێکردەوە و داوای کشانەوەی هێزەکانی زێرەڤانیی لە سلێمانی دەکرد. نووسەر فاروق ڕەفیق و هاوسەرەکەی بەشدار بوون، و گۆڕەپانەکە ناونرا «مەیدانی ئازادی». لە نزیک بازاڕ و گۆڕەپانەکە تەقە و پێکدادان ڕوویدا؛ 14 کەس بریندار بوون. گۆڕان داوای کشانەوەی هێزەکان، ئازادکردنی دەستگیرکراوان، سزادانی تەقەکەران و لێکۆڵینەوەیەکی سەربەخۆی کرد. هەمان شەو بارەگای گۆڕان لە شەقڵاوە سووتێنرا.'),
    { people: ['Farouq Rafiq'], figures: P('14 injured.', '14 بریندار.') }),
  e('02-19-shot', '2011-02-19', P('Sulaimani: from Sara Square towards the KDP headquarters', 'سلێمانی: لە گۆڕەپانی سەراوە بەرەو بارەگای پارتی'),
    P('Two protesters shot, as recorded by Amnesty International', 'پێکانی دوو خۆپیشاندەر، بەپێی تۆماری لێبووردنی نێودەوڵەتی'),
    P('Amnesty International reports that after the protest in Sara Square ended at around 4pm, protesters walked towards the KDP headquarters, and security forces shot Surkew Zahid and Sherzad Taha, who were both seriously injured.',
      'ڕێکخراوی لێبووردنی نێودەوڵەتی دەڵێت دوای ئەوەی خۆپیشاندانەکەی گۆڕەپانی سەرا نزیکەی کاتژمێر 4ی ئێوارە کۆتایی هات، خۆپیشاندەران بەرەو بارەگای پارتی ڕۆیشتن، و هێزە ئەمنییەکان تەقەیان لە سورکێو زاهید و شێرزاد تەها کرد، کە هەردووکیان بە سەختی بریندار بوون.'),
    { time: P('After about 4pm', 'دوای نزیکەی کاتژمێر 4ی ئێوارە'), people: ['sorkew', 'sherzad'], sources: ['amnesty-2011'],
      flags: [P('TEVDA Press records Sorkew Zahid as killed on 20 February and Sherzad Taha as injured on 20 February and dying on 21 February.', 'TEVDA Press شەهیدبوونی سورکێو زاهید لە 20ی شوبات و برینداربوونی شێرزاد تەها لە 20ی شوبات و گیانلەدەستدانی لە 21ی شوبات تۆمار دەکات.')] }),
  e('02-20-nrt', '2011-02-20', SUL,
    P('The NRT television station is attacked and burned', 'هێرشکردنە سەر کەناڵی NRT و سووتاندنی'),
    P('Early in the morning, more than 50 armed men attacked and burned the Sulaimani station of NRT, which had been broadcasting for only three days.',
      'بەیانی زوو، زیاتر لە 50 چەکدار هێرشیان کردە سەر کەناڵی NRT لە سلێمانی و سووتاندیان، کە تەنها سێ ڕۆژ بوو پەخشی دەکرد.'),
    { time: P('Early morning', 'بەیانی زوو'), key: true }),
  e('02-20-sorkew', '2011-02-20', P('Sulaimani: Salim Street and the Chwarbakh quarter', 'سلێمانی: شەقامی سالم و گەڕەکی چوارباخ'),
    P('Sorkew Zahid is killed; 47 injured', 'سورکێو زاهید شەهید دەکرێت؛ 47 بریندار'),
    P('The demonstration in the square resumed, and 47 people detained in the previous days were released. Shots were fired at protesters on Salim Street, and 47 people were injured. In the Chwarbakh quarter, the protester Sorkew Zahid was killed. More than 20 people were detained in front of the square. Protests also took place in Ranya, Kifri, Darbandikhan and Koya. The Metro Center recorded more than 25 violations against journalists in three days.',
      'خۆپیشاندانی گۆڕەپانەکە دەستی پێکردەوە، و 47 کەس کە لە ڕۆژانی پێشوودا دەستگیر کرابوون ئازاد کران. لە شەقامی سالم تەقە لە خۆپیشاندەران کرا و 47 کەس بریندار بوون. لە گەڕەکی چوارباخ، خۆپیشاندەر سورکێو زاهید شەهید کرا. زیاتر لە 20 کەس لە بەردەم گۆڕەپانەکە دەستگیر کران. لە ڕانیە، کفری، دەربەندیخان و کۆیەش خۆپیشاندان کرا. سەنتەری مێترۆ لە ماوەی سێ ڕۆژدا زیاتر لە 25 پێشێلکاری دژی ڕۆژنامەنووسان تۆمار کرد.'),
    { people: ['sorkew'], figures: P('1 killed; 47 injured; more than 20 detained; 47 earlier detainees released.', '1 شەهید؛ 47 بریندار؛ زیاتر لە 20 دەستگیرکراو؛ 47 دەستگیرکراوی پێشوو ئازاد کران.'), sources: [T, 'amnesty-2011', 'rudaw-2021'], key: true,
      flags: [P('Amnesty International records Surkew Zahid and Sherzad Taha as shot on 19 February and dying in hospital on 20 February. Rudaw describes protests resuming on 20 February after a pause.', 'ڕێکخراوی لێبووردنی نێودەوڵەتی تۆماری دەکات کە سورکێو زاهید و شێرزاد تەها لە 19ی شوبات پێکران و لە 20ی شوبات لە نەخۆشخانە گیانیان لەدەستدا. ڕووداو باس لە دەستپێکردنەوەی خۆپیشاندان لە 20ی شوبات دەکات دوای وەستانێک.')] }),
  e('02-21', '2011-02-21', P('Sulaimani, Kalar, Sayid Sadiq and Darbandikhan', 'سلێمانی، کەلار، سەیدسادق و دەربەندیخان'),
    P('Sherzad Taha dies; the hospital counts 124 injured', 'شێرزاد تەها گیان لەدەست دەدات؛ نەخۆشخانە 124 بریندار دەژمێرێت'),
    P('Sorkew Zahid Mahmud, described as the second martyr of the protests, was buried. Sherzad Taha, injured the day before, died. Sulaimani Emergency Hospital said it had treated 124 people injured by security forces in four days, and university lecturers demanded that the true number of casualties be made public. Protests began in Sayid Sadiq, Darbandikhan and Kalar, where five people were arrested. Zmnako Rizgar, injured on 17 February near the KDP Branch 4 office, was sent to Turkey because of the severity of his wound.',
      'سورکێو زاهید مەحمود، کە وەک دووەم شەهیدی خۆپیشاندانەکان باسکراوە، بەخاک سپێردرا. شێرزاد تەها، کە ڕۆژی پێشتر بریندار بوو، گیانی لەدەستدا. نەخۆشخانەی فریاکەوتنی سلێمانی گوتی لە ماوەی چوار ڕۆژدا چارەسەری 124 کەسی کردووە کە بە دەستی هێزە ئەمنییەکان بریندار بوون، و مامۆستایانی زانکۆ داوایان کرد ژمارەی ڕاستەقینەی قوربانیان ئاشکرا بکرێت. لە سەیدسادق، دەربەندیخان و کەلار خۆپیشاندان دەستی پێکرد، کە لە کەلار پێنج کەس دەستگیر کران. زمناکۆ ڕزگار، کە لە 17ی شوبات لە نزیک بارەگای لقی 4ی پارتی بریندار بوو، بەهۆی سەختیی برینەکەیەوە نێردرا بۆ تورکیا.'),
    { people: ['sorkew', 'sherzad', 'Zmnako Rizgar'], figures: P('124 injured treated by Sulaimani Emergency Hospital in four days; 5 arrested in Kalar.', '124 بریندار لە ماوەی چوار ڕۆژدا لە نەخۆشخانەی فریاکەوتنی سلێمانی چارەسەر کران؛ 5 دەستگیرکراو لە کەلار.'), key: true }),
  e('02-22', '2011-02-22', P('Halabja, Ranya, Sulaimani and Erbil', 'هەڵەبجە، ڕانیە، سلێمانی و هەولێر'),
    P('Protests spread to Halabja and Ranya', 'خۆپیشاندانەکان بۆ هەڵەبجە و ڕانیە بڵاو دەبنەوە'),
    P('Protests began in Halabja and Ranya and continued in Sulaimani. Several groups in Erbil issued statements supporting the protests.',
      'لە هەڵەبجە و ڕانیە خۆپیشاندان دەستی پێکرد و لە سلێمانی بەردەوام بوو. چەند گرووپێک لە هەولێر بەیاننامەیان بۆ پشتگیریی خۆپیشاندانەکان بڵاوکردەوە.')),
  e('02-23', '2011-02-23', P('Sulaimani, Halabja, Koya and Erbil', 'سلێمانی، هەڵەبجە، کۆیە و هەولێر'),
    P('Violence in Halabja; parliament passes the “17-point” resolution', 'توندوتیژی لە هەڵەبجە؛ پەرلەمان بڕیاری «17 خاڵی» دەردەکات'),
    P('Freedom Square issued its fourth statement of demands, and the Minister of Higher Education visited the students protesting at Sulaimani University. In Halabja the protests turned violent; a policeman was killed and several protesters were injured. Protests resumed in Koya. The Kurdistan Parliament held an extraordinary session and passed Resolution No. 1, known as the “17-point resolution”, and the government formed a committee to investigate the events since 17 February.',
      'مەیدانی ئازادی چوارەمین بەیاننامەی داواکارییەکانی بڵاوکردەوە، و وەزیری خوێندنی باڵا سەردانی خوێندکارە خۆپیشاندەرەکانی زانکۆی سلێمانی کرد. لە هەڵەبجە خۆپیشاندانەکان توندوتیژییان لێکەوتەوە؛ پۆلیسێک کوژرا و چەند خۆپیشاندەرێک بریندار بوون. لە کۆیە خۆپیشاندان دەستی پێکردەوە. پەرلەمانی کوردستان دانیشتنێکی نائاسایی کرد و بڕیاری ژمارە 1ی دەرکرد، کە بە «بڕیاری 17 خاڵی» ناسراوە، و حکومەت لیژنەیەکی بۆ لێکۆڵینەوە لە ڕووداوەکانی دوای 17ی شوبات پێکهێنا.'),
    { figures: P('1 policeman killed (not named in the source); several protesters injured.', '1 پۆلیس کوژرا (ناوی لە سەرچاوەکەدا نییە)؛ چەند خۆپیشاندەرێک بریندار بوون.') }),
  e('02-24', '2011-02-24', P('Erbil, Halabja and Chwarqurna', 'هەولێر، هەڵەبجە و چوارقوڕنە'),
    P('Erbil’s checkpoints close; arrests begin in Halabja', 'خاڵەکانی پشکنینی هەولێر دادەخرێن؛ دەستگیرکردن لە هەڵەبجە دەست پێدەکات'),
    P('Checkpoints stopped large numbers of people from entering Erbil. Salahaddin University students issued a statement supporting the protests; classes at the university were then suspended until 1 April and students from outside Erbil were sent home. Seventeen Erbil organisations and public figures called for universities and institutes to reopen. A campaign to arrest protesters and organisers began in Halabja, and protests reached Chwarqurna.',
      'خاڵەکانی پشکنین ڕێگەیان لە ژمارەیەکی زۆری خەڵک گرت کە بچنە ناو هەولێر. خوێندکارانی زانکۆی سەڵاحەددین بەیاننامەیەکیان بۆ پشتگیریی خۆپیشاندانەکان بڵاوکردەوە؛ پاشان وانەکانی زانکۆکە تا 1ی نیسان ڕاگیران و خوێندکارانی دەرەوەی هەولێر نێردرانەوە ماڵەوە. حەڤدە ڕێکخراو و کەسایەتیی هەولێر داوای دەستپێکردنەوەی زانکۆ و پەیمانگاکانیان کرد. لە هەڵەبجە هەڵمەتی دەستگیرکردنی خۆپیشاندەران و ڕێکخەران دەستی پێکرد، و خۆپیشاندانەکان گەیشتنە چوارقوڕنە.')),
  e('02-25-kalar', '2011-02-25', P('Kalar', 'کەلار'),
    P('Kalar: Bilal Ahmed is killed; Rashid Ahmed Lalo is wounded', 'کەلار: بیلال ئەحمەد شەهید دەکرێت؛ ڕەشید ئەحمەد لالۆ بریندار دەبێت'),
    P('On the Friday of protests across the Kurdistan Region, guards of a KDP branch in Kalar fired on protesters, according to the source. Bilal Ahmed was killed and more than ten people were injured, among them Rashid Ahmed Lalo, who died two days later.',
      'لە هەینیی خۆپیشاندانەکانی سەرانسەری هەرێمی کوردستان، بەپێی سەرچاوەکە پاسەوانانی لقێکی پارتی لە کەلار تەقەیان لە خۆپیشاندەران کرد. بیلال ئەحمەد شەهید کرا و زیاتر لە دە کەس بریندار بوون، لەوانە ڕەشید ئەحمەد لالۆ کە دوو ڕۆژ دواتر گیانی لەدەستدا.'),
    { people: ['bilal', 'rashid'], figures: P('1 killed; more than 10 injured.', '1 شەهید؛ زیاتر لە 10 بریندار.'), key: true }),
  e('02-25-chamchamal', '2011-02-25', P('Chamchamal', 'چەمچەماڵ'),
    P('Chamchamal: twelve-year-old Garmian Ahmed is killed', 'چەمچەماڵ: گەرمیان ئەحمەدی 12 ساڵان شەهید دەکرێت'),
    P('In Chamchamal, guards of KDP Branch 19 opened fire, according to the source. Garmian Ahmed, a 12-year-old boy, was killed and five people were injured.',
      'لە چەمچەماڵ، بەپێی سەرچاوەکە پاسەوانانی لقی 19ی پارتی تەقەیان کرد. گەرمیان ئەحمەد، منداڵێکی 12 ساڵان، شەهید کرا و پێنج کەس بریندار بوون.'),
    { people: ['garmian'], figures: P('1 killed; 5 injured.', '1 شەهید؛ 5 بریندار.'), key: true }),
  e('02-25-erbil', '2011-02-25', P('Erbil and Sulaimani', 'هەولێر و سلێمانی'),
    P('Friday of protest: attacks and arrests in Erbil; the first Friday prayer in the square', 'هەینیی خۆپیشاندان: هێرش و دەستگیرکردن لە هەولێر؛ یەکەم نوێژی هەینی لە گۆڕەپانەکە'),
    P('Protests were held in most towns of the Kurdistan Region, and the first Friday prayer was held in Sulaimani’s Freedom Square. In Erbil, most shops and bazaars were closed by the security forces, and, according to the source, KDP security forces in plain clothes and uniform attacked people gathered near the Nishtiman bazaar; Dr Pshtiwan Abdullah was taken by security forces. Amnesty International records that an activist planning to join the Erbil demonstration was threatened at home by three armed men in plain clothes, and that Sharwan Azad Faqi ‘Abdallah, an NGO worker aged 35, was arrested in a park in Erbil, held for four days and ill-treated.',
      'لە زۆربەی شارۆچکەکانی هەرێمی کوردستان خۆپیشاندان کرا، و یەکەم نوێژی هەینی لە مەیدانی ئازادیی سلێمانی کرا. لە هەولێر، زۆربەی دوکان و بازاڕەکان لەلایەن هێزە ئەمنییەکانەوە داخران، و بەپێی سەرچاوەکە هێزە ئەمنییەکانی پارتی بە جلی مەدەنی و سەربازییەوە هێرشیان کردە سەر ئەو خەڵکەی لە نزیک بازاڕی نیشتمان کۆبووبوونەوە؛ د. پشتیوان عەبدوڵڵا لەلایەن هێزە ئەمنییەکانەوە بردرا. ڕێکخراوی لێبووردنی نێودەوڵەتی تۆماری کردووە کە چالاکوانێک کە بڕیاری بەشداریی خۆپیشاندانی هەولێری دابوو لە ماڵەکەی خۆی لەلایەن سێ چەکداری جلی مەدەنییەوە هەڕەشەی لێکرا، و شەروان ئازاد فەقێ عەبدوڵڵا، کارمەندێکی ڕێکخراوێکی ناحکومیی 35 ساڵان، لە پارکێکی هەولێر دەستگیر کرا، چوار ڕۆژ ڕاگیرا و ئازار درا.'),
    { people: ['Dr Pshtiwan Abdullah', 'Sharwan Azad Faqi ‘Abdallah'], sources: [T, 'amnesty-2011'] }),
  e('02-26', '2011-02-26', P('Sulaimani: near the Grand Mosque; Kalar', 'سلێمانی: نزیک مزگەوتی گەورە؛ کەلار'),
    P('Omed Jalal is killed near the Grand Mosque', 'ئومێد جەلال لە نزیک مزگەوتی گەورە شەهید دەکرێت'),
    P('Several of the organisers of the demonstration in the square were arrested. In the evening a sound bomb exploded near the square’s stage, and protesters clashed with the security forces. Near the Grand Mosque, the young protester Omed Jalal was killed and eleven people were injured. The Sulaimani Governorate Council declared its support for the protesters’ demands. In Kalar, protests resumed; large Peshmerga forces were sent and protesters were fired upon.',
      'چەند کەسێک لە ڕێکخەرانی خۆپیشاندانی گۆڕەپانەکە دەستگیر کران. ئێوارە بۆمبێکی دەنگی لە نزیک سەکۆی گۆڕەپانەکە تەقییەوە، و خۆپیشاندەران و هێزە ئەمنییەکان پێکدادانیان کرد. لە نزیک مزگەوتی گەورە، خۆپیشاندەری گەنج ئومێد جەلال شەهید کرا و یازدە کەس بریندار بوون. ئەنجومەنی پارێزگای سلێمانی پشتگیریی خۆی بۆ داواکارییەکانی خۆپیشاندەران ڕاگەیاند. لە کەلار خۆپیشاندان دەستی پێکردەوە؛ هێزێکی زۆری پێشمەرگە نێردران و تەقە لە خۆپیشاندەران کرا.'),
    { time: P('Evening', 'ئێوارە'), people: ['omed'], figures: P('1 killed; 11 injured.', '1 شەهید؛ 11 بریندار.'), key: true }),
  e('02-27', '2011-02-27', P('Sulaimani and Kalar', 'سلێمانی و کەلار'),
    P('Rashid Ahmed Lalo dies of his wounds', 'ڕەشید ئەحمەد لالۆ بەهۆی برینەکانییەوە گیان لەدەست دەدات'),
    P('Rashid Ahmed Lalo, aged 50, wounded in Kalar on 25 February, died. Freedom Square’s temporary council declared mourning and a strike; the strike at Sulaimani University continued and students of the Computer Institute joined. Mullah Kamaran was arrested by the Asayish after giving a sermon in the square.',
      'ڕەشید ئەحمەد لالۆ، تەمەن 50 ساڵ، کە لە 25ی شوبات لە کەلار بریندار بوو، گیانی لەدەستدا. ئەنجومەنی کاتیی مەیدانی ئازادی پرسە و مانگرتنی ڕاگەیاند؛ مانگرتنی زانکۆی سلێمانی بەردەوام بوو و خوێندکارانی پەیمانگای کۆمپیوتەر بەشدار بوون. مەلا کامەران دوای وتاردان لە گۆڕەپانەکە لەلایەن ئاسایشەوە دەستگیر کرا.'),
    { people: ['rashid', 'Mullah Kamaran'], key: true }),
  e('02-28', '2011-02-28', SUL,
    P('Demands handed to a parliamentary committee', 'داواکارییەکان دەدرێنە لیژنەیەکی پەرلەمان'),
    P('Protests continued in Sulaimani and most other districts. A parliamentary committee visited Freedom Square and received the protesters’ demands. Dr Pshtiwan Abdullah was released; the source says this followed pressure from the Australian government.',
      'خۆپیشاندانەکان لە سلێمانی و زۆربەی ناوچەکانی تر بەردەوام بوون. لیژنەیەکی پەرلەمان سەردانی مەیدانی ئازادیی کرد و داواکارییەکانی خۆپیشاندەرانی وەرگرت. د. پشتیوان عەبدوڵڵا ئازاد کرا؛ سەرچاوەکە دەڵێت ئەمە دوای فشاری حکومەتی ئوسترالیا بوو.'),
    { people: ['Dr Pshtiwan Abdullah'] }),

  // ---------------- March ----------------
  e('03-01', '2011-03-01', P('Sulaimani and Koya', 'سلێمانی و کۆیە'),
    P('Freedom Square demands the release of all detainees', 'مەیدانی ئازادی داوای ئازادکردنی هەموو دەستگیرکراوان دەکات'),
    P('The Freedom Square council demanded the release of everyone detained since 17 February. The Koya administration refused a request for a daily one-hour protest. The Kurdistan Regional Government issued a statement in reply to the protesters; the council said it did not answer their demands.',
      'ئەنجومەنی مەیدانی ئازادی داوای ئازادکردنی هەموو ئەو کەسانەی کرد کە لە 17ی شوباتەوە دەستگیر کرابوون. ئیدارەی کۆیە داوای خۆپیشاندانێکی ڕۆژانەی یەک کاتژمێرییان ڕەتکردەوە. حکومەتی هەرێمی کوردستان بەیاننامەیەکی لە وەڵامی خۆپیشاندەراندا بڵاوکردەوە؛ ئەنجومەنەکە گوتی وەڵامی داواکارییەکانیانی نەداوەتەوە.')),
  e('03-02', '2011-03-02', P('Erbil: the Kurdistan Parliament', 'هەولێر: پەرلەمانی کوردستان'),
    P('The opposition boycotts parliament', 'ئۆپۆزسیۆن پەرلەمان بایکۆت دەکات'),
    P('Gorran, the Kurdistan Islamic Group (Komal) and the Kurdistan Islamic Union (Yekgirtu) boycotted a session of parliament and sent a 22-point proposal to the leaders of the Region. Gorran repeated its call to dissolve the government and form an interim one.',
      'گۆڕان، کۆمەڵی ئیسلامی و یەکگرتووی ئیسلامی دانیشتنێکی پەرلەمانیان بایکۆت کرد و پڕۆژەیەکی 22 خاڵییان بۆ سەرکردەکانی هەرێم نارد. گۆڕان داوای هەڵوەشاندنەوەی حکومەت و پێکهێنانی حکومەتێکی کاتیی دووپات کردەوە.')),
  e('03-03', '2011-03-03', P('Kalar and Ranya', 'کەلار و ڕانیە'),
    P('Twenty protesters arrested in Kalar', 'بیست خۆپیشاندەر لە کەلار دەستگیر دەکرێن'),
    P('Security forces in Kalar arrested 20 protesters and blocked a gathering. Protests resumed in Ranya.',
      'هێزە ئەمنییەکان لە کەلار 20 خۆپیشاندەریان دەستگیر کرد و ڕێگەیان لە کۆبوونەوەیەک گرت. لە ڕانیە خۆپیشاندان دەستی پێکردەوە.'),
    { figures: P('20 arrested.', '20 دەستگیرکراو.') }),
  e('03-04', '2011-03-04', P('Sulaimani, Ranya, Qaladze, Hajiawa and Penjwin', 'سلێمانی، ڕانیە، قەڵادزێ، حاجیاوا و پێنجوێن'),
    P('The second Friday prayer in Freedom Square', 'دووەم نوێژی هەینی لە مەیدانی ئازادی'),
    P('The second Friday prayer was held in Freedom Square, on the sixteenth day of the sit-in. Protests were held in Ranya, Qaladze, Hajiawa and Penjwin.',
      'دووەم نوێژی هەینی لە مەیدانی ئازادی کرا، لە شازدەهەمین ڕۆژی مانگرتنەکەدا. لە ڕانیە، قەڵادزێ، حاجیاوا و پێنجوێن خۆپیشاندان کرا.')),
  e('03-05', '2011-03-05', P('Sulaimani, Kalar and many towns', 'سلێمانی، کەلار و چەندین شارۆچکە'),
    P('A day of strike; the tents in the square are burned', 'ڕۆژی مانگرتن؛ خێوەتەکانی گۆڕەپانەکە دەسووتێنرێن'),
    P('The Freedom Square council declared a general strike. A tent was set up in the square for an overnight sit-in, and protests took place in Piramagrun, Penjwin, Sayid Sadiq, Ranya, Darbandikhan, Garmian, Koya and most other districts. Armed men attacked the sit-in and burned the tents. Late at night, armed men in military uniform attacked Dengi radio in Kalar and destroyed its equipment.',
      'ئەنجومەنی مەیدانی ئازادی مانگرتنی گشتیی ڕاگەیاند. خێوەتێک لە گۆڕەپانەکە هەڵدرا بۆ مانگرتنی شەوانە، و لە پیرەمەگروون، پێنجوێن، سەیدسادق، ڕانیە، دەربەندیخان، گەرمیان، کۆیە و زۆربەی ناوچەکانی تر خۆپیشاندان کرا. چەکداران هێرشیان کردە سەر مانگرتنەکە و خێوەتەکانیان سووتاند. درەنگانی شەو، چەکدارانی جلی سەربازی هێرشیان کردە سەر ڕادیۆی دەنگ لە کەلار و کەرەستەکانیان تێکشکاند.'),
    { key: true }),
  e('03-06', '2011-03-06', P('Duhok, Bazyan and Sulaimani', 'دهۆک، بازیان و سلێمانی'),
    P('Journalists’ syndicate publishes the violations', 'سەندیکای ڕۆژنامەنووسان پێشێلکارییەکان بڵاو دەکاتەوە'),
    P('The Kurdistan Journalists’ Syndicate published its figures on violations and attacks against journalists since 17 February. A protest began in Duhok and was blocked by security forces. People in Bazyan held a peaceful protest on the anniversary of the 1991 uprising.',
      'سەندیکای ڕۆژنامەنووسانی کوردستان ژمارەکانی پێشێلکاری و هێرشەکانی دژی ڕۆژنامەنووسانی لە 17ی شوباتەوە بڵاوکردەوە. لە دهۆک خۆپیشاندانێک دەستی پێکرد و هێزە ئەمنییەکان ڕێگەیان لێگرت. خەڵکی بازیان لە ساڵیادی ڕاپەڕینی 1991دا خۆپیشاندانێکی ئاشتییانەیان کرد.')),
  e('03-07', '2011-03-07', P('Koya, Kifri and Kalar', 'کۆیە، کفری و کەلار'),
    P('Fourteen arrested in Koya; the US embassy condemns attacks on media', 'چواردە کەس لە کۆیە دەستگیر دەکرێن؛ باڵیۆزخانەی ئەمریکا هێرشەکان بۆ سەر میدیا ئیدانە دەکات'),
    P('Security forces tried to stop the protests in Kifri and Koya by force: 14 people were arrested in Koya and protesters were dispersed in Kifri. The United States embassy in Iraq condemned the burning of the Nalia channel (NRT) and Dengi radio.',
      'هێزە ئەمنییەکان هەوڵیاندا بە زۆر ڕێگە لە خۆپیشاندانەکانی کفری و کۆیە بگرن: لە کۆیە 14 کەس دەستگیر کران و لە کفری خۆپیشاندەران پەرشوبڵاو کران. باڵیۆزخانەی ئەمریکا لە عێراق سووتاندنی کەناڵی ناڵیا (NRT) و ڕادیۆی دەنگی ئیدانە کرد.'),
    { figures: P('14 arrested in Koya.', '14 دەستگیرکراو لە کۆیە.') }),
  e('03-08', '2011-03-08', P('Sulaimani and Erbil', 'سلێمانی و هەولێر'),
    P('Writers return to speak in the square', 'نووسەران دەگەڕێنەوە بۆ وتاردان لە گۆڕەپانەکە'),
    P('The writers Bakhtiyar Ali and Aras Fattah returned from abroad and spoke in Freedom Square, where an event was also held for 8 March. The Speaker of Parliament closed the parliament hall to opposition MPs who had refused to leave it.',
      'نووسەران بەختیار عەلی و ئاراس فەتاح لە دەرەوەی وڵاتەوە گەڕانەوە و لە مەیدانی ئازادی وتاریان خوێندەوە، کە ڕێوڕەسمێکیش بۆ 8ی ئادار لەوێ کرا. سەرۆکی پەرلەمان هۆڵی پەرلەمانی لە ڕووی پەرلەمانتارانی ئۆپۆزسیۆندا داخست کە ڕەتیان کردبووەوە هۆڵەکە جێبهێڵن.'),
    { people: ['Bakhtiyar Ali', 'Aras Fattah'] }),
  e('03-09', '2011-03-09', P('Kifri, Kalar, Sulaimani and Erbil', 'کفری، کەلار، سلێمانی و هەولێر'),
    P('Dengi radio attacked a second time', 'ڕادیۆی دەنگ بۆ دووەم جار هێرشی دەکرێتە سەر'),
    P('Security forces attacked a gathering in Kifri, and an armed group attacked Dengi radio in Kalar for the second time. Students and teachers of Sulaimani University went to Freedom Square, joined by the writers Bakhtiyar Ali, Rebin Hardi and Aras Fattah. Parliament summoned the head of the government for questioning.',
      'هێزە ئەمنییەکان هێرشیان کردە سەر کۆبوونەوەیەک لە کفری، و گرووپێکی چەکدار بۆ دووەم جار هێرشیان کردە سەر ڕادیۆی دەنگ لە کەلار. خوێندکاران و مامۆستایانی زانکۆی سلێمانی چوونە مەیدانی ئازادی، و نووسەران بەختیار عەلی، ڕێبین هەردی و ئاراس فەتاح بەشدار بوون. پەرلەمان سەرۆکی حکومەتی بۆ لێپرسینەوە بانگهێشت کرد.'),
    { people: ['Rebin Hardi'] }),
  e('03-10', '2011-03-10', SUL,
    P('A former MP gives up his pension', 'پەرلەمانتارێکی پێشوو دەستبەرداری مووچەی خانەنشینی دەبێت'),
    P('In Freedom Square, Dr Faiq Gulpi announced that he would give up his pension, in line with the protesters’ demand to abolish the pensions of MPs and ministers. A group of young people in Erbil called for a protest there on 11 March.',
      'لە مەیدانی ئازادی، د. فایەق گوڵپی ڕایگەیاند کە دەستبەرداری مووچەی خانەنشینییەکەی دەبێت، لەگەڵ داوای خۆپیشاندەران بۆ هەڵوەشاندنەوەی مووچەی خانەنشینیی پەرلەمانتاران و وەزیران. گرووپێک لە گەنجانی هەولێر بانگەوازی خۆپیشاندانیان کرد لەوێ بۆ 11ی ئادار.'),
    { people: ['Dr Faiq Gulpi'] }),
  e('03-11', '2011-03-11', P('Sulaimani and Chamchamal', 'سلێمانی و چەمچەماڵ'),
    P('Friday prayer of endurance; Chamchamal besieged', 'نوێژی هەینیی خۆڕاگری؛ گەمارۆدانی چەمچەماڵ'),
    P('A Friday prayer of “endurance and staying” was held in Freedom Square. A large armed force besieged the protest in Chamchamal.',
      'نوێژی هەینیی «خۆڕاگری و مانەوە» لە مەیدانی ئازادی کرا. هێزێکی چەکداری زۆر خۆپیشاندانەکەی چەمچەماڵیان گەمارۆ دا.')),
  e('03-13', '2011-03-13', P('Erbil and Sulaimani', 'هەولێر و سلێمانی'),
    P('Death threats against university teachers', 'هەڕەشەی کوشتن لە مامۆستایانی زانکۆ'),
    P('Three teachers at Salahaddin University received death threats. Many young people from Erbil, Piramagrun and Kalar joined the protest in Freedom Square. According to the source, security forces set up an ambush to arrest people visiting the home of Farouq Rafiq.',
      'سێ مامۆستای زانکۆی سەڵاحەددین هەڕەشەی کوشتنیان لێکرا. زۆرێک لە گەنجانی هەولێر، پیرەمەگروون و کەلار بەشداریی خۆپیشاندانی مەیدانی ئازادییان کرد. بەپێی سەرچاوەکە، هێزە ئەمنییەکان بۆسەیەکیان نایەوە بۆ دەستگیرکردنی ئەو کەسانەی سەردانی ماڵی فاروق ڕەفیقیان دەکرد.')),
  e('03-14', '2011-03-14', P('Sulaimani, Halabja and Kalar', 'سلێمانی، هەڵەبجە و کەلار'),
    P('Political prisoners join the square', 'زیندانیانی سیاسی بەشداری گۆڕەپانەکە دەکەن'),
    P('Many former political prisoners joined the protests in Freedom Square. Under threat, the planned mass protest in Halabja was postponed. A Garmian environmental police officer was honoured for stopping a party branch guard in Kalar from shooting at protesters on 25 February.',
      'زۆرێک لە زیندانیانی سیاسیی پێشوو بەشداریی خۆپیشاندانەکانی مەیدانی ئازادییان کرد. لە ژێر هەڕەشەدا، خۆپیشاندانە جەماوەرییە چاوەڕوانکراوەکەی هەڵەبجە دواخرا. پۆلیسێکی ژینگەی گەرمیان ڕێزی لێگیرا لەبەر ئەوەی لە 25ی شوبات ڕێگەی لە پاسەوانێکی لقی حزبێک لە کەلار گرتبوو تەقە لە خۆپیشاندەران بکات.')),
  e('03-15', '2011-03-15', P('Erbil, Khanaqin, Qaladze and Khurmal', 'هەولێر، خانەقین، قەڵادزێ و خورماڵ'),
    P('A Gorran office attacked; a bomb in Qaladze', 'هێرش بۆ سەر بارەگایەکی گۆڕان؛ بۆمبێک لە قەڵادزێ'),
    P('Checkpoints again stopped people entering Erbil. Gorran’s office in Khanaqin was attacked, and a bomb exploded near a Gorran activist in Qaladze. A protest began in Khurmal.',
      'خاڵەکانی پشکنین دیسان ڕێگەیان لە خەڵک گرت بچنە ناو هەولێر. بارەگای گۆڕان لە خانەقین هێرشی کرایە سەر، و بۆمبێک لە نزیک چالاکوانێکی گۆڕان لە قەڵادزێ تەقییەوە. لە خورماڵ خۆپیشاندان دەستی پێکرد.')),
  e('03-16', '2011-03-16', P('Erbil and Halabja', 'هەولێر و هەڵەبجە'),
    P('A hunger strike outside parliament; Halabja remembers quietly', 'مانگرتن لە خواردن لە بەردەم پەرلەمان؛ هەڵەبجە بە بێدەنگی یاد دەکاتەوە'),
    P('The activist Ali Mahmud began a hunger strike outside the Kurdistan Parliament; police arrested him and released him four hours later. A protest was held in Halabja on the anniversary of the chemical attack, which was marked quietly, unlike in previous years.',
      'چالاکوان عەلی مەحمود لە بەردەم پەرلەمانی کوردستان دەستی بە مانگرتن لە خواردن کرد؛ پۆلیس دەستگیری کرد و چوار کاتژمێر دواتر ئازادی کرد. لە هەڵەبجە لە ساڵیادی بۆمبارانی کیمیاییدا خۆپیشاندان کرا، کە بە پێچەوانەی ساڵانی پێشوو بە بێدەنگی یادی کرایەوە.'),
    { people: ['Ali Mahmud'] }),
  e('03-17', '2011-03-17', P('Sulaimani, Erbil, Halabja and Qaladze', 'سلێمانی، هەولێر، هەڵەبجە و قەڵادزێ'),
    P('One month since 17 February', 'یەک مانگ دوای 17ی شوبات'),
    P('The Freedom Square council issued a statement marking one month since 17 February. The first hearing was held in the trial of two people accused of burning the Nalia channel (NRT). Ayub Rasul ended a 23-day hunger strike in the square. Checkpoints stopped Gorran MP Dr Jafar Ali from entering Erbil.',
      'ئەنجومەنی مەیدانی ئازادی بەیاننامەیەکی بۆ یەک مانگ بەسەرچوون بەسەر 17ی شوباتدا بڵاوکردەوە. یەکەم دانیشتنی دادگاییکردنی دوو کەسی تۆمەتبار بە سووتاندنی کەناڵی ناڵیا (NRT) کرا. ئەیوب ڕەسوڵ دوای 23 ڕۆژ مانگرتنی لە خواردن لە گۆڕەپانەکەدا کۆتایی پێهێنا. خاڵەکانی پشکنین ڕێگەیان لە د. جەعفەر عەلی، پەرلەمانتاری گۆڕان، گرت بچێتە ناو هەولێر.'),
    { people: ['Ayub Rasul', 'Dr Jafar Ali'] }),
  e('03-18', '2011-03-18', P('Sulaimani, Koya and Erbil', 'سلێمانی، کۆیە و هەولێر'),
    P('Parliament approves the report on the protesters’ demands', 'پەرلەمان ڕاپۆرتی داواکارییەکانی خۆپیشاندەران پەسەند دەکات'),
    P('Jalal Talabani sent a letter to the protesters calling their demands legitimate. Parliament approved, by majority vote, the follow-up committee’s report on the protesters’ demands. Farouq Rafiq was summoned to court on a complaint by the Sulaimani security services.',
      'جەلال تاڵەبانی نامەیەکی بۆ خۆپیشاندەران نارد و داواکارییەکانی بە ڕەوا ناوبرد. پەرلەمان بە زۆرینەی دەنگ ڕاپۆرتی لیژنەی بەدواداچوونی داواکارییەکانی خۆپیشاندەرانی پەسەند کرد. فاروق ڕەفیق لەسەر سکاڵای ئاسایشی سلێمانی بانگهێشتی دادگا کرا.')),
  e('03-19', '2011-03-19', SUL,
    P('Fifty thousand signatures', 'پەنجا هەزار واژۆ'),
    P('The Freedom Square council said the authorities were trying to break it up. A signature campaign calling for the President of the Region to resign collected more than 50,000 signatures.',
      'ئەنجومەنی مەیدانی ئازادی گوتی دەسەڵاتداران هەوڵی پەرشوبڵاوکردنی دەدەن. هەڵمەتێکی واژۆ کۆکردنەوە کە داوای دەستلەکارکێشانەوەی سەرۆکی هەرێمی دەکرد زیاتر لە 50,000 واژۆی کۆکردەوە.')),
  e('03-20', '2011-03-20', P('Sulaimani, Chamchamal, Kalar, Ranya and Koya', 'سلێمانی، چەمچەماڵ، کەلار، ڕانیە و کۆیە'),
    P('Newroz fires in the squares of protest', 'ئاگری نەورۆز لە گۆڕەپانەکانی خۆپیشاندان'),
    P('Protesters lit Newroz fires in Freedom Square in Sulaimani, in Martyr Garmian Square in Chamchamal, at Qalai Shirwana in Kalar, in Freedom Garden in Ranya and in Freedom Square in Koya. Gorran leader Nawshirwan Mustafa came to Freedom Square in Sulaimani but could not leave his car because of the crowd. Rudaw reports that the “February 17 protesters’ council” was formed that day, with Ismail Abdullah as its spokesperson.',
      'خۆپیشاندەران ئاگری نەورۆزیان کردەوە لە مەیدانی ئازادیی سلێمانی، گۆڕەپانی شەهید گەرمیان لە چەمچەماڵ، قەڵای شیروانە لە کەلار، باخچەی ئازادی لە ڕانیە و مەیدانی ئازادیی کۆیە. نەوشیروان مستەفا، سەرکردەی گۆڕان، هاتە مەیدانی ئازادیی سلێمانی بەڵام بەهۆی قەرەباڵغییەوە نەیتوانی لە ئۆتۆمبێلەکەی دابەزێت. ڕووداو دەڵێت هەمان ڕۆژ «ئەنجومەنی خۆپیشاندەرانی 17ی شوبات» پێکهێنرا و ئیسماعیل عەبدوڵڵا بوو بە وتەبێژی.'),
    { people: ['Nawshirwan Mustafa', 'Ismail Abdullah'], sources: [T, 'rudaw-2021'], key: true }),
  e('03-21', '2011-03-21', SUL,
    P('Martyrs’ families honoured', 'ڕێزگرتن لە خێزانی شەهیدان'),
    P('The Freedom Square council presented a medal of respect to the father of the martyrs Sorkew Zahid and Garmian Ahmed.',
      'ئەنجومەنی مەیدانی ئازادی مەدالیای ڕێزی پێشکەش بە باوکی شەهیدان سورکێو زاهید و گەرمیان ئەحمەد کرد.'),
    { people: ['sorkew', 'garmian'], flags: [P('The source’s wording (“the father of the martyrs”) is to be checked: the two martyrs had different families.', 'دەربڕینی سەرچاوەکە («باوکی شەهیدان») دەبێت بپشکنرێت: دوو شەهیدەکە خێزانی جیاوازیان هەبوو.')] }),
  e('03-22', '2011-03-22', P('Halabja and Sulaimani', 'هەڵەبجە و سلێمانی'),
    P('Halabja: Ali Rasul is killed', 'هەڵەبجە: عەلی ڕەسول شەهید دەکرێت'),
    P('On the 34th day of the protest in Freedom Square, victims’ families took part. In Halabja, an armed group attacked protesters: the civil defence policeman Ali Rasul was killed, five people were injured by bullets and ten by stones. An arrest order was issued in Halabja for Dr Faiq Gulpi, who had visited the martyrs’ graves and spoken at a protest; he went to court and the matter was settled.',
      'لە 34هەمین ڕۆژی خۆپیشاندانی مەیدانی ئازادیدا، خێزانی قوربانیان بەشدار بوون. لە هەڵەبجە گرووپێکی چەکدار هێرشیان کردە سەر خۆپیشاندەران: پۆلیسی بەرگریی شارستانی عەلی ڕەسول کوژرا، پێنج کەس بە گوللە و دە کەس بە بەرد بریندار بوون. لە هەڵەبجە فەرمانی دەستگیرکردن بۆ د. فایەق گوڵپی دەرچوو، کە سەردانی گۆڕی شەهیدانی کردبوو و لە خۆپیشاندانێکدا وتاری دابوو؛ چووە دادگا و کێشەکە چارەسەر کرا.'),
    { people: ['ali-rasul', 'Dr Faiq Gulpi'], figures: P('1 killed; 5 injured by bullets; 10 injured by stones.', '1 کوژراو؛ 5 بریندار بە گوللە؛ 10 بریندار بە بەرد.'), key: true }),
  e('03-23', '2011-03-23', P('Halabja and Sulaimani', 'هەڵەبجە و سلێمانی'),
    P('Halabja protests again; more families honoured', 'هەڵەبجە دیسان خۆپیشاندان دەکات؛ ڕێزگرتن لە خێزانی زیاتر'),
    P('Protests resumed in Halabja, with several Gorran MPs taking part; the Freedom Square council held the authorities responsible for the violence there. In the square, medals of respect were given to the families of the martyrs Rezhwan Ali and Omed Jalal.',
      'لە هەڵەبجە خۆپیشاندان دەستی پێکردەوە و چەند پەرلەمانتارێکی گۆڕان بەشدار بوون؛ ئەنجومەنی مەیدانی ئازادی دەسەڵاتدارانی بە بەرپرسیار زانی لە توندوتیژییەکەی ئەوێ. لە گۆڕەپانەکە مەدالیای ڕێز درا بە خێزانی شەهیدان ڕێژوان عەلی و ئومێد جەلال.'),
    { people: ['rezhwan', 'omed'] }),
  e('03-25', '2011-03-25', SUL,
    P('More than 10,000 at Friday prayer', 'زیاتر لە 10,000 کەس لە نوێژی هەینی'),
    P('More than 10,000 people attended the Friday prayer in Freedom Square. Students, staff and teachers of Sulaimani University called on the authorities to prove their promises with action.',
      'زیاتر لە 10,000 کەس بەشداریی نوێژی هەینیی مەیدانی ئازادییان کرد. خوێندکاران، فەرمانبەران و مامۆستایانی زانکۆی سلێمانی داوایان لە دەسەڵاتداران کرد بە کردار بەڵێنەکانیان بسەلمێنن.')),
  e('03-26', '2011-03-26', P('Erbil', 'هەولێر'),
    P('Erbil under heavy guard', 'هەولێر لە ژێر پاسەوانیی قورسدا'),
    P('An undeclared state of emergency continued in Erbil, with a large armed force deployed in the city. Protests continued in Takiya, Halabja, Sulaimani and most districts.',
      'باری نائاسایی ڕانەگەیەنراو لە هەولێر بەردەوام بوو، و هێزێکی چەکداری زۆر لە شارەکەدا بڵاوکرابووەوە. خۆپیشاندانەکان لە تەکیە، هەڵەبجە، سلێمانی و زۆربەی ناوچەکان بەردەوام بوون.')),
  e('03-28', '2011-03-28', P('Sulaimani, Halabja, Koya and Chamchamal', 'سلێمانی، هەڵەبجە، کۆیە و چەمچەماڵ'),
    P('A day of mourning for the victims', 'ڕۆژی پرسە بۆ قوربانیان'),
    P('The gathering in Freedom Square was declared a day of mourning for the victims of the protests. The teacher Kamaran Ali was arrested by police and security forces after giving a speech. Protests were held in Warmawa, Halabja, Sangasar, Koya and Chamchamal.',
      'کۆبوونەوەی مەیدانی ئازادی وەک ڕۆژی پرسە بۆ قوربانیانی خۆپیشاندانەکان ڕاگەیەنرا. مامۆستا کامەران عەلی دوای وتاردان لەلایەن پۆلیس و ئاسایشەوە دەستگیر کرا. لە وەرماوە، هەڵەبجە، سەنگەسەر، کۆیە و چەمچەماڵ خۆپیشاندان کرا.'),
    { people: ['Kamaran Ali'] }),
  e('03-29', '2011-03-29', P('Erbil and Sulaimani', 'هەولێر و سلێمانی'),
    P('The council rejects the President’s decisions', 'ئەنجومەن بڕیارەکانی سەرۆکی هەرێم ڕەتدەکاتەوە'),
    P('The three opposition parties boycotted parliament. The temporary council of Freedom Square rejected decisions announced by the President of the Region, saying they sided with those who had fired on protesters.',
      'سێ لایەنی ئۆپۆزسیۆن پەرلەمانیان بایکۆت کرد. ئەنجومەنی کاتیی مەیدانی ئازادی ئەو بڕیارانەی ڕەتکردەوە کە سەرۆکی هەرێم ڕایگەیاندبوون، و گوتی لایەنگری ئەو کەسانەن کە تەقەیان لە خۆپیشاندەران کردبوو.')),
  e('03-31', '2011-03-31', P('Kalar, Sulaimani, Halabja and Qaladze', 'کەلار، سلێمانی، هەڵەبجە و قەڵادزێ'),
    P('Gorran MPs attacked; an MP injured', 'هێرش بۆ سەر پەرلەمانتارانی گۆڕان؛ پەرلەمانتارێک بریندار دەبێت'),
    P('A large armed force was sent to Kalar to stop the protests there. According to the source, armed members of the Patriotic Union of Kurdistan attacked several Gorran MPs, and MP Neriman Abdulla was injured. A group of American university students in Sulaimani joined the protesters in Freedom Square.',
      'هێزێکی چەکداری زۆر نێردرا بۆ کەلار بۆ وەستاندنی خۆپیشاندانەکانی ئەوێ. بەپێی سەرچاوەکە، چەکدارانی یەکێتیی نیشتمانیی کوردستان هێرشیان کردە سەر چەند پەرلەمانتارێکی گۆڕان، و پەرلەمانتار نەریمان عەبدوڵڵا بریندار بوو. گرووپێک لە خوێندکارانی زانکۆی ئەمریکی لە سلێمانی بەشداریی خۆپیشاندەرانی مەیدانی ئازادییان کرد.'),
    { people: ['Neriman Abdulla'] }),

  // ---------------- April ----------------
  e('04-01', '2011-04-01', P('Sulaimani, Koya, Ranya and Chamchamal', 'سلێمانی، کۆیە، ڕانیە و چەمچەماڵ'),
    P('Clashes in Sulaimani: more than 42 injured', 'پێکدادان لە سلێمانی: زیاتر لە 42 بریندار'),
    P('Friday prayers were held with protests in Koya and Ranya. In Sulaimani, clashes between protesters and security forces left more than 42 protesters and police injured, and a large security force was deployed near the square. The Sulaimani Asayish announced that Mullah Kamaran was being held under Article 2 of the anti-terrorism law. In Chamchamal, shots were fired at a protest organiser.',
      'لە کۆیە و ڕانیە نوێژی هەینی لەگەڵ خۆپیشاندان کرا. لە سلێمانی، پێکدادانی نێوان خۆپیشاندەران و هێزە ئەمنییەکان زیاتر لە 42 خۆپیشاندەر و پۆلیسی بریندار کرد، و هێزێکی ئەمنیی زۆر لە نزیک گۆڕەپانەکە بڵاوکرایەوە. ئاسایشی سلێمانی ڕایگەیاند کە مەلا کامەران بەپێی ماددەی 2ی یاسای دژە تیرۆر ڕاگیراوە. لە چەمچەماڵ تەقە لە ڕێکخەرێکی خۆپیشاندان کرا.'),
    { people: ['Mullah Kamaran'], figures: P('More than 42 protesters and police injured.', 'زیاتر لە 42 خۆپیشاندەر و پۆلیس بریندار بوون.'), key: true }),
  e('04-02', '2011-04-02', SUL,
    P('Clashes near the Grand Mosque', 'پێکدادان لە نزیک مزگەوتی گەورە'),
    P('Protests resumed in the square after the previous day’s violence, and continued across Sulaimani province, Garmian and Koya. There were clashes near the Grand Mosque in Sulaimani, where, according to the source, a large military force attacked protesters.',
      'دوای توندوتیژیی ڕۆژی پێشوو، خۆپیشاندان لە گۆڕەپانەکە دەستی پێکردەوە و لە سەرانسەری پارێزگای سلێمانی، گەرمیان و کۆیە بەردەوام بوو. لە نزیک مزگەوتی گەورەی سلێمانی پێکدادان ڕوویدا، کە بەپێی سەرچاوەکە هێزێکی سەربازیی زۆر هێرشی کردە سەر خۆپیشاندەران.')),
  e('04-03', '2011-04-03', P('Sulaimani, Ranya, Halabja, Kalar, Koya and Chamchamal', 'سلێمانی، ڕانیە، هەڵەبجە، کەلار، کۆیە و چەمچەماڵ'),
    P('One hundred violations against journalists', 'سەد پێشێلکاری دژی ڕۆژنامەنووسان'),
    P('The Metro Center reported 100 violations against journalists during the protests, most of them against independent and opposition media. Masked forces injured three protesting students; students of the Sulaimani Technical Institute went on strike over assaults on students in their dormitory. The Asayish detained Mullah Muhammad Nasrullah, who had taken part in the protest and the Friday prayer in the square.',
      'سەنتەری مێترۆ 100 پێشێلکاری دژی ڕۆژنامەنووسانی لە ماوەی خۆپیشاندانەکاندا ڕاگەیاند، کە زۆربەیان دژی میدیای سەربەخۆ و ئۆپۆزسیۆن بوون. هێزی دەمامکدار سێ خوێندکاری خۆپیشاندەریان بریندار کرد؛ خوێندکارانی پەیمانگای تەکنیکیی سلێمانی لەسەر هێرش بۆ سەر خوێندکاران لە بەشی ناوخۆیی مانیان گرت. ئاسایش مەلا محەمەد نەسروڵڵای دەستگیر کرد، کە بەشداریی خۆپیشاندان و نوێژی هەینیی گۆڕەپانەکەی کردبوو.'),
    { people: ['Mullah Muhammad Nasrullah'], figures: P('100 violations against journalists (Metro Center); 3 students injured.', '100 پێشێلکاری دژی ڕۆژنامەنووسان (سەنتەری مێترۆ)؛ 3 خوێندکار بریندار.') }),
  e('04-05', '2011-04-05', SUL,
    P('The square withdraws its confidence', 'گۆڕەپانەکە متمانەی خۆی دەکێشێتەوە'),
    P('Protesters in the square voted to withdraw their confidence from the Presidency of the Region, the Presidency of Parliament, the sixth cabinet and all its ministers. The Sulaimani Provincial Council declared, by majority vote, that the appointment of the governor was illegal. The opposition again boycotted parliament.',
      'خۆپیشاندەرانی گۆڕەپانەکە دەنگیان دا بۆ کێشانەوەی متمانە لە سەرۆکایەتیی هەرێم، سەرۆکایەتیی پەرلەمان، کابینەی شەشەم و هەموو وەزیرەکانی. ئەنجومەنی پارێزگای سلێمانی بە زۆرینەی دەنگ دانانی پارێزگاری بە نایاسایی ڕاگەیاند. ئۆپۆزسیۆن دیسان پەرلەمانی بایکۆت کرد.')),
  e('04-07', '2011-04-07', P('Chamchamal and other towns', 'چەمچەماڵ و شارۆچکەکانی تر'),
    P('A statue of Garmian Ahmed is unveiled', 'پەیکەری گەرمیان ئەحمەد پەردەی لەسەر لادەبرێت'),
    P('In Chamchamal, the statue of the martyr Garmian Ahmed was unveiled. Protests were held in Qaladze, Ranya, Halabja, Chamchamal and Penjwin.',
      'لە چەمچەماڵ پەردە لەسەر پەیکەری شەهید گەرمیان ئەحمەد لابرا. لە قەڵادزێ، ڕانیە، هەڵەبجە، چەمچەماڵ و پێنجوێن خۆپیشاندان کرا.'),
    { people: ['garmian'] }),
  e('04-10', '2011-04-10', P('Sulaimani and Erbil', 'سلێمانی و هەولێر'),
    P('A roadmap for the peaceful transfer of power', 'نەخشەڕێگایەک بۆ گواستنەوەی ئاشتییانەی دەسەڵات'),
    P('The government’s fact-finding committee asked the public for evidence. The Freedom Square council published a roadmap titled “the peaceful transfer of power in the Kurdistan Region”.',
      'لیژنەی دۆزینەوەی ڕاستییەکانی حکومەت داوای بەڵگەی لە خەڵک کرد. ئەنجومەنی مەیدانی ئازادی نەخشەڕێگایەکی بە ناونیشانی «گواستنەوەی ئاشتییانەی دەسەڵات لە هەرێمی کوردستان» بڵاوکردەوە.')),
  e('04-14', '2011-04-14', P('Sulaimani, Garmian, Rizgari, Koya and Halabja', 'سلێمانی، گەرمیان، ڕزگاری، کۆیە و هەڵەبجە'),
    P('Anfal remembered; mourners attacked', 'یادی ئەنفال؛ هێرش بۆ سەر پرسەگێڕان'),
    P('Thousands attended the Anfal commemoration in Freedom Square. According to the source, the Asayish attacked students of the University of Garmian during the commemorations, and in Rizgari attacked relatives of Anfal victims and detained several of them.',
      'هەزاران کەس بەشداریی یادی ئەنفالیان لە مەیدانی ئازادی کرد. بەپێی سەرچاوەکە، ئاسایش لە کاتی یادکردنەوەکاندا هێرشی کردە سەر خوێندکارانی زانکۆی گەرمیان، و لە ڕزگاری هێرشی کردە سەر کەسوکاری قوربانیانی ئەنفال و چەند کەسێکیانی دەستگیر کرد.')),
  e('04-17', '2011-04-17', SUL,
    P('Farouq Rafiq sentenced; more than 50 detained', 'فاروق ڕەفیق سزا دەدرێت؛ زیاتر لە 50 دەستگیرکراو'),
    P('The writer Farouq Rafiq was sentenced to one month in prison, and Nasik Qadir was released on bail. In clashes between protesters and security forces, police used tear gas and more than 50 people were detained.',
      'نووسەر فاروق ڕەفیق بە یەک مانگ زیندان سزا درا، و ناسک قادر بە کەفالەت ئازاد کرا. لە پێکدادانی نێوان خۆپیشاندەران و هێزە ئەمنییەکاندا، پۆلیس گازی فرمێسکڕێژی بەکارهێنا و زیاتر لە 50 کەس دەستگیر کران.'),
    { people: ['Farouq Rafiq', 'Nasik Qadir'], figures: P('More than 50 detained.', 'زیاتر لە 50 دەستگیرکراو.'), key: true }),
  e('04-18', '2011-04-18', P('Sulaimani and Kalar', 'سلێمانی و کەلار'),
    P('More than 102 injured; Herdi Farouq dies', 'زیاتر لە 102 بریندار؛ هەردی فاروق گیان لەدەست دەدات'),
    P('A student protest outside the Rashad Mufti Mosque was attacked by security forces and several students were detained. According to the source, intelligence forces attacked several Gorran MPs and threatened to kill them, and burned the speakers’ stage in Freedom Square. More than 102 people were injured in Sulaimani. Herdi Farouq, one of the injured, died after being hit in the head by a bullet. Masked forces detained many young men in Kalar.',
      'خۆپیشاندانێکی خوێندکاران لە بەردەم مزگەوتی ڕەشاد موفتی لەلایەن هێزە ئەمنییەکانەوە هێرشی کرایە سەر و چەند خوێندکارێک دەستگیر کران. بەپێی سەرچاوەکە، هێزەکانی هەواڵگری هێرشیان کردە سەر چەند پەرلەمانتارێکی گۆڕان و هەڕەشەی کوشتنیان لێکردن، و سەکۆی وتاردانی مەیدانی ئازادییان سووتاند. لە سلێمانی زیاتر لە 102 کەس بریندار بوون. هەردی فاروق، یەکێک لە برینداران، دوای ئەوەی گوللەیەک بەر سەری کەوت گیانی لەدەستدا. هێزی دەمامکدار لە کەلار زۆرێک لە گەنجانیان دەستگیر کرد.'),
    { people: ['herdi'], figures: P('1 killed; more than 102 injured.', '1 شەهید؛ زیاتر لە 102 بریندار.'), key: true }),
  e('04-19', '2011-04-19', P('Sulaimani, Koya, Ranya, Halabja and Khurmal', 'سلێمانی، کۆیە، ڕانیە، هەڵەبجە و خورماڵ'),
    P('The square is cleared; students, lawyers and journalists detained', 'گۆڕەپانەکە چۆڵ دەکرێت؛ خوێندکاران، پارێزەران و ڕۆژنامەنووسان دەستگیر دەکرێن'),
    P('A large military and security force was deployed in Sulaimani. Students and teachers marching to the Sulaimani court were surrounded and many were detained; more than 100 lawyers protested at the court. According to the source, armed men attacked the writer Rebin Hardi at the court and took him to an intelligence prison after mistreating him, and the journalists Sirwan Rashid and Hiwa Jamal were taken into intelligence detention after alleged torture. Armed forces entered the university campus and dormitories and detained students. In Koya, the Asayish took four university students to Erbil. Rudaw reports that in the evening security forces were deployed to Sara Square and the grand bazaar, burned the podium and banners and stopped people from returning, ending the daily protests.',
      'هێزێکی سەربازی و ئەمنیی زۆر لە سلێمانی بڵاوکرایەوە. ئەو خوێندکار و مامۆستایانەی بەرەو دادگای سلێمانی دەڕۆیشتن گەمارۆ دران و زۆریان دەستگیر کران؛ زیاتر لە 100 پارێزەر لە بەردەم دادگا خۆپیشاندانیان کرد. بەپێی سەرچاوەکە، چەکداران لە دادگا هێرشیان کردە سەر نووسەر ڕێبین هەردی و دوای ئازاردانی بردیانە زیندانی هەواڵگری، و ڕۆژنامەنووسان سیروان ڕەشید و هیوا جەمال دوای ئازاردانێکی ئاماژەپێکراو بران بۆ گرتنگەی هەواڵگری. هێزە چەکدارەکان چوونە ناو کەمپەسی زانکۆ و بەشە ناوخۆییەکان و خوێندکارانیان دەستگیر کرد. لە کۆیە ئاسایش چوار خوێندکاری زانکۆی برد بۆ هەولێر. ڕووداو دەڵێت ئێوارە هێزە ئەمنییەکان لە گۆڕەپانی سەرا و بازاڕی گەورە بڵاوکرانەوە، سەکۆ و پلاکاردەکانیان سووتاند و ڕێگەیان نەدا خەڵک بگەڕێنەوە، و بەمە خۆپیشاندانە ڕۆژانەکان کۆتاییان هات.'),
    { people: ['Rebin Hardi', 'Sirwan Rashid', 'Hiwa Jamal'], figures: P('More than 100 lawyers protested; many students detained.', 'زیاتر لە 100 پارێزەر خۆپیشاندانیان کرد؛ زۆر خوێندکار دەستگیر کران.'), sources: [T, 'rudaw-2021'], key: true }),
  e('04-20', '2011-04-20', P('Sulaimani and Halabja', 'سلێمانی و هەڵەبجە'),
    P('Activists and a lawyer taken', 'چالاکوانان و پارێزەرێک دەبرێن'),
    P('Armed forces attacked the protesters’ gathering place and broke up the speakers’ stage. According to the source, the PUK Asayish took the lawyer Razaw Abdul; Pishko Hama Faraj, a protest activist in Halabja, was taken by an armed group; and the teacher Hawraman Gachenayi was taken handcuffed to the Sulaimani Asayish. The day-by-day account ends here.',
      'هێزە چەکدارەکان هێرشیان کردە سەر شوێنی کۆبوونەوەی خۆپیشاندەران و سەکۆی وتاردانیان تێکدا. بەپێی سەرچاوەکە، ئاسایشی یەکێتی پارێزەر ڕازاو عەبدولی برد؛ پشکۆ حەمە فەرەج، چالاکوانێکی خۆپیشاندانی هەڵەبجە، لەلایەن گرووپێکی چەکدارەوە بردرا؛ و مامۆستا هەورامان گەچێنەیی بە کەلەپچەکراوی برایە ئاسایشی سلێمانی. گێڕانەوە ڕۆژ بە ڕۆژەکە لێرەدا کۆتایی دێت.'),
    { people: ['Razaw Abdul', 'Pishko Hama Faraj', 'Hawraman Gachenayi'] }),
];

/** Shown under the timeline. */
export const TIMELINE_PENDING: Bi = {
  en: 'This timeline follows the TEVDA Press chronicle, which records many more statements, protests and incidents for each day than are shown here. Further entries, corrections and evidence are added as they are verified, each with its source.',
  ckb: 'ئەم ڕیزبەندییە شوێن گێڕانەوەکەی TEVDA Press دەکەوێت، کە بۆ هەر ڕۆژێک بەیاننامە، خۆپیشاندان و ڕووداوی زۆر زیاتری تۆمار کردووە لەوەی لێرەدا پیشان دراون. تۆماری زیاتر، ڕاستکردنەوە و بەڵگە کاتێک پشتڕاست دەکرێنەوە زیاد دەکرێن، هەر یەکەیان لەگەڵ سەرچاوەکەی.',
};

export const MONTHS: Record<string, Bi> = {
  '02': { en: 'February 2011', ckb: 'شوباتی 2011' },
  '03': { en: 'March 2011', ckb: 'ئاداری 2011' },
  '04': { en: 'April 2011', ckb: 'نیسانی 2011' },
};

const KU_MONTHS = ['کانوونی دووەم', 'شوبات', 'ئادار', 'نیسان', 'ئایار', 'حوزەیران', 'تەمموز', 'ئاب', 'ئەیلوول', 'تشرینی یەکەم', 'تشرینی دووەم', 'کانوونی یەکەم'];
const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "17 February 2011" / "17ی شوباتی 2011" — written out, never left to the browser's locale. */
export const memorialDate = (iso: string | undefined, lang: 'en' | 'ckb') => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return lang === 'ckb' ? `${d}ی ${KU_MONTHS[m - 1]}ی ${y}` : `${d} ${EN_MONTHS[m - 1]} ${y}`;
};

/**
 * Portraits from the memorial poster supplied by the organisation, matched
 * by the name printed under each one. A portrait approved in Administration
 * replaces the one here.
 */
export const POSTER_PORTRAITS: Record<string, string> = Object.fromEntries(
  ['herdi', 'omed', 'bilal', 'garmian', 'sherzad', 'sorkew', 'rezhwan'].map((id) => [id, `/images/martyrs/${id}.jpg`]),
);
