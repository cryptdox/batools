#!/usr/bin/env python3
"""
Writes islamic_studio_content.sql: the Islamic Studio starting content (duas,
tasbih presets, regions, events, ayahs of the day, checklists, hadith books,
a welcome announcement) for the batools Supabase.

Quranic duas take their Arabic word-for-word from the app's bundled Tanzil
Quran (islamic-studio-app/public/quran/quran.json), so they are exact. Hadith
duas are typed here. Every dua and tasbih preset goes in as 'in_review': it
reaches the app only after a reviewer approves it in batools → Content Review.

Re-runnable: rows have fixed ids or natural keys, and existing rows are left
alone (nothing is overwritten or deleted).

    python3 islamic_studio_content.py   # regenerates the .sql next to it
"""
import json
import uuid
from pathlib import Path

HERE = Path(__file__).resolve().parent
QURAN = HERE.parents[3] / 'islamic-studio-app' / 'public' / 'quran' / 'quran.json'
OUT = HERE / 'islamic_studio_content.sql'
NS = uuid.UUID('6f1c1b8e-6c2a-4d4e-9a57-1d2c3b4a5e60')  # fixed: same ids on every run

surahs = json.loads(QURAN.read_text())['surahs']
AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'


def ayah(ref: str, start: int = 0) -> str:
    """Words `start`… of one ayah, exactly as in the bundled Quran."""
    s, a = map(int, ref.split(':'))
    return ' '.join(surahs[s - 1]['ayahs'][a - 1].split(' ')[start:])


def ayahs(surah: int, first: int, last: int, start: int = 0) -> str:
    """Several ayahs, each followed by its number in an ayah-end mark."""
    parts = []
    for a in range(first, last + 1):
        text = ayah(f'{surah}:{a}', start if a == first else 0)
        parts.append(f"{text} ﴿{''.join(AR_DIGITS[int(d)] for d in str(a))}﴾")
    return ' '.join(parts)


def sql(v) -> str:
    if v is None:
        return 'NULL'
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, dict):
        v = json.dumps(v, ensure_ascii=False)
    return "'" + str(v).replace("'", "''") + "'"


def tr(en: str, bn: str, ar: str | None = None) -> dict:
    d = {'en': en, 'bn': bn}
    if ar:
        d['ar'] = ar
    return d


