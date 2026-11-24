import { Bi } from './memorial';

/**
 * Sherwan Sherwani — former member of 17 Shubat Organisation.
 *
 * As with the memorial: every statement names its source; the authorities'
 * allegations, the family's account and advocacy organisations' statements
 * are kept apart and attributed; conflicts between sources are shown, not
 * resolved; nobody is declared guilty or innocent. The current status is
 * date-stamped and must be reviewed when new information appears
 * (administrators add status updates from the website).
 */

export interface SSource { id: string; publisher: string; title: string; date: string; url?: string; author?: string; language: 'en' | 'ckb'; note?: Bi }

export const S_SOURCES: SSource[] = [
  { id: 'cpj-2019-02', publisher: 'Committee to Protect Journalists (CPJ)', title: 'Journalist detained for weeks in Iraqi Kurdistan, accused of anti-state acts', date: '2019-02-21', url: 'https://cpj.org/2019/02/journalist-detained-for-weeks-in-iraqi-kurdistan-a/', language: 'en' },
  { id: 'cpj-2019-07', publisher: 'Committee to Protect Journalists (CPJ)', title: 'Kurdish military forces detain journalist in Iraqi Kurdistan', date: '2019-07-29', url: 'https://cpj.org/2019/07/kurdish-military-forces-detain-journalist-in-iraqi/', language: 'en' },
  { id: 'cpj-2020-10', publisher: 'Committee to Protect Journalists (CPJ)', title: 'Iraqi Kurdish police arrest journalist Sherwan Amin Sherwani', date: '2020-10-08', url: 'https://cpj.org/2020/10/iraqi-kurdish-police-arrest-journalist-sherwan-amin-sherwani/', language: 'en' },
  { id: 'draw-2020', publisher: 'Draw Media', author: 'Aso Jabar (ئاسۆ جەبار)', title: 'رۆژنامەوان شێروان شێروانی بۆ دەستگیرکراوە؟ (Why was journalist Sherwan Sherwani arrested?)', date: '2020-10-13', url: 'https://drawmedia.net/page_detail?smart-id=6780', language: 'ckb' },
  { id: 'cpj-2023', publisher: 'Committee to Protect Journalists (CPJ)', title: 'Imprisoned journalist Sherwan Sherwani given additional 4-year sentence in Iraqi Kurdistan', date: '2023-07-20', url: 'https://cpj.org/2023/07/imprisoned-journalist-sherwan-sherwani-given-additional-4-year-sentence-in-iraqi-kurdistan/', language: 'en' },
  { id: 'cpj-profile', publisher: 'Committee to Protect Journalists (CPJ)', title: 'Sherwan Amin Sherwani (imprisoned journalist profile)', date: '2025-08-20', url: 'https://cpj.org/data/people/sherwan-amin-sherwani/', language: 'en', note: { en: 'Database entry; the latest event it records is 20 August 2025.', ckb: 'تۆماری بنکەدراوە؛ دوایین ڕووداو کە تۆماری دەکات 20ی ئابی 2025ە.' } },
  { id: 'rsf-2025', publisher: 'Reporters Without Borders (RSF)', title: 'Iraqi Kurdistan: RSF calls for the release of investigative journalists Bashdar Bazyani and Sherwan Sherwani', date: '2025-03-14', url: 'https://rsf.org/en/iraqi-kurdistan-rsf-calls-release-investigative-journalists-bashdar-bazyani-and-sherwan-sherwani', language: 'en' },
  { id: 'amnesty-2025', publisher: 'Amnesty International', title: 'Kurdistan Region of Iraq: New sentence for journalist weeks before planned release is evidence of perverse practice used to punish critics', date: '2025-08', url: 'https://www.amnesty.org/en/latest/news/2025/08/kurdistan-region-of-iraq-new-sentence-for-journalist-weeks-before-planned-release-is-evidence-of-perverse-practice-used-to-punish-critics/', language: 'en' },
  { id: 'cpj-2025-09', publisher: 'Committee to Protect Journalists (CPJ)', title: 'CPJ, partners urge Iraqi Kurdistan to free journalist Sherwan Sherwani', date: '2025-09-24', url: 'https://cpj.org/2025/09/cpj-partners-urge-iraqi-kurdistan-to-free-journalist-sherwan-sherwani/', language: 'en' },
  { id: 'ch8-2026-04', publisher: 'Channel 8', author: 'Ahmed Mohammed', title: 'Sherwan Sherwani on Hunger Strike in Erbil Prison: Will End if Two Demands Are Met', date: '2026-04-25', url: 'https://channel8.com/english/news/56883', language: 'en' },
  { id: 'soledad-2026', publisher: 'Soledad Times Magazine', title: 'Report that Sherwan Sherwani had been on hunger strike for seven days (Kurdish)', date: '2026-04-28', language: 'ckb', note: { en: 'Supplied to the organisation; we could not find it online, so its details are used only where other reports confirm them.', ckb: 'بە ڕێکخراوەکە دراوە؛ نەمانتوانی لە ئینتەرنێتدا بیدۆزینەوە، بۆیە وردەکارییەکانی تەنها لەو شوێنانە بەکارهاتوون کە ڕاپۆرتەکانی تر پشتڕاستیان دەکەنەوە.' } },
  { id: 'ch8-2026-05', publisher: 'Channel 8 (Kurdish)', author: 'Ara Ibrahim (ئارا ئیبراهیم)', title: 'شێروان شێروانى زیاتر لە 5 ساڵ و 6 مانگە لە زینداندایە؛ 11 ڕۆژە مانی لەخواردن گرتووە و تەندروستیی باش نییە', date: '2026-05-02', url: 'https://channel8.com/kurdish/news/202422', language: 'ckb' },
  { id: 'rudaw-2026', publisher: 'Rudaw (Kurdish)', author: 'Solin Hamadamin (سۆلین حەمەدەمین)', title: 'دەستەی مافی مرۆڤ: تەندروستیی شێروان شێروانی باشە و کێشەی نییە', date: '2026-05-03', url: 'https://rudaw.net/sorani/kurdistan/0305202621', language: 'ckb' },
  { id: '964-2026', publisher: '964 Media', title: 'Writers warn over jailed journalist’s worsening condition on day 23 of hunger strike', date: '2026-05', url: 'https://en.964media.com/47593/', language: 'en' },
];

export const S_TITLE: Bi = { en: 'Sherwan Sherwani — Former Member of 17 Shubat Organisation', ckb: 'شێروان شێروانی — ئەندامی پێشووی ڕێکخراوی 17ی شوبات' };
export const S_SUBTITLE: Bi = {
  en: 'Journalism, Freedom of Expression, and the Continuing Struggle for Press Freedom in Kurdistan.',
  ckb: 'ڕۆژنامەنووسی، ئازادیی ڕادەربڕین، و خەباتی بەردەوام بۆ ئازادیی ڕۆژنامەگەری لە کوردستان.',
};
export const S_SLIDES_TITLE: Bi = { en: 'Sherwan Sherwani: Journalism, Imprisonment and Press Freedom', ckb: 'شێروان شێروانی: ڕۆژنامەنووسی، زیندان و ئازادیی ڕۆژنامەگەری' };

export const S_PROFILE = {
  nameEn: 'Sherwan Sherwani',
  nameKu: 'شێروان شێروانی',
  altNames: [{ name: 'Sherwan Amin Sherwani', source: 'cpj-2020-10' }],
  intro: {
    en: 'Sherwan Sherwani is an investigative journalist from the Badinan region of the Kurdistan Region of Iraq. He founded the monthly magazine Bashur, and the Duhok non-profit Tekoshan. He has been detained several times since 2012, and has been in prison since his arrest in October 2020.',
    ckb: 'شێروان شێروانی ڕۆژنامەنووسێکی لێکۆڵەرە لە ناوچەی بادینانی هەرێمی کوردستانی عێراق. گۆڤاری مانگانەی «باشوور»ی دامەزراندووە، هەروەها ڕێکخراوی ناحکومیی تێکۆشان لە دهۆک. لە ساڵی 2012ەوە چەند جارێک دەستگیر کراوە، و لە کاتی دەستگیرکردنی لە تشرینی یەکەمی 2020ەوە لە زینداندایە.',
  },
  introSources: ['rsf-2025', 'cpj-2019-02', 'cpj-profile'],
  membership: {
    en: 'Sherwan Sherwani is a former member of 17 Shubat Organisation. The Committee to Protect Journalists reported in 2019 that he had worked as a freelance investigative journalist with 17Shubat for Human Rights since 2016. His membership dates and any position he held are not recorded here until they are confirmed from the organisation’s own records.',
    ckb: 'شێروان شێروانی ئەندامی پێشووی ڕێکخراوی 17ی شوباتە. لیژنەی پاراستنی ڕۆژنامەنووسان (CPJ) لە 2019 ڕایگەیاند کە لە 2016ەوە وەک ڕۆژنامەنووسی لێکۆڵەری سەربەخۆ لەگەڵ 17ی شوبات بۆ مافی مرۆڤ کاری کردووە. بەرواری ئەندامێتی و هەر پۆستێک کە هەیبووبێت لێرە تۆمار ناکرێن تا لە تۆمارەکانی خودی ڕێکخراوەکەوە پشتڕاست دەکرێنەوە.',
  },
  membershipSources: ['cpj-2019-02'],
};