# --- Duas --------------------------------------------------------------------
# slug, categories, title, arabic, transliteration, meaning, when to read, times, source, grade, virtue
DUAS = [
    ('ayat-al-kursi', ['morning', 'evening', 'sleep', 'after-salah', 'quran'],
     tr('Ayat al-Kursi', 'আয়াতুল কুরসি'), ayah('2:255'),
     tr('Allahu la ilaha illa huwal-hayyul-qayyum…', 'আল্লাহু লা ইলাহা ইল্লা হুওয়াল হাইয়ুল কাইয়ুম…'),
     tr('Allah — there is no god but Him, the Ever-Living, the Sustainer of all. Neither drowsiness nor sleep overtakes Him. To Him belongs whatever is in the heavens and the earth. Who could intercede with Him except by His permission? He knows what is before them and what is behind them, and they encompass nothing of His knowledge except what He wills. His Throne extends over the heavens and the earth, and guarding them does not tire Him. He is the Most High, the Most Great.',
        'আল্লাহ, তিনি ছাড়া কোনো উপাস্য নেই; তিনি চিরঞ্জীব, সবকিছুর ধারক। তন্দ্রা বা ঘুম তাঁকে স্পর্শ করে না। আসমান ও জমিনে যা কিছু আছে সব তাঁরই। তাঁর অনুমতি ছাড়া কে তাঁর কাছে সুপারিশ করবে? তাদের সামনে ও পেছনে যা আছে তিনি জানেন; তিনি যা চান তা ছাড়া তাঁর জ্ঞানের কিছুই তারা আয়ত্ত করতে পারে না। তাঁর কুরসি আসমান ও জমিন জুড়ে বিস্তৃত, আর এ দুটির রক্ষণাবেক্ষণ তাঁকে ক্লান্ত করে না। তিনি সুউচ্চ, মহান।'),
     tr('Morning, evening, after each salah and before sleeping', 'সকাল-সন্ধ্যায়, প্রতি নামাজের পর ও ঘুমানোর আগে'),
     1, 'Quran 2:255; Sahih al-Bukhari 2311 (before sleep)', 'quran',
     tr('Whoever recites it before sleeping remains under Allah’s protection until morning.', 'ঘুমানোর আগে পড়লে সকাল পর্যন্ত আল্লাহর পক্ষ থেকে একজন রক্ষাকারী থাকে।')),
    ('three-quls', ['morning', 'evening', 'sleep', 'quran'],
     tr('The three Quls (al-Ikhlas, al-Falaq, an-Nas)', 'তিন কুল (ইখলাস, ফালাক, নাস)'),
     ayahs(112, 1, 4) + ' ۞ ' + ayahs(113, 1, 5) + ' ۞ ' + ayahs(114, 1, 6),
     tr('Qul huwallahu ahad… / Qul a‘udhu bi rabbil-falaq… / Qul a‘udhu bi rabbin-nas…', 'কুল হুওয়াল্লাহু আহাদ… / কুল আউযু বিরব্বিল ফালাক… / কুল আউযু বিরব্বিন নাস…'),
     tr('Surahs 112, 113 and 114: Allah is One; and seeking refuge with the Lord of daybreak and the Lord of mankind from every evil.',
        'সূরা ১১২, ১১৩ ও ১১৪: আল্লাহ এক; এবং প্রভাতের রব ও মানুষের রবের কাছে সব অনিষ্ট থেকে আশ্রয় চাওয়া।'),
     tr('Three times each, morning and evening; and before sleeping', 'সকাল-সন্ধ্যায় প্রতিটি তিনবার; ঘুমানোর আগেও'),
     3, 'Quran 112–114; Sunan Abi Dawud 5082; Jami‘ at-Tirmidhi 3575', 'quran',
     tr('They suffice you against everything.', 'এগুলো সবকিছুর জন্য আপনার জন্য যথেষ্ট হবে।')),
    ('sayyid-al-istighfar', ['morning', 'evening', 'forgiveness'],
     tr('The master supplication for forgiveness', 'সাইয়্যিদুল ইস্তিগফার'),
     'اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ، وَأَبُوءُ لَكَ بِذَنْبِي، فَاغْفِرْ لِي، فَإِنَّهُ لَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ',
     tr('Allahumma anta rabbi la ilaha illa ant, khalaqtani wa ana ‘abduk, wa ana ‘ala ‘ahdika wa wa‘dika mastata‘t, a‘udhu bika min sharri ma sana‘t, abu’u laka bi ni‘matika ‘alayya, wa abu’u laka bi dhanbi, faghfir li, fa innahu la yaghfirudh-dhunuba illa ant',
        'আল্লাহুম্মা আনতা রব্বি লা ইলাহা ইল্লা আনতা, খালাকতানি ওয়া আনা আবদুকা, ওয়া আনা আলা আহদিকা ওয়া ওয়াদিকা মাসতাতাতু, আউযু বিকা মিন শাররি মা সানাতু, আবুউ লাকা বিনিমাতিকা আলাইয়া, ওয়া আবুউ লাকা বিযামবি, ফাগফির লি, ফাইন্নাহু লা ইয়াগফিরুয যুনুবা ইল্লা আনতা'),
     tr('O Allah, You are my Lord; there is no god but You. You created me and I am Your servant, and I keep Your covenant and promise as best I can. I seek refuge in You from the evil of what I have done. I acknowledge Your favour upon me and I acknowledge my sin, so forgive me, for none forgives sins but You.',
        'হে আল্লাহ, আপনি আমার রব; আপনি ছাড়া কোনো উপাস্য নেই। আপনি আমাকে সৃষ্টি করেছেন, আমি আপনার বান্দা। আমি সাধ্যমতো আপনার অঙ্গীকার ও প্রতিশ্রুতির ওপর আছি। আমি যা করেছি তার অনিষ্ট থেকে আপনার আশ্রয় চাই। আমার ওপর আপনার নিয়ামত স্বীকার করছি এবং আমার গুনাহও স্বীকার করছি; তাই আমাকে ক্ষমা করুন, কারণ আপনি ছাড়া কেউ গুনাহ ক্ষমা করে না।'),
     tr('Once in the morning and once in the evening', 'সকালে একবার ও সন্ধ্যায় একবার'),
     1, 'Sahih al-Bukhari 6306', 'sahih',
     tr('Whoever says it with conviction and dies that day or night will be among the people of Paradise.', 'দৃঢ় বিশ্বাসের সাথে পড়ে সেদিন বা সে রাতে মারা গেলে জান্নাতি হবে।')),
    ('bismillah-la-yadurru', ['morning', 'evening'],
     tr('In the name of Allah, with whose name nothing harms', 'আল্লাহর নামে, যাঁর নামে কিছুই ক্ষতি করতে পারে না'),
     'بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ، وَهُوَ السَّمِيعُ الْعَلِيمُ',
     tr('Bismillahil-ladhi la yadurru ma‘asmihi shay’un fil-ardi wa la fis-sama’, wa huwas-sami‘ul-‘alim',
        'বিসমিল্লাহিল্লাযি লা ইয়াদুররু মাআসমিহি শাইউন ফিল আরদি ওয়ালা ফিস সামাই, ওয়া হুওয়াস সামিউল আলিম'),
     tr('In the name of Allah, with whose name nothing on earth or in the heaven can cause harm, and He is the All-Hearing, the All-Knowing.',
        'আল্লাহর নামে, যাঁর নামের সাথে জমিনে বা আসমানে কোনো কিছুই ক্ষতি করতে পারে না; তিনি সর্বশ্রোতা, সর্বজ্ঞ।'),
     tr('Three times in the morning and three in the evening', 'সকালে তিনবার ও সন্ধ্যায় তিনবার'),
     3, 'Sunan Abi Dawud 5088; Jami‘ at-Tirmidhi 3388', 'hasan',
     tr('Nothing will harm the one who says it.', 'যে এটি পড়ে, কিছুই তার ক্ষতি করতে পারবে না।')),
    ('kalimat-allah-at-tammat', ['evening'],
     tr('Refuge in Allah’s perfect words', 'আল্লাহর পরিপূর্ণ বাণীর আশ্রয়'),
     'أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ',
     tr('A‘udhu bi kalimatillahit-tammati min sharri ma khalaq', 'আউযু বিকালিমাতিল্লাহিত তাম্মাতি মিন শাররি মা খালাক'),
     tr('I seek refuge in the perfect words of Allah from the evil of what He has created.', 'আমি আল্লাহর পরিপূর্ণ বাণীসমূহের মাধ্যমে তাঁর সৃষ্টির অনিষ্ট থেকে আশ্রয় চাই।'),
     tr('Three times in the evening; and when stopping at a place', 'সন্ধ্যায় তিনবার; কোথাও যাত্রাবিরতি করলে'),
     3, 'Sahih Muslim 2708, 2709', 'sahih', None),
    ('subhanallah-wa-bihamdihi', ['morning', 'evening'],
     tr('Glory and praise be to Allah', 'সুবহানাল্লাহি ওয়া বিহামদিহি'),
     'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ',
     tr('SubhanAllahi wa bihamdihi', 'সুবহানাল্লাহি ওয়া বিহামদিহি'),
     tr('Glory be to Allah and praise be to Him.', 'আল্লাহ পবিত্র, এবং সব প্রশংসা তাঁরই।'),
     tr('A hundred times in the morning and in the evening', 'সকালে ও সন্ধ্যায় একশবার'),
     100, 'Sahih Muslim 2692', 'sahih',
     tr('No one brings anything better on the Day of Resurrection, except one who said the same or more.', 'কিয়ামতের দিন এর চেয়ে উত্তম কিছু কেউ আনতে পারবে না, তবে যে এর সমান বা বেশি বলেছে সে ছাড়া।')),
    ('allahumma-bika-asbahna', ['morning'],
     tr('O Allah, by You we enter the morning', 'হে আল্লাহ, আপনার নামে আমাদের সকাল'),
     'اللَّهُمَّ بِكَ أَصْبَحْنَا، وَبِكَ أَمْسَيْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ النُّشُورُ',
     tr('Allahumma bika asbahna, wa bika amsayna, wa bika nahya, wa bika namutu, wa ilaykan-nushur',
        'আল্লাহুম্মা বিকা আসবাহনা, ওয়া বিকা আমসাইনা, ওয়া বিকা নাহইয়া, ওয়া বিকা নামুতু, ওয়া ইলাইকান নুশুর'),
     tr('O Allah, by You we enter the morning and by You we enter the evening, by You we live and by You we die, and to You is the resurrection.',
        'হে আল্লাহ, আপনার নামেই আমরা সকালে উপনীত হই ও সন্ধ্যায় উপনীত হই, আপনার নামেই বাঁচি ও মরি, আর আপনার দিকেই পুনরুত্থান।'),
     tr('In the morning (in the evening say “by You we enter the evening… and to You is the return”)', 'সকালে (সন্ধ্যায় শব্দক্রম বদলে “ওয়া ইলাইকাল মাসির” বলবেন)'),
     1, 'Jami‘ at-Tirmidhi 3391; Sunan Abi Dawud 5068', 'hasan', None),
    ('ya-hayyu-ya-qayyum', ['morning', 'evening', 'distress'],
     tr('O Ever-Living, O Sustainer', 'ইয়া হাইয়ু ইয়া কাইয়ুম'),
     'يَا حَيُّ يَا قَيُّومُ بِرَحْمَتِكَ أَسْتَغِيثُ، أَصْلِحْ لِي شَأْنِي كُلَّهُ، وَلَا تَكِلْنِي إِلَى نَفْسِي طَرْفَةَ عَيْنٍ',
     tr('Ya Hayyu ya Qayyum, bi rahmatika astaghith, aslih li sha’ni kullah, wa la takilni ila nafsi tarfata ‘ayn',
        'ইয়া হাইয়ু ইয়া কাইয়ুম, বিরহমাতিকা আসতাগিস, আসলিহ লি শানি কুল্লাহু, ওয়ালা তাকিলনি ইলা নাফসি তারফাতা আইন'),
     tr('O Ever-Living, O Sustainer of all, by Your mercy I seek help: set right all my affairs, and do not leave me to myself even for the blink of an eye.',
        'হে চিরঞ্জীব, হে সবকিছুর ধারক, আপনার রহমতের উসিলায় সাহায্য চাই: আমার সব বিষয় ঠিক করে দিন, আর এক পলকের জন্যও আমাকে আমার নিজের ওপর ছেড়ে দেবেন না।'),
     tr('Morning and evening, and in hardship', 'সকাল-সন্ধ্যায় ও বিপদের সময়'),
     1, 'an-Nasa’i, as-Sunan al-Kubra; al-Hakim, al-Mustadrak', 'hasan', None),
    ('waking-up', ['waking'],
     tr('On waking up', 'ঘুম থেকে উঠে'),
     'الْحَمْدُ لِلَّهِ الَّذِي أَحْيَانَا بَعْدَ مَا أَمَاتَنَا وَإِلَيْهِ النُّشُورُ',
     tr('Alhamdu lillahil-ladhi ahyana ba‘da ma amatana wa ilayhin-nushur', 'আলহামদু লিল্লাহিল্লাযি আহইয়ানা বাদা মা আমাতানা ওয়া ইলাইহিন নুশুর'),
     tr('All praise is for Allah who gave us life after causing us to die, and to Him is the resurrection.', 'সব প্রশংসা আল্লাহর, যিনি আমাদের মৃত্যুর (ঘুমের) পর জীবিত করেছেন, আর তাঁর দিকেই পুনরুত্থান।'),
     tr('When you wake up', 'ঘুম থেকে জেগে'),
     1, 'Sahih al-Bukhari 6312', 'sahih', None),
    ('before-sleep', ['sleep'],
     tr('Before sleeping', 'ঘুমানোর আগে'),
     'بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا',
     tr('Bismika Allahumma amutu wa ahya', 'বিসমিকা আল্লাহুম্মা আমুতু ওয়া আহইয়া'),
     tr('In Your name, O Allah, I die and I live.', 'হে আল্লাহ, আপনার নামেই আমি মরি (ঘুমাই) ও জীবিত হই।'),
     tr('When lying down to sleep', 'শোয়ার সময়'),
     1, 'Sahih al-Bukhari 6324', 'sahih', None),
    ('sleep-qini-adhabak', ['sleep'],
     tr('Protect me from Your punishment', 'আপনার শাস্তি থেকে আমাকে রক্ষা করুন'),
     'اللَّهُمَّ قِنِي عَذَابَكَ يَوْمَ تَبْعَثُ عِبَادَكَ',
     tr('Allahumma qini ‘adhabaka yawma tab‘athu ‘ibadak', 'আল্লাহুম্মা কিনি আযাবাকা ইয়াওমা তাবআসু ইবাদাক'),
     tr('O Allah, protect me from Your punishment on the day You resurrect Your servants.', 'হে আল্লাহ, যেদিন আপনি আপনার বান্দাদের পুনরুত্থিত করবেন, সেদিন আমাকে আপনার শাস্তি থেকে রক্ষা করুন।'),
     tr('Lying on the right side, hand under the cheek', 'ডান কাতে শুয়ে, গালের নিচে হাত রেখে'),
     3, 'Sunan Abi Dawud 5045; Jami‘ at-Tirmidhi 3398', 'hasan', None),
    ('after-salah-istighfar', ['after-salah'],
     tr('Right after the salam', 'সালাম ফেরানোর পরপর'),
     'أَسْتَغْفِرُ اللَّهَ (ثَلَاثًا)، اللَّهُمَّ أَنْتَ السَّلَامُ وَمِنْكَ السَّلَامُ، تَبَارَكْتَ يَا ذَا الْجَلَالِ وَالْإِكْرَامِ',
     tr('Astaghfirullah (3 times). Allahumma antas-salam wa minkas-salam, tabarakta ya dhal-jalali wal-ikram',
        'আস্তাগফিরুল্লাহ (তিনবার)। আল্লাহুম্মা আনতাস সালাম, ওয়া মিনকাস সালাম, তাবারাকতা ইয়া যাল জালালি ওয়াল ইকরাম'),
     tr('I seek Allah’s forgiveness (three times). O Allah, You are Peace and from You is peace. Blessed are You, O Owner of majesty and honour.',
        'আমি আল্লাহর কাছে ক্ষমা চাই (তিনবার)। হে আল্লাহ, আপনিই শান্তি, আপনার কাছ থেকেই শান্তি। আপনি বরকতময়, হে মহিমা ও সম্মানের অধিকারী।'),
     tr('After every obligatory salah', 'প্রতি ফরজ নামাজের পর'),
     1, 'Sahih Muslim 591', 'sahih', None),
    ('after-salah-tahlil', ['after-salah'],
     tr('None can withhold what You give', 'আপনি যা দেন কেউ তা আটকাতে পারে না'),
     'لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ، اللَّهُمَّ لَا مَانِعَ لِمَا أَعْطَيْتَ، وَلَا مُعْطِيَ لِمَا مَنَعْتَ، وَلَا يَنْفَعُ ذَا الْجَدِّ مِنْكَ الْجَدُّ',
     tr('La ilaha illallahu wahdahu la sharika lah, lahul-mulku wa lahul-hamdu wa huwa ‘ala kulli shay’in qadir. Allahumma la mani‘a lima a‘tayt, wa la mu‘tiya lima mana‘t, wa la yanfa‘u dhal-jaddi minkal-jadd',
        'লা ইলাহা ইল্লাল্লাহু ওয়াহদাহু লা শারিকা লাহু, লাহুল মুলকু ওয়া লাহুল হামদু ওয়া হুওয়া আলা কুল্লি শাইয়িন কাদির। আল্লাহুম্মা লা মানিআ লিমা আতাইতা, ওয়ালা মুতিয়া লিমা মানাতা, ওয়ালা ইয়ানফাউ যাল জাদ্দি মিনকাল জাদ্দু'),
     tr('There is no god but Allah alone, without partner; His is the dominion and His the praise, and He has power over all things. O Allah, none can withhold what You give, none can give what You withhold, and no wealth or rank avails anyone against You.',
        'আল্লাহ ছাড়া কোনো উপাস্য নেই, তিনি এক, তাঁর কোনো শরিক নেই; রাজত্ব ও প্রশংসা তাঁরই, তিনি সবকিছুর ওপর ক্ষমতাবান। হে আল্লাহ, আপনি যা দেন তা কেউ আটকাতে পারে না, আর যা আটকান তা কেউ দিতে পারে না; আপনার কাছে কোনো সম্পদশালীর সম্পদ কাজে আসে না।'),
     tr('After every obligatory salah', 'প্রতি ফরজ নামাজের পর'),
     1, 'Sahih al-Bukhari 844; Sahih Muslim 593', 'sahih', None),
    ('after-salah-ainni', ['after-salah'],
     tr('Help me remember You', 'আপনার জিকিরে আমাকে সাহায্য করুন'),
     'اللَّهُمَّ أَعِنِّي عَلَى ذِكْرِكَ وَشُكْرِكَ وَحُسْنِ عِبَادَتِكَ',
     tr('Allahumma a‘inni ‘ala dhikrika wa shukrika wa husni ‘ibadatik', 'আল্লাহুম্মা আইন্নি আলা যিকরিকা ওয়া শুকরিকা ওয়া হুসনি ইবাদাতিক'),
     tr('O Allah, help me to remember You, to thank You, and to worship You well.', 'হে আল্লাহ, আপনার জিকির, শুকরিয়া ও সুন্দরভাবে ইবাদত করতে আমাকে সাহায্য করুন।'),
     tr('At the end of every salah', 'প্রতি নামাজের শেষে'),
     1, 'Sunan Abi Dawud 1522', 'sahih', None),
    ('leaving-home', ['home'],
     tr('Leaving home', 'ঘর থেকে বের হওয়ার সময়'),
     'بِسْمِ اللَّهِ، تَوَكَّلْتُ عَلَى اللَّهِ، وَلَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ',
     tr('Bismillah, tawakkaltu ‘alallah, wa la hawla wa la quwwata illa billah', 'বিসমিল্লাহি, তাওয়াক্কালতু আলাল্লাহ, ওয়ালা হাওলা ওয়ালা কুওয়াতা ইল্লা বিল্লাহ'),
     tr('In the name of Allah; I put my trust in Allah; there is no might nor power except with Allah.', 'আল্লাহর নামে; আমি আল্লাহর ওপর ভরসা করলাম; আল্লাহ ছাড়া কোনো শক্তি ও সামর্থ্য নেই।'),
     tr('When going out of the house', 'ঘর থেকে বের হওয়ার সময়'),
     1, 'Sunan Abi Dawud 5095; Jami‘ at-Tirmidhi 3426', 'sahih',
     tr('It is said to him: you are guided, sufficed and protected.', 'তাকে বলা হয়: তুমি হেদায়াত পেলে, যথেষ্ট হলে ও রক্ষা পেলে।')),
    ('before-eating', ['food'],
     tr('Before eating', 'খাওয়ার আগে'),
     'بِسْمِ اللَّهِ',
     tr('Bismillah (if you forget: Bismillahi awwalahu wa akhirah)', 'বিসমিল্লাহ (ভুলে গেলে: বিসমিল্লাহি আওয়ালাহু ওয়া আখিরাহ)'),
     tr('In the name of Allah. (If you forget at the start: In the name of Allah, at its beginning and its end.)', 'আল্লাহর নামে। (শুরুতে ভুলে গেলে: শুরু ও শেষে আল্লাহর নামে।)'),
     tr('Before starting to eat', 'খাওয়া শুরু করার আগে'),
     1, 'Sunan Abi Dawud 3767; Jami‘ at-Tirmidhi 1858', 'sahih', None),
    ('after-eating', ['food'],
     tr('After eating', 'খাওয়ার পর'),
     'الْحَمْدُ لِلَّهِ الَّذِي أَطْعَمَنِي هَذَا، وَرَزَقَنِيهِ مِنْ غَيْرِ حَوْلٍ مِنِّي وَلَا قُوَّةٍ',
     tr('Alhamdu lillahil-ladhi at‘amani hadha, wa razaqanihi min ghayri hawlin minni wa la quwwah',
        'আলহামদু লিল্লাহিল্লাযি আতআমানি হাযা, ওয়া রাযাকানিহি মিন গাইরি হাওলিম মিন্নি ওয়ালা কুওয়াহ'),
     tr('All praise is for Allah who fed me this and provided it for me without any might or power on my part.', 'সব প্রশংসা আল্লাহর, যিনি আমাকে এটি খাইয়েছেন এবং আমার কোনো শক্তি-সামর্থ্য ছাড়াই আমাকে এ রিজিক দিয়েছেন।'),
     tr('When you finish eating', 'খাওয়া শেষে'),
     1, 'Sunan Abi Dawud 4023; Jami‘ at-Tirmidhi 3458', 'hasan',
     tr('His previous sins are forgiven.', 'তার আগের গুনাহ ক্ষমা করা হয়।')),
    ('breaking-fast', ['food'],
     tr('On breaking the fast', 'ইফতারের সময়'),
     'ذَهَبَ الظَّمَأُ، وَابْتَلَّتِ الْعُرُوقُ، وَثَبَتَ الْأَجْرُ إِنْ شَاءَ اللَّهُ',
     tr('Dhahabaz-zama’u, wabtallatil-‘uruqu, wa thabatal-ajru in sha’ Allah', 'যাহাবাজ জামাউ, ওয়াবতাল্লাতিল উরুকু, ওয়া সাবাতাল আজরু ইনশাআল্লাহ'),
     tr('The thirst has gone, the veins are moistened, and the reward is certain, if Allah wills.', 'তৃষ্ণা দূর হলো, শিরাগুলো সিক্ত হলো, আর ইনশাআল্লাহ সওয়াব নিশ্চিত হলো।'),
     tr('After breaking the fast', 'ইফতারের পর'),
     1, 'Sunan Abi Dawud 2357', 'hasan', None),
    ('riding', ['travel', 'quran'],
     tr('When riding or setting off on a journey', 'যানবাহনে চড়ে বা সফর শুরু করে'),
     ayah('43:13', 11) + ' ' + ayah('43:14'),
     tr('Subhanal-ladhi sakhkhara lana hadha wa ma kunna lahu muqrinin, wa inna ila rabbina lamunqalibun',
        'সুবহানাল্লাযি সাখখারা লানা হাযা ওয়ামা কুন্না লাহু মুকরিনিন, ওয়া ইন্না ইলা রব্বিনা লামুনকালিবুন'),
     tr('Glory be to Him who has made this subservient to us, and we could not have done it ourselves; and to our Lord we will surely return.', 'পবিত্র তিনি, যিনি একে আমাদের অধীন করে দিয়েছেন, অথচ আমরা একে বশ করতে সক্ষম ছিলাম না; আর নিশ্চয়ই আমরা আমাদের রবের কাছে ফিরে যাব।'),
     tr('On a vehicle or mount, at the start of travel', 'যানবাহনে উঠে, সফরের শুরুতে'),
     1, 'Quran 43:13–14; Sahih Muslim 1342', 'quran', None),
    ('entering-masjid', ['masjid'],
     tr('Entering the masjid', 'মসজিদে প্রবেশের সময়'),
     'اللَّهُمَّ افْتَحْ لِي أَبْوَابَ رَحْمَتِكَ',
     tr('Allahummaf-tah li abwaba rahmatik', 'আল্লাহুম্মাফ তাহলি আবওয়াবা রহমাতিক'),
     tr('O Allah, open for me the doors of Your mercy.', 'হে আল্লাহ, আমার জন্য আপনার রহমতের দরজাগুলো খুলে দিন।'),
     tr('Entering with the right foot', 'ডান পা দিয়ে প্রবেশ করে'),
     1, 'Sahih Muslim 713', 'sahih', None),
    ('leaving-masjid', ['masjid'],
     tr('Leaving the masjid', 'মসজিদ থেকে বের হওয়ার সময়'),
     'اللَّهُمَّ إِنِّي أَسْأَلُكَ مِنْ فَضْلِكَ',
     tr('Allahumma inni as’aluka min fadlik', 'আল্লাহুম্মা ইন্নি আসআলুকা মিন ফাদলিক'),
     tr('O Allah, I ask You of Your bounty.', 'হে আল্লাহ, আমি আপনার অনুগ্রহ প্রার্থনা করি।'),
     tr('Leaving with the left foot', 'বাম পা দিয়ে বের হয়ে'),
     1, 'Sahih Muslim 713', 'sahih', None),
    ('before-wudu', ['wudu'],
     tr('Before wudu', 'অজুর শুরুতে'),
     'بِسْمِ اللَّهِ',
     tr('Bismillah', 'বিসমিল্লাহ'),
     tr('In the name of Allah.', 'আল্লাহর নামে।'),
     tr('At the start of wudu', 'অজুর শুরুতে'),
     1, 'Sunan Abi Dawud 101', 'hasan', None),
    ('after-wudu', ['wudu'],
     tr('After wudu', 'অজুর পর'),
     'أَشْهَدُ أَنْ لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، وَأَشْهَدُ أَنَّ مُحَمَّدًا عَبْدُهُ وَرَسُولُهُ',
     tr('Ashhadu an la ilaha illallahu wahdahu la sharika lah, wa ashhadu anna Muhammadan ‘abduhu wa rasuluh',
        'আশহাদু আল লা ইলাহা ইল্লাল্লাহু ওয়াহদাহু লা শারিকা লাহু, ওয়া আশহাদু আন্না মুহাম্মাদান আবদুহু ওয়া রাসুলুহ'),
     tr('I bear witness that there is no god but Allah alone, without partner, and I bear witness that Muhammad is His servant and Messenger.', 'আমি সাক্ষ্য দিচ্ছি যে আল্লাহ ছাড়া কোনো উপাস্য নেই, তিনি এক, তাঁর কোনো শরিক নেই; এবং সাক্ষ্য দিচ্ছি যে মুহাম্মাদ তাঁর বান্দা ও রাসুল।'),
     tr('On finishing wudu', 'অজু শেষ করে'),
     1, 'Sahih Muslim 234', 'sahih',
     tr('The eight gates of Paradise are opened for him; he may enter by whichever he wishes.', 'তার জন্য জান্নাতের আটটি দরজা খুলে দেওয়া হয়; যেটি দিয়ে ইচ্ছা প্রবেশ করবে।')),
    ('distress-karb', ['distress'],
     tr('In distress', 'বিপদ ও কষ্টের সময়'),
     'لَا إِلَهَ إِلَّا اللَّهُ الْعَظِيمُ الْحَلِيمُ، لَا إِلَهَ إِلَّا اللَّهُ رَبُّ الْعَرْشِ الْعَظِيمِ، لَا إِلَهَ إِلَّا اللَّهُ رَبُّ السَّمَاوَاتِ وَرَبُّ الْأَرْضِ وَرَبُّ الْعَرْشِ الْكَرِيمِ',
     tr('La ilaha illallahul-‘azimul-halim, la ilaha illallahu rabbul-‘arshil-‘azim, la ilaha illallahu rabbus-samawati wa rabbul-ardi wa rabbul-‘arshil-karim',
        'লা ইলাহা ইল্লাল্লাহুল আযিমুল হালিম, লা ইলাহা ইল্লাল্লাহু রব্বুল আরশিল আযিম, লা ইলাহা ইল্লাল্লাহু রব্বুস সামাওয়াতি ওয়া রব্বুল আরদি ওয়া রব্বুল আরশিল কারিম'),
     tr('There is no god but Allah, the Mighty, the Forbearing. There is no god but Allah, Lord of the mighty Throne. There is no god but Allah, Lord of the heavens, Lord of the earth and Lord of the noble Throne.',
        'আল্লাহ ছাড়া কোনো উপাস্য নেই, তিনি মহান, সহনশীল। আল্লাহ ছাড়া কোনো উপাস্য নেই, তিনি মহান আরশের রব। আল্লাহ ছাড়া কোনো উপাস্য নেই, তিনি আসমানসমূহের রব, জমিনের রব ও সম্মানিত আরশের রব।'),
     tr('When in hardship or distress', 'কঠিন সময় ও দুশ্চিন্তায়'),
     1, 'Sahih al-Bukhari 6346; Sahih Muslim 2730', 'sahih', None),
    ('dua-yunus', ['distress', 'forgiveness', 'quran'],
     tr('The supplication of Yunus (Jonah)', 'ইউনুস (আ.)-এর দোয়া'),
     ayah('21:87', 14),
     tr('La ilaha illa anta subhanaka inni kuntu minaz-zalimin', 'লা ইলাহা ইল্লা আনতা সুবহানাকা ইন্নি কুনতু মিনাজ জালিমিন'),
     tr('There is no god but You. Glory be to You! I have indeed been among the wrongdoers.', 'আপনি ছাড়া কোনো উপাস্য নেই, আপনি পবিত্র; নিশ্চয়ই আমি জালিমদের অন্তর্ভুক্ত ছিলাম।'),
     tr('In any difficulty', 'যেকোনো বিপদে'),
     1, 'Quran 21:87; Jami‘ at-Tirmidhi 3505', 'quran',
     tr('No Muslim calls upon Allah with it for anything except that Allah answers him.', 'কোনো মুসলিম এ দোয়া দিয়ে কিছু চাইলে আল্লাহ তার দোয়া কবুল করেন।')),
    ('worry-and-grief', ['distress'],
     tr('Against worry and grief', 'দুশ্চিন্তা ও দুঃখ থেকে আশ্রয়'),
     'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْهَمِّ وَالْحَزَنِ، وَالْعَجْزِ وَالْكَسَلِ، وَالْبُخْلِ وَالْجُبْنِ، وَضَلَعِ الدَّيْنِ وَغَلَبَةِ الرِّجَالِ',
     tr('Allahumma inni a‘udhu bika minal-hammi wal-hazan, wal-‘ajzi wal-kasal, wal-bukhli wal-jubn, wa dala‘id-dayni wa ghalabatir-rijal',
        'আল্লাহুম্মা ইন্নি আউযু বিকা মিনাল হাম্মি ওয়াল হাযান, ওয়াল আজযি ওয়াল কাসাল, ওয়াল বুখলি ওয়াল জুবন, ওয়া দালাইদ দাইনি ওয়া গালাবাতির রিজাল'),
     tr('O Allah, I seek refuge in You from worry and grief, from helplessness and laziness, from miserliness and cowardice, and from the burden of debt and being overpowered by people.',
        'হে আল্লাহ, আমি আপনার কাছে আশ্রয় চাই দুশ্চিন্তা ও দুঃখ থেকে, অক্ষমতা ও অলসতা থেকে, কৃপণতা ও কাপুরুষতা থেকে, এবং ঋণের বোঝা ও মানুষের দমন থেকে।'),
     tr('Any time, especially when worried', 'যেকোনো সময়, বিশেষত দুশ্চিন্তায়'),
     1, 'Sahih al-Bukhari 6369', 'sahih', None),
    ('hasbunallah', ['distress', 'quran'],
     tr('Allah is sufficient for us', 'আল্লাহই আমাদের জন্য যথেষ্ট'),
     ayah('3:173', 13),
     tr('Hasbunallahu wa ni‘mal-wakil', 'হাসবুনাল্লাহু ওয়া নিমাল ওয়াকিল'),
     tr('Allah is sufficient for us, and He is the best disposer of affairs.', 'আল্লাহই আমাদের জন্য যথেষ্ট, আর তিনি কতই না উত্তম কর্মবিধায়ক।'),
     tr('When afraid or facing a threat', 'ভয় বা বিপদের মুখে'),
     1, 'Quran 3:173; Sahih al-Bukhari 4563', 'quran', None),
    ('rabbighfir-li-wa-tub', ['forgiveness'],
     tr('Lord, forgive me and accept my repentance', 'হে রব, আমাকে ক্ষমা করুন ও তওবা কবুল করুন'),
     'رَبِّ اغْفِرْ لِي وَتُبْ عَلَيَّ، إِنَّكَ أَنْتَ التَّوَّابُ الرَّحِيمُ',
     tr('Rabbighfir li wa tub ‘alayya, innaka antat-tawwabur-rahim', 'রব্বিগফির লি ওয়া তুব আলাইয়া, ইন্নাকা আনতাত তাওয়াবুর রহিম'),
     tr('My Lord, forgive me and accept my repentance; You are the Accepter of repentance, the Most Merciful.', 'হে আমার রব, আমাকে ক্ষমা করুন ও আমার তওবা কবুল করুন; নিশ্চয়ই আপনি তওবা কবুলকারী, পরম দয়ালু।'),
     tr('Often; the Prophet ﷺ was heard saying it a hundred times in one sitting', 'বেশি বেশি; নবী ﷺ এক বৈঠকে একশবার বলতেন'),
     100, 'Sunan Abi Dawud 1516; Jami‘ at-Tirmidhi 3434', 'sahih', None),
    ('rabbana-zalamna', ['forgiveness', 'quran'],
     tr('The supplication of Adam and Hawwa', 'আদম ও হাওয়া (আ.)-এর দোয়া'),
     ayah('7:23', 1),
     tr('Rabbana zalamna anfusana wa in lam taghfir lana wa tarhamna lanakunanna minal-khasirin', 'রব্বানা জালামনা আনফুসানা ওয়া ইল্লাম তাগফির লানা ওয়া তারহামনা লানাকুনান্না মিনাল খাসিরিন'),
     tr('Our Lord, we have wronged ourselves; if You do not forgive us and have mercy on us, we will surely be among the losers.', 'হে আমাদের রব, আমরা নিজেদের ওপর জুলুম করেছি; আপনি যদি আমাদের ক্ষমা না করেন ও দয়া না করেন, তবে অবশ্যই আমরা ক্ষতিগ্রস্তদের অন্তর্ভুক্ত হব।'),
     tr('When asking forgiveness', 'ক্ষমা চাওয়ার সময়'),
     1, 'Quran 7:23', 'quran', None),
    ('rabbana-atina', ['quran', 'after-salah'],
     tr('Good in this world and the Hereafter', 'দুনিয়া ও আখিরাতের কল্যাণ'),
     ayah('2:201', 3),
     tr('Rabbana atina fid-dunya hasanatan wa fil-akhirati hasanatan wa qina ‘adhaban-nar', 'রব্বানা আতিনা ফিদ দুনইয়া হাসানাতান ওয়া ফিল আখিরাতি হাসানাতান ওয়া কিনা আযাবান নার'),
     tr('Our Lord, give us good in this world and good in the Hereafter, and protect us from the punishment of the Fire.', 'হে আমাদের রব, আমাদের দুনিয়াতে কল্যাণ দিন, আখিরাতেও কল্যাণ দিন, এবং আমাদের জাহান্নামের আজাব থেকে রক্ষা করুন।'),
     tr('Any time; the Prophet ﷺ said it most often', 'যেকোনো সময়; নবী ﷺ এটি সবচেয়ে বেশি পড়তেন'),
     1, 'Quran 2:201; Sahih al-Bukhari 6389', 'quran', None),
    ('rabbana-la-tuakhidhna', ['quran'],
     tr('Do not burden us beyond our strength', 'আমাদের সাধ্যের বাইরে বোঝা দেবেন না'),
     ayah('2:286', 14),
     tr('Rabbana la tu’akhidhna in nasina aw akhta’na…', 'রব্বানা লা তুআখিযনা ইন নাসিনা আও আখতানা…'),
     tr('Our Lord, do not take us to task if we forget or err. Our Lord, do not place on us a burden like that You placed on those before us. Our Lord, do not burden us with what we cannot bear. Pardon us, forgive us and have mercy on us. You are our Protector, so help us against the disbelieving people.',
        'হে আমাদের রব, আমরা ভুলে গেলে বা ভুল করলে আমাদের পাকড়াও করবেন না। হে আমাদের রব, আমাদের ওপর এমন বোঝা চাপাবেন না যেমন আমাদের পূর্ববর্তীদের ওপর চাপিয়েছিলেন। হে আমাদের রব, যা বহনের সাধ্য আমাদের নেই তা আমাদের ওপর চাপাবেন না। আমাদের মাফ করুন, ক্ষমা করুন ও দয়া করুন। আপনিই আমাদের অভিভাবক; সুতরাং কাফির সম্প্রদায়ের বিরুদ্ধে আমাদের সাহায্য করুন।'),
     tr('At night (the last two ayahs of al-Baqarah)', 'রাতে (সূরা বাকারার শেষ দুই আয়াত)'),
     1, 'Quran 2:286; Sahih al-Bukhari 5009', 'quran',
     tr('Whoever recites the last two ayahs of al-Baqarah at night, they suffice him.', 'রাতে সূরা বাকারার শেষ দুই আয়াত পড়লে তা তার জন্য যথেষ্ট হয়।')),
    ('rabbana-la-tuzigh', ['quran'],
     tr('Keep our hearts steady', 'আমাদের অন্তর অবিচল রাখুন'),
     ayah('3:8'),
     tr('Rabbana la tuzigh qulubana ba‘da idh hadaytana wa hab lana min ladunka rahmah, innaka antal-wahhab', 'রব্বানা লা তুযিগ কুলুবানা বাদা ইয হাদাইতানা ওয়া হাবলানা মিল্লাদুনকা রহমাহ, ইন্নাকা আনতাল ওয়াহহাব'),
     tr('Our Lord, do not let our hearts deviate after You have guided us, and grant us mercy from Yourself. You are the Bestower.', 'হে আমাদের রব, হেদায়াত দেওয়ার পর আমাদের অন্তরকে বাঁকা করবেন না, এবং আপনার পক্ষ থেকে আমাদের রহমত দান করুন; নিশ্চয়ই আপনি মহাদাতা।'),
     tr('Any time', 'যেকোনো সময়'),
     1, 'Quran 3:8', 'quran', None),
    ('rabbana-ighfir-li-wa-liwalidayya', ['quran', 'forgiveness'],
     tr('Forgiveness for me, my parents and the believers', 'আমার, বাবা-মা ও মুমিনদের জন্য ক্ষমা'),
     ayah('14:41'),
     tr('Rabbanagh-fir li wa li walidayya wa lil-mu’minina yawma yaqumul-hisab', 'রব্বানাগফির লি ওয়ালি ওয়ালিদাইয়া ওয়ালিল মুমিনিনা ইয়াওমা ইয়াকুমুল হিসাব'),
     tr('Our Lord, forgive me, my parents and the believers on the Day the reckoning is established.', 'হে আমাদের রব, যেদিন হিসাব প্রতিষ্ঠিত হবে, সেদিন আমাকে, আমার বাবা-মাকে ও সব মুমিনকে ক্ষমা করুন।'),
     tr('Any time', 'যেকোনো সময়'),
     1, 'Quran 14:41', 'quran', None),
    ('rabbir-hamhuma', ['quran'],
     tr('For one’s parents', 'বাবা-মায়ের জন্য দোয়া'),
     ayah('17:24', 7),
     tr('Rabbir-hamhuma kama rabbayani saghira', 'রব্বির হামহুমা কামা রব্বায়ানি সাগিরা'),
     tr('My Lord, have mercy on them as they raised me when I was small.', 'হে আমার রব, তাঁদের প্রতি দয়া করুন, যেমন তাঁরা শৈশবে আমাকে লালন-পালন করেছেন।'),
     tr('Any time', 'যেকোনো সময়'),
     1, 'Quran 17:24', 'quran', None),
    ('rabbish-rahli-sadri', ['quran'],
     tr('The supplication of Musa (Moses)', 'মুসা (আ.)-এর দোয়া'),
     ayahs(20, 25, 28, 1),
     tr('Rabbish-rahli sadri, wa yassirli amri, wahlul ‘uqdatam-mil-lisani, yafqahu qawli', 'রব্বিশ রহলি সাদরি, ওয়া ইয়াসসিরলি আমরি, ওয়াহলুল উকদাতাম মিল লিসানি, ইয়াফকাহু কাওলি'),
     tr('My Lord, expand my chest for me, make my task easy for me, and untie the knot from my tongue so they may understand my speech.', 'হে আমার রব, আমার বক্ষ প্রশস্ত করে দিন, আমার কাজ সহজ করে দিন, এবং আমার জিহ্বার জড়তা দূর করে দিন, যাতে তারা আমার কথা বুঝতে পারে।'),
     tr('Before studying, speaking or a difficult task', 'পড়াশোনা, কথা বলা বা কঠিন কাজের আগে'),
     1, 'Quran 20:25–28', 'quran', None),
    ('rabbi-zidni-ilma', ['quran'],
     tr('Increase me in knowledge', 'আমার জ্ঞান বাড়িয়ে দিন'),
     ayah('20:114', 16),
     tr('Rabbi zidni ‘ilma', 'রব্বি যিদনি ইলমা'),
     tr('My Lord, increase me in knowledge.', 'হে আমার রব, আমার জ্ঞান বৃদ্ধি করে দিন।'),
     tr('Before and while learning', 'শেখার আগে ও শেখার সময়'),
     1, 'Quran 20:114', 'quran', None),
    ('rabbighfir-warham', ['quran', 'forgiveness'],
     tr('Forgive and have mercy', 'ক্ষমা করুন ও দয়া করুন'),
     ayah('23:118', 1),
     tr('Rabbighfir warham wa anta khayrur-rahimin', 'রব্বিগফির ওয়ারহাম ওয়া আনতা খাইরুর রহিমিন'),
     tr('My Lord, forgive and have mercy, for You are the best of those who show mercy.', 'হে আমার রব, ক্ষমা করুন ও দয়া করুন; আপনিই শ্রেষ্ঠ দয়ালু।'),
     tr('Any time', 'যেকোনো সময়'),
     1, 'Quran 23:118', 'quran', None),
    ('rabbana-hab-lana', ['quran'],
     tr('For spouses and children', 'স্বামী/স্ত্রী ও সন্তানের জন্য'),
     ayah('25:74', 2),
     tr('Rabbana hab lana min azwajina wa dhurriyyatina qurrata a‘yunin waj‘alna lil-muttaqina imama', 'রব্বানা হাবলানা মিন আযওয়াজিনা ওয়া যুররিয়্যাতিনা কুররাতা আইউনিও ওয়াজআলনা লিলমুত্তাকিনা ইমামা'),
     tr('Our Lord, grant us in our spouses and children the comfort of our eyes, and make us leaders of the righteous.', 'হে আমাদের রব, আমাদের স্ত্রী ও সন্তানদের আমাদের চোখের শীতলতা বানিয়ে দিন, এবং আমাদের মুত্তাকিদের নেতা বানিয়ে দিন।'),
     tr('Any time', 'যেকোনো সময়'),
     1, 'Quran 25:74', 'quran', None),
    ('rabbi-inni-lima-anzalta', ['quran', 'distress'],
     tr('In need of Your good', 'আপনার কল্যাণের মুখাপেক্ষী'),
     ayah('28:24', 7),
     tr('Rabbi inni lima anzalta ilayya min khayrin faqir', 'রব্বি ইন্নি লিমা আনযালতা ইলাইয়া মিন খাইরিন ফাকির'),
     tr('My Lord, I am in need of whatever good You send down to me.', 'হে আমার রব, আপনি আমার প্রতি যে কল্যাণই নাজিল করবেন, আমি তার মুখাপেক্ষী।'),
     tr('When in need of provision or work', 'রিজিক বা কাজের প্রয়োজনে'),
     1, 'Quran 28:24', 'quran', None),
]