export interface SEvent {
  id: string;
  date: string;
  /** Shown instead of the date when the exact day is not known. */
  dateLabel?: Bi;
  place?: Bi;
  title: Bi;
  /** What happened, attributed. */
  body: Bi;
  /** The authorities' account, the family's account and advocates' statements, kept apart. */
  accounts?: { who: 'authorities' | 'family' | 'lawyer' | 'advocates' | 'commission'; text: Bi; source: string }[];
  sources: string[];
  flags?: Bi[];
  slide?: number;
}

const P = (en: string, ckb: string): Bi => ({ en, ckb });

export const S_EVENTS: SEvent[] = [
  {
    id: 'ss-2012', date: '2012-04-01', dateLabel: P('2012 (April, according to Draw Media)', '2012 (نیسان، بەپێی میدیای درەو)'), place: P('Duhok', 'دهۆک'),
    title: P('First detention', 'یەکەم دەستگیرکردن'),
    body: P('He was detained by security forces for several days. RSF says the detention lasted six days and followed an article in Bashur magazine about a corruption case involving a municipal official in Duhok; it adds that a few months later a relative of the Barzani family sued him for defamation. Draw Media, citing CPJ, says he was held in April 2012 without an arrest warrant over two articles criticising government corruption.',
      'چەند ڕۆژێک لەلایەن هێزە ئەمنییەکانەوە ڕاگیرا. RSF دەڵێت دەستگیرکردنەکە شەش ڕۆژی خایاند و بەدوای وتارێکی گۆڤاری «باشوور»دا هات دەربارەی دۆسیەیەکی گەندەڵی کە فەرمانبەرێکی شارەوانیی دهۆکی تێدا بوو؛ و زیاد دەکات کە چەند مانگێک دواتر خزمێکی بنەماڵەی بارزانی سکاڵای بوختانی لێ تۆمار کرد. میدیای درەو، بە پشتبەستن بە CPJ، دەڵێت لە نیسانی 2012 بەبێ فەرمانی دەستگیرکردن لەسەر دوو وتار کە ڕەخنەیان لە گەندەڵیی حکومی گرتبوو ڕاگیرا.'),
    sources: ['rsf-2025', 'draw-2020'],
    flags: [P('The month (April) comes only from Draw Media.', 'مانگەکە (نیسان) تەنها لە میدیای درەوەوە هاتووە.')],
    slide: 2,
  },
  {
    id: 'ss-2016', date: '2016-01-01', dateLabel: P('From 2016', 'لە 2016ەوە'),
    title: P('Journalism with 17 Shubat', 'ڕۆژنامەنووسی لەگەڵ 17ی شوبات'),
    body: P('According to CPJ, he worked as a freelance investigative journalist with 17Shubat for Human Rights from 2016.',
      'بەپێی CPJ، لە 2016ەوە وەک ڕۆژنامەنووسی لێکۆڵەری سەربەخۆ لەگەڵ 17ی شوبات بۆ مافی مرۆڤ کاری کردووە.'),
    sources: ['cpj-2019-02'],
    slide: 1,
  },
  {
    id: 'ss-2019', date: '2019-01-28', place: P('Duhok', 'دهۆک'),
    title: P('Arrested on the way to a protest', 'لە ڕێگای خۆپیشاندانێکدا دەستگیر دەکرێت'),
    body: P('He was arrested by party-affiliated security forces, with 25 other people, on his way to a protest in north-eastern Duhok. The Asayish accused him of acts against the security of the state; according to his lawyer, the accusation cited Article 156 of the Iraqi Penal Code. He was moved to Zirka prison on 1 February and to the Gishti prison on 13 February, where he was held in solitary confinement. CPJ later reported that he was released on bail after several weeks.',
      'لەلایەن هێزێکی ئەمنیی سەر بە حزبەوە، لەگەڵ 25 کەسی تر، لە ڕێگای خۆپیشاندانێکدا لە باکووری ڕۆژهەڵاتی دهۆک دەستگیر کرا. ئاسایش تۆمەتی کارکردن دژی ئاسایشی دەوڵەتی خستە پاڵی؛ بەپێی پارێزەرەکەی، تۆمەتەکە ئاماژەی بە ماددەی 156ی یاسای سزادانی عێراقی دەکرد. لە 1ی شوبات گوازرایەوە زیندانی زرکا و لە 13ی شوبات زیندانی گشتی، کە لەوێ بە تەنیا ڕاگیرا. CPJ دواتر ڕایگەیاند کە دوای چەند هەفتەیەک بە کەفالەت ئازاد کرا.'),
    sources: ['cpj-2019-02', 'cpj-2019-07'],
    flags: [P('Draw Media, citing CPJ, says he was held for 42 days; CPJ’s own reports say “several weeks”.', 'میدیای درەو، بە پشتبەستن بە CPJ، دەڵێت 42 ڕۆژ ڕاگیرا؛ ڕاپۆرتەکانی خودی CPJ دەڵێن «چەند هەفتەیەک».')],
    slide: 2,
  },
  {
    id: 'ss-2020-arrest', date: '2020-10-07', place: P('His home in Sebiran, on the outskirts of Erbil', 'ماڵەکەی لە سێبیران، لە دەوروبەری هەولێر'),
    title: P('Arrested at home', 'لە ماڵەوە دەستگیر دەکرێت'),
    body: P('He was arrested at his home at about 4:30pm.', 'نزیکەی کاتژمێر 4:30ی ئێوارە لە ماڵەکەی خۆی دەستگیر کرا.'),
    accounts: [
      { who: 'family', source: 'cpj-2020-10', text: P('His wife, Rugesh Izzaddin Muheiadin, told CPJ that about ten police officers, four in plain clothes, came to the house, held him at gunpoint, handcuffed him and took him away, and seized two laptops, notebooks and CDs. She said they showed an arrest warrant but gave no reason, and that she did not know where he was being held.', 'هاوسەرەکەی، Rugesh Izzaddin Muheiadin (ڕووگەش محێەدین)، بە CPJی گوت نزیکەی دە پۆلیس، کە چواریان جلی مەدەنییان لەبەردا بوو، هاتنە ماڵەکە، دەمانچەیان لێ ڕاکێشا، کەلەپچەیان کرد و بردیان، و دوو لاپتۆپ، دەفتەر و سیدییان برد. گوتی فەرمانی دەستگیرکردنیان پیشان دا بەڵام هۆکاریان نەگوت، و نەیدەزانی لە کوێ ڕاگیراوە.') },
    ],
    sources: ['cpj-2020-10', 'draw-2020'],
    flags: [P('His wife’s name is spelled differently in the sources: Rugesh Izzaddin Muheiadin (CPJ), ڕووگەش محێەدین (Draw Media) and ڕوگەش جەبارى (Channel 8).', 'ناوی هاوسەرەکەی لە سەرچاوەکاندا جیاواز نووسراوە: Rugesh Izzaddin Muheiadin (CPJ)، ڕووگەش محێەدین (میدیای درەو) و ڕوگەش جەبارى (کەناڵی 8).')],
    slide: 3,
  },
  {
    id: 'ss-2020-allegations', date: '2020-10-13', place: P('Erbil', 'هەولێر'),
    title: P('The allegations, and the questions raised', 'تۆمەتەکان، و پرسیارە ورووژێنراوەکان'),
    body: P('In the days after the arrest, the authorities gave their account, his wife disputed it, and press-freedom organisations questioned it. Draw Media’s article of 13 October 2020 brought these accounts together.',
      'لە ڕۆژانی دوای دەستگیرکردنەکە، دەسەڵاتداران گێڕانەوەی خۆیان دا، هاوسەرەکەی ڕەتی کردەوە، و ڕێکخراوەکانی ئازادیی ڕۆژنامەگەری پرسیاریان لەسەر کرد. وتارەکەی میدیای درەو لە 13ی تشرینی یەکەمی 2020 ئەم گێڕانەوانەی کۆکردەوە.'),
    accounts: [
      { who: 'authorities', source: 'cpj-2020-10', text: P('Dindar Zebari, the Kurdistan Regional Government’s coordinator for international advocacy, told CPJ on 11 October that he was arrested under Article 156 of the Iraqi Penal Code, and that he had confessed during a preliminary investigation to receiving foreign funds to cause unrest. According to Draw Media, Zebari said the arrest followed an order of the Duhok investigative court.', 'دیندار زێباری، هەماهەنگکاری ڕاسپاردە نێودەوڵەتییەکانی حکومەتی هەرێمی کوردستان، لە 11ی تشرینی یەکەم بە CPJی گوت بەپێی ماددەی 156ی یاسای سزادانی عێراقی دەستگیر کراوە، و لە لێکۆڵینەوەی سەرەتاییدا دانی پێداناوە کە پارەی بیانیی وەرگرتووە بۆ نانەوەی ئاژاوە. بەپێی میدیای درەو، زێباری گوتی دەستگیرکردنەکە بەپێی فەرمانی دادگای لێکۆڵینەوەی دهۆک بووە.') },
      { who: 'family', source: 'cpj-2020-10', text: P('His wife said on 13 October that she believed these assertions were false and did not believe he had made the alleged confession.', 'هاوسەرەکەی لە 13ی تشرینی یەکەم گوتی باوەڕی وایە ئەم قسانە ڕاست نین و باوەڕ ناکات ئەو دانپێدانانەی کردبێت.') },
      { who: 'advocates', source: 'draw-2020', text: P('The Metro Center for Journalists’ Rights and Advocacy questioned the authorities’ explanation, saying Article 156 concerns taking part in a group seeking to change the system of government by armed force with foreign help. Its coordinator, Rahman Gharib, said that any charge could fall under the law on the misuse of communication devices or the defamation provisions. CPJ called on the authorities to disclose the charges and evidence or release him.', 'سەنتەری مێترۆ بۆ داکۆکی لە مافی ڕۆژنامەنووسان پرسیاری لە ڕوونکردنەوەکەی دەسەڵاتداران کرد، و گوتی ماددەی 156 پەیوەندیی بە بەشداریکردن لە گرووپێکەوە هەیە کە بە هێزی چەک و بە یارمەتیی بیانی هەوڵی گۆڕینی سیستەمی حوکم بدات. هەماهەنگکارەکەی، ڕەحمان غەریب، گوتی هەر تۆمەتێک لەوانەیە بکەوێتە ژێر یاسای خراپ بەکارهێنانی ئامێرەکانی پەیوەندی یان ماددەکانی بوختان. CPJ داوای لە دەسەڵاتداران کرد تۆمەت و بەڵگەکان ئاشکرا بکەن یان ئازادی بکەن.') },
    ],
    sources: ['cpj-2020-10', 'draw-2020'],
    slide: 3,
  },
  {
    id: 'ss-2021', date: '2021-02-16', place: P('Erbil Criminal Court', 'دادگای تاوانەکانی هەولێر'),
    title: P('Sentenced to six years', 'شەش ساڵ زیندان'),
    body: P('The Erbil Criminal Court sentenced him and four others — Ayaz Karam, Guhdar Zebari, Hariwan Issa and Shvan Saeed — to six years in prison for undermining the security of the Kurdistan Region. Amnesty International called the trial “grossly unfair” and said allegations of torture were never investigated.',
      'دادگای تاوانەکانی هەولێر ئەو و چوار کەسی تر — ئەیاز کەرەم، گوهدار زێباری، هاریوان عیسا و شڤان سەعید — بە شەش ساڵ زیندان سزا دا بە تۆمەتی تێکدانی ئاسایشی هەرێمی کوردستان. ڕێکخراوی لێبووردنی نێودەوڵەتی دادگاییەکەی بە «زۆر نادادپەروەرانە» ناوبرد و گوتی تۆمەتەکانی ئەشکەنجەدان هەرگیز لێکۆڵینەوەیان لەسەر نەکرا.'),
    sources: ['cpj-2023', 'rudaw-2026', 'amnesty-2025'],
    slide: 2,
  },
  {
    id: 'ss-2022', date: '2022-02-23', place: P('Kurdistan Region Presidency', 'سەرۆکایەتیی هەرێمی کوردستان'),
    title: P('Sentence reduced by presidential decree', 'سزاکە بە بڕیاری سەرۆکایەتی کەم دەکرێتەوە'),
    body: P('A decree of the President of the Kurdistan Region, Nechirvan Barzani, reduced the sentences in the case, setting his release for 9 September 2023.',
      'بڕیارێکی نێچیرڤان بارزانی، سەرۆکی هەرێمی کوردستان، سزاکانی ئەم دۆسیەیەی کەم کردەوە، و ئازادکردنی بۆ 9ی ئەیلوولی 2023 دیاری کرا.'),
    sources: ['cpj-profile', 'cpj-2023', 'rudaw-2026'],
    flags: [P('CPJ records a 60 percent reduction on 23 February 2022; Rudaw and Channel 8 report that his sentence was reduced by 50 percent while the others’ were reduced by 60 percent.', 'CPJ کەمکردنەوەی 60 لە سەد لە 23ی شوباتی 2022 تۆمار دەکات؛ ڕووداو و کەناڵی 8 دەڵێن سزاکەی ئەو 50 لە سەد کەمکرایەوە لە کاتێکدا هی ئەوانی تر 60 لە سەد کەمکرانەوە.')],
  },
  {
    id: 'ss-2023', date: '2023-07-20', place: P('Erbil criminal court', 'دادگای تاوانەکانی هەولێر'),
    title: P('Four more years, weeks before his release', 'چوار ساڵی تر، چەند هەفتەیەک پێش ئازادکردنی'),
    body: P('On a complaint by the Erbil Adult Correctional Directorate, the court sentenced him to four more years for falsifying documents — 2.5 years under Article 295 and 1.5 years under Article 298 of the Penal Code — for signing Guhdar Zebari’s name on a prisoners’ petition in August 2022. His lawyer said Zebari had given permission, and Zebari confirmed this at the hearing. On appeal, on 29 October 2023, the sentence was reduced to two years.',
      'لەسەر سکاڵای بەڕێوەبەرایەتیی چاکسازیی گەورانی هەولێر، دادگا بە چوار ساڵی تر سزای دا بە تۆمەتی ساختەکردنی بەڵگەنامە — 2.5 ساڵ بەپێی ماددەی 295 و 1.5 ساڵ بەپێی ماددەی 298ی یاسای سزادان — لەبەر واژۆکردنی ناوی گوهدار زێباری لەسەر داواکارییەکی زیندانیان لە ئابی 2022. پارێزەرەکەی گوتی زێباری ڕێگەی پێدابوو، و زێباری لە دانیشتنەکەدا ئەمەی پشتڕاست کردەوە. لە تێهەڵچوونەوەدا، لە 29ی تشرینی یەکەمی 2023، سزاکە کرا بە دوو ساڵ.'),
    accounts: [
      { who: 'advocates', source: 'cpj-2023', text: P('CPJ: “Iraqi Kurdish authorities must drop all charges against journalist Sherwan Sherwani and free him immediately.”', 'CPJ: «دەسەڵاتدارانی کوردی عێراق دەبێت هەموو تۆمەتەکانی سەر ڕۆژنامەنووس شێروان شێروانی هەڵبوەشێننەوە و دەستبەجێ ئازادی بکەن.»') },
      { who: 'family', source: 'cpj-2023', text: P('His brother, Barzan Sherwani, called the ruling “politicized”; his lawyer, Ramazan Tartisi, called it “unjust and harsh”.', 'براکەی، بارزان شێروانی، بڕیارەکەی بە «سیاسی» ناوبرد؛ پارێزەرەکەی، ڕەمەزان تەرتیسی، بە «نادادپەروەرانە و توند» ناوی برد.') },
    ],
    sources: ['cpj-2023', 'cpj-profile'],
    slide: 2,
  },
  {
    id: 'ss-2025', date: '2025-08-20', dateLabel: P('19 or 20 August 2025', '19 یان 20ی ئابی 2025'), place: P('Erbil', 'هەولێر'),
    title: P('A third sentence, weeks before his planned release', 'سزای سێیەم، چەند هەفتەیەک پێش ئازادکردنی چاوەڕوانکراو'),
    body: P('An Erbil court sentenced him to four years and five months more for threatening a prison officer and his family; CPJ says the court cited Article 229 of the Penal Code. Amnesty International said the sentence came weeks before his scheduled release and called it “a blatant ruse by the authorities to keep him behind bars”.',
      'دادگایەکی هەولێر بە چوار ساڵ و پێنج مانگی تر سزای دا بە تۆمەتی هەڕەشەکردن لە کارمەندێکی زیندان و خێزانەکەی؛ CPJ دەڵێت دادگا ئاماژەی بە ماددەی 229ی یاسای سزادان کردووە. ڕێکخراوی لێبووردنی نێودەوڵەتی گوتی سزاکە چەند هەفتەیەک پێش کاتی دیاریکراوی ئازادکردنی هات و بە «فێڵێکی ئاشکرای دەسەڵاتداران بۆ ڕاگرتنی لە پشت شیشەکانەوە» ناوی برد.'),
    sources: ['cpj-profile', 'amnesty-2025'],
    flags: [P('The date differs: 19 August (Amnesty International) or 20 August 2025 (CPJ).', 'بەروار جیاوازە: 19ی ئاب (لێبووردنی نێودەوڵەتی) یان 20ی ئابی 2025 (CPJ).')],
    slide: 2,
  },
  {
    id: 'ss-2025-09', date: '2025-09-24',
    title: P('Press-freedom organisations call for his release', 'ڕێکخراوەکانی ئازادیی ڕۆژنامەگەری داوای ئازادکردنی دەکەن'),
    body: P('CPJ and 17 other press-freedom and human-rights organisations and media outlets called for his immediate and unconditional release, saying: “The misuse of the judicial system to punish journalists like Sherwani is a grave violation.” Reporters Without Borders had earlier called for his release, describing his 2023 sentence as “cruel and vindictive”.',
      'CPJ و 17 ڕێکخراو و دامەزراوەی میدیایی تری ئازادیی ڕۆژنامەگەری و مافی مرۆڤ داوای ئازادکردنی دەستبەجێ و بێمەرجیان کرد و گوتیان: «خراپ بەکارهێنانی سیستەمی دادوەری بۆ سزادانی ڕۆژنامەنووسانی وەک شێروانی پێشێلکارییەکی گەورەیە.» ڕێکخراوی پەیامنێرانی بێسنوور (RSF) پێشتر داوای ئازادکردنی کردبوو و سزاکەی 2023ی بە «دڕندانە و تۆڵەسێنەرانە» ناوبردبوو.'),
    sources: ['cpj-2025-09', 'rsf-2025'],
    slide: 4,
  },
  {
    id: 'ss-2026-hunger', date: '2026-04-22', place: P('Erbil Correctional Facility', 'چاکسازیی گەورانی هەولێر'),
    title: P('A hunger strike begins', 'مانگرتن لە خواردن دەست پێدەکات'),
    body: P('On 22 April 2026, the day Kurdish journalism marks its anniversary, his lawyer announced that he had begun a hunger strike.',
      'لە 22ی نیسانی 2026، ڕۆژی ساڵیادی ڕۆژنامەگەریی کوردی، پارێزەرەکەی ڕایگەیاند کە دەستی بە مانگرتن لە خواردن کردووە.'),
    accounts: [
      { who: 'lawyer', source: 'ch8-2026-04', text: P('Mohammed Abdullah, head of his legal team, said he would end the strike if two demands were met: permission to go home on leave, as the law allows, and a transfer to the Sulaimani correctional facility. He said the Erbil prison authorities had rejected both.', 'محەمەد عەبدوڵا، سەرۆکی تیمی پارێزەرانی، گوتی ئەگەر دوو داواکاری جێبەجێ بکرێن کۆتایی بە مانگرتنەکە دەهێنێت: مۆڵەتی چوونەوە بۆ ماڵەوە، وەک یاسا ڕێگەی پێدەدات، و گواستنەوە بۆ چاکسازیی سلێمانی. گوتی دەسەڵاتدارانی زیندانی هەولێر هەردووکیان ڕەتکردووەتەوە.') },
      { who: 'family', source: 'ch8-2026-04', text: P('His brother, Barzan Sherwani, said he held the authorities responsible for his brother’s life and health.', 'براکەی، بارزان شێروانی، گوتی دەسەڵاتداران بە بەرپرسیار دەزانێت لە ژیان و تەندروستیی براکەی.') },
    ],
    sources: ['ch8-2026-04', 'soledad-2026'],
    slide: 5,
  },
  {
    id: 'ss-2026-05-02', date: '2026-05-02',
    title: P('Eleventh day of the hunger strike', 'یازدەهەمین ڕۆژی مانگرتن'),
    body: P('Channel 8 reported that he had been refusing food for eleven days and that his health was not good.', 'کەناڵی 8 ڕایگەیاند کە یازدە ڕۆژە خواردن ناخوات و تەندروستیی باش نییە.'),
    accounts: [
      { who: 'lawyer', source: 'ch8-2026-05', text: P('His lawyer said the demands included family visits on the same terms as other prisoners and a transfer to Sulaimani, and that these had been refused on security grounds.', 'پارێزەرەکەی گوتی داواکارییەکان سەردانی خێزان بە هەمان مەرجی زیندانیانی تر و گواستنەوە بۆ سلێمانی لەخۆدەگرن، و بە بیانووی ئاسایش ڕەتکراونەتەوە.') },
      { who: 'family', source: 'ch8-2026-05', text: P('His wife wrote in a letter to the United States: “ڕێگە مەدەن هاوسەرەکەم بە هێواشی لە پشتی دیوارەکانی زیندانەوە گیان بسپێرێت” (“Do not let my husband die slowly behind prison walls”).', 'هاوسەرەکەی لە نامەیەکدا بۆ ئەمریکا نووسی: «ڕێگە مەدەن هاوسەرەکەم بە هێواشی لە پشتی دیوارەکانی زیندانەوە گیان بسپێرێت».') },
    ],
    sources: ['ch8-2026-05'],
    slide: 5,
  },
  {
    id: 'ss-2026-05-03', date: '2026-05-03', place: P('Erbil Correctional Facility', 'چاکسازیی گەورانی هەولێر'),
    title: P('The Independent Human Rights Commission visits', 'سەردانی کۆمیسیۆنی سەربەخۆی مافی مرۆڤ'),
    body: P('A delegation of the Kurdistan Region’s Independent Human Rights Commission, led by its chair, Dr Mona Yaqoo, visited him in prison.', 'شاندێکی کۆمیسیۆنی سەربەخۆی مافی مرۆڤی هەرێمی کوردستان، بە سەرۆکایەتیی د. مونا یاقوو، لە زیندان سەردانیان کرد.'),
    accounts: [
      { who: 'commission', source: 'rudaw-2026', text: P('Tavga Omar, the Commission’s legal director, said his health was good, that he said he had been on hunger strike for twelve days, and that the Commission had asked him to end it. She said a transfer to Sulaimani was not possible because his place of residence is Erbil, and that no suitable legal option for leave had been found.', 'تاڤگە عومەر، بەڕێوەبەری گشتیی بەشی یاسایی کۆمیسیۆنەکە، گوتی تەندروستیی باشە، و گوتی ئەو گوتوویەتی دوازدە ڕۆژە مانی گرتووە، و کۆمیسیۆنەکە داوای لێکردووە کۆتایی پێبهێنێت. گوتی گواستنەوە بۆ سلێمانی ناکرێت چونکە شوێنی نیشتەجێبوونی هەولێرە، و هیچ ڕێگایەکی یاسایی گونجاو بۆ مۆڵەت نەدۆزراوەتەوە.') },
    ],
    sources: ['rudaw-2026'],
    slide: 5,
  },
  {
    id: 'ss-2026-day23', date: '2026-05-14', dateLabel: P('May 2026 (day 23 of the hunger strike)', 'ئایاری 2026 (ڕۆژی 23ی مانگرتن)'),
    title: P('Writers and academics voice concern', 'نووسەران و ئەکادیمییەکان نیگەرانیی خۆیان دەردەبڕن'),
    body: P('On the 23rd day of the hunger strike, a group of writers and academics expressed deep concern about his continued imprisonment and his health.', 'لە ڕۆژی 23ی مانگرتنەکەدا، گرووپێک لە نووسەران و ئەکادیمییەکان نیگەرانیی قووڵی خۆیان دەربڕی دەربارەی بەردەوامیی زیندانیکردنی و تەندروستیی.'),
    accounts: [
      { who: 'lawyer', source: '964-2026', text: P('His lawyer, Mohammed Abdullah, said his health was deteriorating and none of his demands had been met, and that the prison authorities had told him to end the strike before a doctor would examine him.', 'پارێزەرەکەی، محەمەد عەبدوڵا، گوتی تەندروستیی خراپتر دەبێت و هیچ داواکارییەکی جێبەجێ نەکراوە، و دەسەڵاتدارانی زیندان پێیان گوتووە کۆتایی بە مانگرتنەکە بهێنێت ئینجا پزیشکێکی بۆ دەهێنن.') },
    ],
    sources: ['964-2026'],
    flags: [P('The report gives the day of the hunger strike, not the date.', 'ڕاپۆرتەکە ڕۆژی مانگرتنەکە دەنووسێت، نەک بەروار.')],
  },
];