NEW_CATEGORIES = [
    ('quran', tr('Duas from the Quran', 'কুরআনের দোয়া', 'أدعية من القرآن'), 'book-open', 0),
]

# --- Tasbih presets (in addition to the five from 075) ----------------------
DHIKR = [
    ('subhanallah-wa-bihamdihi', 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ', tr('SubhanAllahi wa bihamdihi', 'সুবহানাল্লাহি ওয়া বিহামদিহি'),
     tr('Glory be to Allah and praise be to Him', 'আল্লাহ পবিত্র, সব প্রশংসা তাঁর'), 100,
     tr('Said a hundred times a day, sins are wiped away even if they are like the foam of the sea.', 'দিনে একশবার বললে সমুদ্রের ফেনার মতো গুনাহও মাফ হয়ে যায়।'), 'Sahih al-Bukhari 6405', 6),
    ('subhanallahil-azim', 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، سُبْحَانَ اللَّهِ الْعَظِيمِ',
     tr('SubhanAllahi wa bihamdihi, SubhanAllahil-‘Azim', 'সুবহানাল্লাহি ওয়া বিহামদিহি, সুবহানাল্লাহিল আযিম'),
     tr('Glory and praise be to Allah; glory be to Allah, the Almighty', 'আল্লাহ পবিত্র ও প্রশংসিত; মহান আল্লাহ পবিত্র'), 33,
     tr('Two phrases light on the tongue, heavy on the Scale, beloved to the Most Merciful.', 'দুটি বাক্য জিহ্বায় হালকা, মিজানে ভারী, দয়াময়ের কাছে প্রিয়।'), 'Sahih al-Bukhari 6406; Sahih Muslim 2694', 7),
    ('la-hawla', 'لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ', tr('La hawla wa la quwwata illa billah', 'লা হাওলা ওয়ালা কুওয়াতা ইল্লা বিল্লাহ'),
     tr('There is no might nor power except with Allah', 'আল্লাহ ছাড়া কোনো শক্তি ও সামর্থ্য নেই'), 33,
     tr('A treasure from the treasures of Paradise.', 'জান্নাতের ধনভাণ্ডারগুলোর একটি।'), 'Sahih al-Bukhari 6384; Sahih Muslim 2704', 8),
    ('salawat', 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ', tr('Allahumma salli ‘ala Muhammad', 'আল্লাহুম্মা সাল্লি আলা মুহাম্মাদ'),
     tr('O Allah, send blessings upon Muhammad', 'হে আল্লাহ, মুহাম্মাদের ওপর রহমত বর্ষণ করুন'), 10,
     tr('Whoever sends one blessing upon the Prophet ﷺ, Allah sends ten upon him.', 'যে নবী ﷺ-এর ওপর একবার দরুদ পড়ে, আল্লাহ তার ওপর দশবার রহমত বর্ষণ করেন।'), 'Sahih Muslim 408', 9),
    ('tahlil-full', 'لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ',
     tr('La ilaha illallahu wahdahu la sharika lah, lahul-mulku wa lahul-hamdu wa huwa ‘ala kulli shay’in qadir', 'লা ইলাহা ইল্লাল্লাহু ওয়াহদাহু লা শারিকা লাহু, লাহুল মুলকু ওয়া লাহুল হামদু ওয়া হুওয়া আলা কুল্লি শাইয়িন কাদির'),
     tr('There is no god but Allah alone, without partner; His is the dominion and the praise, and He has power over all things', 'আল্লাহ ছাড়া কোনো উপাস্য নেই, তিনি এক, শরিকহীন; রাজত্ব ও প্রশংসা তাঁরই, তিনি সবকিছুর ওপর ক্ষমতাবান'), 100,
     tr('A hundred times a day equals freeing ten slaves; a hundred good deeds are written and a hundred sins erased, and it is a protection from Shaytan that day.', 'দিনে একশবার বললে দশজন দাস মুক্ত করার সওয়াব, একশ নেকি লেখা হয়, একশ গুনাহ মোছা হয় এবং সেদিন শয়তান থেকে সুরক্ষা।'), 'Sahih al-Bukhari 3293; Sahih Muslim 2691', 10),
]

# --- Regions: country defaults for the prayer-time calculation -----------
# code, name, method, madhab, lat, lng, city, timezone
REGIONS = [
    ('SA', tr('Saudi Arabia', 'সৌদি আরব', 'السعودية'), 'UmmAlQura', 'shafi', 21.4225, 39.8262, tr('Makkah', 'মক্কা', 'مكة'), 'Asia/Riyadh'),
    ('AE', tr('United Arab Emirates', 'সংযুক্ত আরব আমিরাত', 'الإمارات'), 'Dubai', 'shafi', 25.2048, 55.2708, tr('Dubai', 'দুবাই', 'دبي'), 'Asia/Dubai'),
    ('QA', tr('Qatar', 'কাতার', 'قطر'), 'Qatar', 'shafi', 25.2854, 51.5310, tr('Doha', 'দোহা', 'الدوحة'), 'Asia/Qatar'),
    ('KW', tr('Kuwait', 'কুয়েত', 'الكويت'), 'Kuwait', 'shafi', 29.3759, 47.9774, tr('Kuwait City', 'কুয়েত সিটি', 'مدينة الكويت'), 'Asia/Kuwait'),
    ('OM', tr('Oman', 'ওমান', 'عُمان'), 'MuslimWorldLeague', 'shafi', 23.5880, 58.3829, tr('Muscat', 'মাসকাট', 'مسقط'), 'Asia/Muscat'),
    ('MY', tr('Malaysia', 'মালয়েশিয়া', 'ماليزيا'), 'Singapore', 'shafi', 3.1390, 101.6869, tr('Kuala Lumpur', 'কুয়ালালামপুর', 'كوالالمبور'), 'Asia/Kuala_Lumpur'),
    ('SG', tr('Singapore', 'সিঙ্গাপুর', 'سنغافورة'), 'Singapore', 'shafi', 1.3521, 103.8198, tr('Singapore', 'সিঙ্গাপুর', 'سنغافورة'), 'Asia/Singapore'),
    ('PK', tr('Pakistan', 'পাকিস্তান', 'باكستان'), 'Karachi', 'hanafi', 24.8607, 67.0011, tr('Karachi', 'করাচি', 'كراتشي'), 'Asia/Karachi'),
    ('IN', tr('India', 'ভারত', 'الهند'), 'Karachi', 'hanafi', 28.6139, 77.2090, tr('Delhi', 'দিল্লি', 'دلهي'), 'Asia/Kolkata'),
    ('TR', tr('Türkiye', 'তুরস্ক', 'تركيا'), 'Turkey', 'hanafi', 41.0082, 28.9784, tr('Istanbul', 'ইস্তাম্বুল', 'إسطنبول'), 'Europe/Istanbul'),
    ('EG', tr('Egypt', 'মিশর', 'مصر'), 'Egyptian', 'shafi', 30.0444, 31.2357, tr('Cairo', 'কায়রো', 'القاهرة'), 'Africa/Cairo'),
    ('GB', tr('United Kingdom', 'যুক্তরাজ্য', 'المملكة المتحدة'), 'MoonsightingCommittee', 'shafi', 51.5072, -0.1276, tr('London', 'লন্ডন', 'لندن'), 'Europe/London'),
    ('US', tr('United States', 'যুক্তরাষ্ট্র', 'الولايات المتحدة'), 'NorthAmerica', 'shafi', 40.7128, -74.0060, tr('New York', 'নিউ ইয়র্ক', 'نيويورك'), 'America/New_York'),
    ('CA', tr('Canada', 'কানাডা', 'كندا'), 'NorthAmerica', 'shafi', 43.6532, -79.3832, tr('Toronto', 'টরন্টো', 'تورنتو'), 'America/Toronto'),
]