/** The latest status, date-stamped. Administrators add newer verified updates from the website. */
export const S_STATUS = {
  lastReport: { date: '2026-05-03', source: 'rudaw-2026' },
  checkedOn: '2026-10-25',
  text: {
    en: 'Reportedly imprisoned in Erbil Correctional Facility, according to the most recent reliable report we found (Rudaw, 3 May 2026). When we checked on 25 October 2026 we found no more recent report, so this status has not been freshly verified.',
    ckb: 'بەپێی نوێترین ڕاپۆرتی متمانەپێکراو کە دۆزیمانەوە (ڕووداو، 3ی ئایاری 2026)، لە چاکسازیی گەورانی هەولێر زیندانییە. کاتێک لە 25ی تشرینی یەکەمی 2026 پشکنینمان کرد، هیچ ڕاپۆرتێکی نوێترمان نەدۆزییەوە، بۆیە ئەم بارە بە تازەیی پشتڕاست نەکراوەتەوە.',
  },
};

export const S_CALL: Bi = {
  en: 'We call for transparent legal proceedings, full access to his lawyers, family contact in accordance with the law, independent investigation of the allegations of ill-treatment, and respect for freedom of expression and the right of journalists to work without fear. This page does not declare anyone guilty or innocent; it keeps the record and the sources together so that they can be checked.',
  ckb: 'داوای دادگاییکردنی شەفاف، دەستڕاگەیشتنی تەواو بە پارێزەرەکانی، پەیوەندیی خێزان بەپێی یاسا، لێکۆڵینەوەی سەربەخۆ لە تۆمەتەکانی خراپ مامەڵەکردن، و ڕێزگرتن لە ئازادیی ڕادەربڕین و مافی ڕۆژنامەنووسان بۆ کارکردن بەبێ ترس دەکەین. ئەم پەڕەیە کەس بە تاوانبار یان بێتاوان ناناسێنێت؛ تۆمار و سەرچاوەکان پێکەوە دەپارێزێت بۆ ئەوەی بپشکنرێن.',
};