# --- More events (075 has the main ones) -----------------------------------------
EVENTS = [
    ('last-ten-nights', tr('Last ten nights of Ramadan', 'রমজানের শেষ দশ রাত', 'العشر الأواخر'), 'night', 9, 21, 10, 1, 35),
    ('first-ten-dhul-hijjah', tr('First ten days of Dhul Hijjah', 'জিলহজের প্রথম দশ দিন', 'عشر ذي الحجة'), 'other', 12, 1, 10, 1, 55),
    ('days-of-tashriq', tr('Days of Tashriq', 'আইয়ামে তাশরিক', 'أيام التشريق'), 'eid', 12, 11, 3, None, 85),
]

# Ayah of the day (075/076 already have ten); refs only, the text is in the app.
DAILY = ['2:153', '20:46', '3:139', '3:159', '3:191', '4:103', '6:162', '9:51', '13:11', '14:7', '16:97', '16:128',
         '17:80', '18:10', '23:1', '25:63', '29:45', '29:69', '33:41', '33:56', '39:10', '40:60', '42:30', '49:10',
         '49:13', '51:56', '55:13', '57:4', '64:11', '65:2', '67:2', '93:5', '94:6', '103:2', '112:1', '2:45',
         '2:197', '3:31', '3:200', '8:2', '11:115', '24:35', '30:21', '31:17', '35:15', '47:7', '50:16', '59:18',
         '73:20', '99:7']

CHECKLIST = [
    ('daily', tr('Sunnah prayers', 'সুন্নত নামাজ'), 4),
    ('daily', tr('Witr', 'বিতর'), 5),
    ('daily', tr('Istighfar 100 times', '১০০ বার ইস্তিগফার'), 6),
    ('daily', tr('Read a dua before sleeping', 'ঘুমানোর আগে দোয়া'), 7),
    ('ramadan', tr('Iftar dua', 'ইফতারের দোয়া'), 6),
    ('ramadan', tr('Night prayer in the last ten nights', 'শেষ দশ রাতে কিয়ামুল লাইল'), 7),
]

HADITH_BOOKS = [
    ('bukhari', tr('Sahih al-Bukhari', 'সহিহ বুখারি', 'صحيح البخاري'), tr('Imam al-Bukhari', 'ইমাম বুখারি', 'الإمام البخاري'), 1),
    ('muslim', tr('Sahih Muslim', 'সহিহ মুসলিম', 'صحيح مسلم'), tr('Imam Muslim', 'ইমাম মুসলিম', 'الإمام مسلم'), 2),
    ('abudawud', tr('Sunan Abi Dawud', 'সুনানে আবু দাউদ', 'سنن أبي داود'), tr('Imam Abu Dawud', 'ইমাম আবু দাউদ', 'الإمام أبو داود'), 3),
    ('tirmidhi', tr('Jami‘ at-Tirmidhi', 'জামে তিরমিজি', 'جامع الترمذي'), tr('Imam at-Tirmidhi', 'ইমাম তিরমিজি', 'الإمام الترمذي'), 4),
    ('nasai', tr('Sunan an-Nasa’i', 'সুনানে নাসায়ি', 'سنن النسائي'), tr('Imam an-Nasa’i', 'ইমাম নাসায়ি', 'الإمام النسائي'), 5),
    ('ibnmajah', tr('Sunan Ibn Majah', 'সুনানে ইবনে মাজাহ', 'سنن ابن ماجه'), tr('Imam Ibn Majah', 'ইমাম ইবনে মাজাহ', 'الإمام ابن ماجه'), 6),
]


def build() -> str:
    out = ["""-- Islamic Studio starting content. Generated by islamic_studio_content.py; edit that, not this.
-- Run in the Supabase SQL editor after migrations 074–076. Safe to run again:
-- nothing existing is overwritten or deleted.
--
-- Duas and tasbih presets go in as 'in_review': the app shows them only after
-- a reviewer checks each one and approves it in batools → Content Review.
-- Quranic Arabic is copied word-for-word from the app's bundled Tanzil text;
-- hadith Arabic, transliterations and both translations were written for
-- Islamic Studio and need that review.

BEGIN;
"""]

    out.append('-- New dua category')
    for slug, name, icon, order in NEW_CATEGORIES:
        out.append(f"INSERT INTO is_dua_categories (slug, name, icon, sort_order) VALUES ({sql(slug)}, {sql(name)}, {sql(icon)}, {order}) ON CONFLICT (slug) DO NOTHING;")

    out.append('\n-- Duas')
    for order, (slug, cats, title, arabic, translit, meaning, when, times, source, grade, virtue) in enumerate(DUAS, 1):
        did = uuid.uuid5(NS, 'dua:' + slug)
        out.append(
            'INSERT INTO is_duas (id, title, arabic, transliteration, translation, virtue, when_to_read, repeat_count, source_ref, grade, review_status) VALUES ('
            f"{sql(str(did))}, {sql(title)}, {sql(arabic)}, {sql(translit)}, {sql(meaning)}, {sql(virtue or {})}, {sql(when)}, {times}, {sql(source)}, {sql(grade)}, 'in_review') "
            'ON CONFLICT (id) DO NOTHING;')
        for cat in cats:
            out.append(
                'INSERT INTO is_dua_category_items (category_id, dua_id, sort_order) '
                f"SELECT id, {sql(str(did))}, {order} FROM is_dua_categories WHERE slug = {sql(cat)} ON CONFLICT DO NOTHING;")

    out.append('\n-- Tasbih presets')
    for slug, arabic, translit, meaning, target, virtue, source, order in DHIKR:
        pid = uuid.uuid5(NS, 'dhikr:' + slug)
        out.append(
            'INSERT INTO is_dhikr_presets (id, arabic, transliteration, translation, default_target, virtue, source_ref, review_status, sort_order) VALUES ('
            f"{sql(str(pid))}, {sql(arabic)}, {sql(translit)}, {sql(meaning)}, {target}, {sql(virtue)}, {sql(source)}, 'in_review', {order}) "
            'ON CONFLICT (id) DO NOTHING;')

    out.append('\n-- Regions (prayer-time defaults per country)')
    for i, (code, name, method, madhab, lat, lng, city, tz) in enumerate(REGIONS, 10):
        out.append(
            'INSERT INTO is_prayer_regions (code, name, calc_method, madhab, default_lat, default_lng, default_city, timezone, sort_order) VALUES ('
            f"{sql(code)}, {sql(name)}, {sql(method)}, {sql(madhab)}, {lat}, {lng}, {sql(city)}, {sql(tz)}, {i}) ON CONFLICT (code) DO NOTHING;")

    out.append('\n-- Islamic events')
    for slug, name, kind, month, day, days, remind, order in EVENTS:
        eid = uuid.uuid5(NS, 'event:' + slug)
        out.append(
            'INSERT INTO is_islamic_events (id, name, kind, hijri_month, hijri_day, duration_days, remind_days_before, sort_order) VALUES ('
            f"{sql(str(eid))}, {sql(name)}, {sql(kind)}, {month}, {day}, {days}, {sql(remind)}, {order}) ON CONFLICT (id) DO NOTHING;")

    out.append('\n-- Ayah of the day (rotation)')
    for i, ref in enumerate(DAILY, 11):
        out.append(
            f"INSERT INTO is_daily_items (kind, ref, sort_order) SELECT 'ayah', {sql(ref)}, {i} "
            f"WHERE NOT EXISTS (SELECT 1 FROM is_daily_items WHERE kind = 'ayah' AND ref = {sql(ref)});")

    out.append('\n-- Checklist items')
    for context, text, order in CHECKLIST:
        out.append(
            f"INSERT INTO is_checklist_items (context, text, sort_order) SELECT {sql(context)}, {sql(text)}, {order} "
            f"WHERE NOT EXISTS (SELECT 1 FROM is_checklist_items WHERE context = {sql(context)} AND text ->> 'en' = {sql(text['en'])});")

    out.append('\n-- Hadith books (used once Hadith Library is built; their text comes as licensed packs)')
    for slug, name, compiler, order in HADITH_BOOKS:
        out.append(
            f"INSERT INTO is_hadith_collections (slug, name, compiler, sort_order) VALUES ({sql(slug)}, {sql(name)}, {sql(compiler)}, {order}) ON CONFLICT (slug) DO NOTHING;")

    out.append('\n-- Welcome announcement')
    aid = uuid.uuid5(NS, 'announcement:welcome-2.0')
    out.append(
        'INSERT INTO is_announcements (id, title, body, placement, priority) VALUES ('
        f"{sql(str(aid))}, {sql(tr('Welcome to the new Islamic Studio', 'নতুন ইসলামিক স্টুডিওতে স্বাগতম', 'مرحبًا بكم في استوديو إسلامي الجديد'))}, "
        f"{sql(tr('Prayer times with reminders, Qibla, tasbih, duas, the Hijri calendar and the full Quran, now working offline. More features are on the way, in sha Allah.', 'রিমাইন্ডারসহ নামাজের সময়, কিবলা, তাসবিহ, দোয়া, হিজরি ক্যালেন্ডার ও পূর্ণ কুরআন, এখন অফলাইনেও। ইনশাআল্লাহ আরও ফিচার আসছে।'))}, "
        "'home', 10) ON CONFLICT (id) DO NOTHING;")

    out.append("""
COMMIT;

-- What is waiting for review now:
SELECT 'duas in review' AS what, count(*) FROM is_duas WHERE review_status = 'in_review'
UNION ALL SELECT 'tasbih presets in review', count(*) FROM is_dhikr_presets WHERE review_status = 'in_review'
UNION ALL SELECT 'regions', count(*) FROM is_prayer_regions
UNION ALL SELECT 'ayahs of the day', count(*) FROM is_daily_items;
""")
    return '\n'.join(out)


if __name__ == '__main__':
    OUT.write_text(build())
    print(f'✔ {OUT.name}: {len(DUAS)} duas, {len(DHIKR)} tasbih presets, {len(REGIONS)} regions, {len(EVENTS)} events, {len(DAILY)} ayahs of the day')
