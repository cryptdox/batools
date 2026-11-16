#!/usr/bin/env python3
"""
Writes islamic_studio_learn_part*.sql: the Islamic Academy (migrations 079
and 085) in English and Bangla: categories → sections → units → lessons → items.

  * Two hand-written units (Foundations of Iman, Purity & Salah) with every item
    type.
  * One unit per quiz of the quiz bank (quizbank_*.py, islamic_studio_phase2.py):
    its questions not already used above, in short lessons and a review.
  * Short-surah units generated from the app's bundled Tanzil Uthmani text
    (islamic-studio-app/public/quran/quran.json, or the path in QURAN_JSON):
    word order, fill the blank, ayah order, which surah. Quran text is never
    typed by hand.

Units go in as 'in_review': approve them in batools → Content Review (the last
part has an optional statement that approves them all at once).
Re-runnable: fixed ids, nothing existing is overwritten.

    python3 islamic_studio_learn.py
"""
import json
import os
import sys
import uuid
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from quizbank_a import Q, QUIZZES as PART_A  # noqa: E402
from quizbank_b import QUIZZES as PART_B  # noqa: E402
from quizbank_c import QUIZZES as PART_C  # noqa: E402
from quizbank_d import QUIZZES as PART_D  # noqa: E402
from islamic_studio_phase2 import QUIZZES as PHASE2  # noqa: E402
from islamic_studio_quizbank import sql  # noqa: E402

OUT = HERE / 'islamic_studio_learn_part{}.sql'
PART_BYTES = 450_000   # the Supabase SQL editor handles files of this size comfortably
NS = uuid.UUID('6f1c1b8e-6c2a-4d4e-9a57-1d2c3b4a5e60')
QURAN_JSON = Path(os.environ.get('QURAN_JSON', HERE.parents[3] / 'islamic-studio-app' / 'public' / 'quran' / 'quran.json'))

BANK = {q[0]: q[5] for q in PART_A + PART_B + PART_C + PART_D + PHASE2}
SURAHS = {s['n']: s for s in json.loads(QURAN_JSON.read_text())['surahs']}


def uid(kind: str, key: str) -> str:
    return str(uuid.uuid5(NS, f'learn-{kind}:{key}'))


def ayah(surah: int, n: int) -> str:
    return SURAHS[surah]['ayahs'][n - 1]


def AR(text: str) -> dict:
    return {'ar': text}


# Items: (type, prompt, data, explanation, source) -----------------------------

USED: set[tuple[str, int]] = set()


def bank(slug: str, n: int):
    """Question n (0-based) of a quiz in the bank, as a multiple-choice item."""
    USED.add((slug, n))
    question, answers, correct, explanation, source = BANK[slug][n]
    return ('choice', question, {'options': answers, 'correct': correct}, explanation, source)


def choice(question, answers, correct, explanation, source=None):
    return ('choice', question, {'options': answers, 'correct': correct}, explanation, source)


def tf(statement, answer: bool, explanation, source=None):
    return ('true_false', statement, {'answer': answer}, explanation, source)


def match(pairs, explanation=None, source=None, prompt=None):
    return ('match', prompt or {}, {'pairs': [{'left': a, 'right': b} for a, b in pairs]}, explanation or {}, source)


def order(prompt, pieces, explanation, source=None, rtl=False):
    return ('order', prompt, {'pieces': pieces, 'rtl': rtl}, explanation, source)


def ayah_order(surah: int, n: int, meaning):
    """Put the words of an ayah in order."""
    words = ayah(surah, n).split()
    assert len(set(words)) == len(words), 'repeated word: the order would be ambiguous'
    return order(Q('Put the words of this ayah in order', 'আয়াতের শব্দগুলো সাজান'), [AR(w) for w in words], meaning,
                 f'Quran {surah}:{n}', rtl=True)


def ayah_fill(surah: int, n: int, word: int, distractors: list[tuple[int, int, int]], meaning):
    """Fill in word `word` (0-based; -1 = last) of an ayah; the wrong choices are words of other ayahs."""
    words = ayah(surah, n).split()
    word %= len(words)
    options = [words[word]] + [ayah(s, a).split()[w] for s, a, w in distractors]
    assert len(set(options)) == len(options), 'a wrong choice equals the answer'
    data = {'before': AR(' '.join(words[:word])), 'after': AR(' '.join(words[word + 1:])),
            'options': [AR(o) for o in options], 'correct': 0, 'rtl': True}
    if not data['before']['ar']:
        del data['before']
    if not data['after']['ar']:
        del data['after']
    return ('fill', Q('Complete the ayah', 'আয়াতটি পূর্ণ করুন'), data, meaning, f'Quran {surah}:{n}')


# The path ---------------------------------------------------------------------

UNITS = [
    ('iman', Q('Foundations of Iman', 'ঈমানের ভিত্তি'), Q('The six pillars, Allah’s names, the angels and the Last Day.', 'ছয় স্তম্ভ, আল্লাহর নাম, ফেরেশতা ও শেষ দিবস।'),
     '#44bd32', 'sparkles', [
        ('pillars', Q('The six pillars', 'ছয়টি স্তম্ভ'), 'lesson', [
            bank('six-pillars-of-iman', 0),
            order(Q('Put the pillars of iman in the order of the hadith of Jibril', 'হাদিসে জিবরিলের ক্রমে ঈমানের স্তম্ভগুলো সাজান'),
                  [Q('Allah', 'আল্লাহ'), Q('His angels', 'তাঁর ফেরেশতাগণ'), Q('His books', 'তাঁর কিতাবসমূহ'), Q('His messengers', 'তাঁর রাসুলগণ'),
                   Q('The Last Day', 'শেষ দিবস'), Q('The decree (qadar)', 'তাকদির')],
                  Q('"That you believe in Allah, His angels, His books, His messengers and the Last Day, and believe in the decree, its good and its bad."',
                    '"আল্লাহ, তাঁর ফেরেশতা, কিতাব, রাসুল ও শেষ দিবসে বিশ্বাস করবে এবং তাকদিরের ভালো-মন্দে বিশ্বাস করবে।"'), 'Sahih Muslim 8'),
            tf(Q('Performing Hajj is one of the pillars of iman.', 'হজ পালন ঈমানের একটি স্তম্ভ।'), False,
               Q('Hajj is a pillar of Islam (an action), not of iman (belief).', 'হজ ইসলামের স্তম্ভ (আমল), ঈমানের (বিশ্বাস) নয়।'), 'Sahih Muslim 8'),
            bank('six-pillars-of-iman', 2),
            match([(Q('Tawrah', 'তাওরাত'), Q('Musa', 'মুসা (আ.)')), (Q('Injil', 'ইঞ্জিল'), Q('Isa', 'ঈসা (আ.)')),
                   (Q('Zabur', 'যাবুর'), Q('Dawud', 'দাউদ (আ.)')), (Q('Quran', 'কুরআন'), Q('Muhammad ﷺ', 'মুহাম্মাদ ﷺ'))],
                  Q('Each book and the prophet it was given to.', 'প্রতিটি কিতাব ও যে নবীকে তা দেওয়া হয়েছিল।'), 'Quran 5:44, 5:46, 4:163',
                  Q('Match each book to its prophet', 'কিতাবের সঙ্গে নবী মেলান')),
            bank('six-pillars-of-iman', 6),
            tf(Q('The Prophet ﷺ said that iman has more than sixty branches.', 'নবী ﷺ বলেছেন, ঈমানের ষাটের বেশি শাখা আছে।'), True,
               Q('"Iman has sixty-odd or seventy-odd branches; modesty is a branch of iman."', '"ঈমানের ষাট বা সত্তরের অধিক শাখা আছে; লজ্জা ঈমানের একটি শাখা।"'), 'Sahih Muslim 35'),
        ]),
        ('names', Q('Allah and His names', 'আল্লাহ ও তাঁর নামসমূহ'), 'lesson', [
            bank('names-of-allah', 0),
            match([(AR('الرزاق'), Q('The Provider', 'রিজিকদাতা')), (AR('الغفور'), Q('The Forgiving', 'ক্ষমাশীল')),
                   (AR('العليم'), Q('The All-Knowing', 'সর্বজ্ঞ')), (AR('الحكيم'), Q('The Wise', 'প্রজ্ঞাময়'))],
                  Q('Ar-Razzaq, Al-Ghafur, Al-‘Alim and Al-Hakim.', 'আর-রাযযাক, আল-গাফুর, আল-আলিম ও আল-হাকিম।'), 'Quran 51:58, 39:53, 2:32',
                  Q('Match each name to its meaning', 'প্রতিটি নামের অর্থ মেলান')),
            bank('names-of-allah', 6),
            tf(Q('The Prophet ﷺ said Allah has ninety-nine names.', 'নবী ﷺ বলেছেন, আল্লাহর নিরানব্বইটি নাম আছে।'), True,
               Q('"Allah has ninety-nine names; whoever learns them will enter Paradise."', '"আল্লাহর নিরানব্বইটি নাম আছে; যে এগুলো আয়ত্ত করবে সে জান্নাতে প্রবেশ করবে।"'),
               'Sahih al-Bukhari 2736'),
            ayah_fill(112, 1, -1, [(112, 2, -1), (112, 4, 2)], Q('"Say: He is Allah, the One."', '"বলুন: তিনিই আল্লাহ, এক।"')),
            bank('names-of-allah', 9),
            bank('names-of-allah', 4),
        ]),
        ('angels', Q('Angels and the unseen', 'ফেরেশতা ও গায়েব'), 'lesson', [
            bank('angels-and-unseen', 0),
            match([(Q('Angels', 'ফেরেশতা'), Q('Light', 'নূর (আলো)')), (Q('Jinn', 'জিন'), Q('Smokeless fire', 'ধোঁয়াহীন আগুন')),
                   (Q('Adam', 'আদম (আ.)'), Q('Clay', 'মাটি'))],
                  Q('What each was created from.', 'কে কী থেকে সৃষ্টি।'), 'Sahih Muslim 2996; Quran 55:14–15',
                  Q('Match each to what it was created from', 'কে কী থেকে সৃষ্টি, মেলান')),
            bank('angels-and-unseen', 3),
            tf(Q('Angels sometimes disobey Allah’s commands.', 'ফেরেশতারা কখনো কখনো আল্লাহর আদেশ অমান্য করেন।'), False,
               Q('"They do not disobey Allah in what He commands them, and they do what they are commanded."', '"তারা আল্লাহর আদেশ অমান্য করে না এবং যা আদেশ করা হয় তা-ই করে।"'), 'Quran 66:6'),
            bank('six-pillars-of-iman', 7),
            bank('angels-and-unseen', 4),
            tf(Q('Iblis was one of the angels.', 'ইবলিস ফেরেশতাদের একজন ছিল।'), False,
               Q('"He was of the jinn, and he rebelled against his Lord’s command."', '"সে ছিল জিনদের একজন, সে তার রবের আদেশ অমান্য করল।"'), 'Quran 18:50'),
        ]),
        ('last-day', Q('The Last Day', 'শেষ দিবস'), 'lesson', [
            bank('akhirah', 8),
            order(Q('Put these in the order they come', 'যে ক্রমে আসবে সেভাবে সাজান'),
                  [Q('Death', 'মৃত্যু'), Q('The barzakh (the grave)', 'বারযাখ (কবর)'), Q('The Trumpet and the Resurrection', 'শিঙায় ফুঁ ও পুনরুত্থান'),
                   Q('The Scale (al-Mizan)', 'মিযান (দাঁড়িপাল্লা)'), Q('The bridge (as-Sirat)', 'সিরাত (পুল)')],
                  Q('After death comes the barzakh until the Trumpet; then the Resurrection, the weighing of deeds, and the bridge over Hell.',
                    'মৃত্যুর পর শিঙায় ফুঁ পর্যন্ত বারযাখ; তারপর পুনরুত্থান, আমল ওজন, আর জাহান্নামের ওপরের পুল।'), 'Quran 23:100, 39:68, 21:47; Sahih al-Bukhari 806'),
            bank('akhirah', 0),
            bank('akhirah', 1),
            tf(Q('Those who fast will enter Paradise through a gate called Ar-Rayyan.', 'রোজাদাররা রাইয়ান নামের দরজা দিয়ে জান্নাতে প্রবেশ করবে।'), True,
               Q('"In Paradise there is a gate called Ar-Rayyan; those who fast will enter through it."', '"জান্নাতে রাইয়ান নামে একটি দরজা আছে; রোজাদাররা তা দিয়ে প্রবেশ করবে।"'), 'Sahih al-Bukhari 1896'),
            bank('akhirah', 4),
            bank('akhirah', 6),
        ]),
        ('checkpoint', Q('Unit review', 'ইউনিট রিভিউ'), 'checkpoint', [
            bank('six-pillars-of-iman', 4),
            bank('names-of-allah', 1),
            tf(Q('Belief in the decree (qadar) is a pillar of iman.', 'তাকদিরে বিশ্বাস ঈমানের একটি স্তম্ভ।'), True,
               Q('"…and that you believe in the decree, its good and its bad."', '"…এবং তাকদিরের ভালো-মন্দে বিশ্বাস করবে।"'), 'Sahih Muslim 8'),
            bank('angels-and-unseen', 8),
            bank('akhirah', 3),
            bank('six-pillars-of-iman', 8),
            bank('names-of-allah', 7),
            bank('akhirah', 7),
        ]),
    ]),
    ('salah', Q('Purity & Salah', 'পবিত্রতা ও নামাজ'), Q('Wudu, the five prayers, the parts of salah and Al-Fatiha.', 'অজু, পাঁচ ওয়াক্ত নামাজ, নামাজের অংশ ও সূরা ফাতিহা।'),
     '#0097e6', 'clock', [
        ('wudu', Q('Wudu', 'অজু'), 'lesson', [
            tf(Q('Wudu is needed before salah.', 'নামাজের আগে অজু করা আবশ্যক।'), True,
               Q('"Allah does not accept the prayer of one who has broken his wudu until he performs wudu."', '"অজু ভেঙে গেলে অজু না করা পর্যন্ত আল্লাহ নামাজ কবুল করেন না।"'), 'Sahih al-Bukhari 135'),
            order(Q('Put the steps of wudu in order', 'অজুর ধাপগুলো ক্রমানুসারে সাজান'),
                  [Q('Wash the hands', 'দুই হাত ধোয়া'), Q('Rinse the mouth and nose', 'কুলি করা ও নাকে পানি দেওয়া'), Q('Wash the face', 'মুখমণ্ডল ধোয়া'),
                   Q('Wash the arms to the elbows', 'কনুই পর্যন্ত হাত ধোয়া'), Q('Wipe the head', 'মাথা মাসেহ করা'), Q('Wash the feet to the ankles', 'টাখনু পর্যন্ত পা ধোয়া')],
                  Q('As Uthman (RA) showed the Prophet’s ﷺ wudu; the Quran names the face, arms, head and feet in this order.',
                    'উসমান (রা.) নবী ﷺ-এর অজু যেভাবে দেখিয়েছেন; কুরআনেও মুখ, হাত, মাথা ও পা এই ক্রমে আছে।'), 'Quran 5:6; Sahih al-Bukhari 159'),
            bank('wudu-and-salah', 0),
            tf(Q('Washing the feet up to the ankles is part of wudu.', 'টাখনু পর্যন্ত পা ধোয়া অজুর অংশ।'), True,
               Q('"…and wash your feet to the ankles."', '"…এবং টাখনু পর্যন্ত পা ধৌত করো।"'), 'Quran 5:6'),
            bank('wudu-and-salah', 1),
            bank('pillars-and-salah', 8),
        ]),
        ('five-prayers', Q('The five prayers', 'পাঁচ ওয়াক্ত নামাজ'), 'lesson', [
            bank('pillars-and-salah', 2),
            order(Q('Put the prayers in the order of the day', 'দিনের ক্রমে নামাজগুলো সাজান'),
                  [Q('Fajr', 'ফজর'), Q('Dhuhr', 'যোহর'), Q('Asr', 'আসর'), Q('Maghrib', 'মাগরিব'), Q('Isha', 'এশা')],
                  Q('Fajr at dawn, Dhuhr after midday, Asr in the afternoon, Maghrib at sunset and Isha at night.',
                    'ভোরে ফজর, দুপুরের পর যোহর, বিকেলে আসর, সূর্যাস্তে মাগরিব, রাতে এশা।')),
            match([(Q('Fajr', 'ফজর'), Q('2', '২')), (Q('Maghrib', 'মাগরিব'), Q('3', '৩')), (Q('Isha', 'এশা'), Q('4', '৪'))],
                  Q('The fard rak‘ahs of each prayer (when not travelling).', 'প্রতিটি নামাজের ফরজ রাকাত (মুসাফির না হলে)।'), None,
                  Q('Match each prayer to its fard rak‘ahs', 'প্রতিটি নামাজের ফরজ রাকাত মেলান')),
            bank('wudu-and-salah', 6),
            bank('wudu-and-salah', 4),
            bank('wudu-and-salah', 5),
            bank('pillars-and-salah', 9),
        ]),
        ('inside-salah', Q('Inside the salah', 'নামাজের ভেতরে'), 'lesson', [
            bank('wudu-and-salah', 2),
            order(Q('Put the parts of a rak‘ah and its ending in order', 'নামাজের অংশগুলো ক্রমানুসারে সাজান'),
                  [Q('Takbir: Allahu Akbar', 'তাকবির: আল্লাহু আকবার'), Q('Standing and reciting Al-Fatiha', 'দাঁড়িয়ে সূরা ফাতিহা পড়া'),
                   Q('Ruku‘ (bowing)', 'রুকু'), Q('Sujud (prostration)', 'সিজদা'), Q('Tashahhud (sitting)', 'তাশাহহুদ (বসা)'), Q('Salam', 'সালাম')],
                  Q('"Its opening is the takbir and its closing is the salam."', '"নামাজের শুরু তাকবির আর শেষ সালাম।"'), 'Sunan Abi Dawud 61; Sahih al-Bukhari 757'),
            match([(Q('Qiyam', 'কিয়াম'), Q('Standing', 'দাঁড়ানো')), (Q('Ruku‘', 'রুকু'), Q('Bowing', 'ঝুঁকে থাকা')),
                   (Q('Sujud', 'সিজদা'), Q('Prostration', 'মাটিতে কপাল রাখা')), (Q('Tashahhud', 'তাশাহহুদ'), Q('Sitting with the testimony', 'বসে সাক্ষ্যবাণী পড়া'))],
                  Q('The names of the positions of salah.', 'নামাজের অবস্থাগুলোর নাম।'), None,
                  Q('Match each word to its meaning', 'প্রতিটি শব্দের অর্থ মেলান')),
            bank('wudu-and-salah', 3),
            bank('wudu-and-salah', 8),
            tf(Q('Salah ends with the salam.', 'সালামের মাধ্যমে নামাজ শেষ হয়।'), True,
               Q('"Its opening is the takbir and its closing is the salam."', '"নামাজের শুরু তাকবির আর শেষ সালাম।"'), 'Sunan Abi Dawud 61'),
            bank('wudu-and-salah', 9),
        ]),
        ('fatiha', Q('Al-Fatiha', 'সূরা ফাতিহা'), 'lesson', [
            tf(Q('Al-Fatiha has seven ayahs.', 'সূরা ফাতিহায় সাতটি আয়াত আছে।'), True,
               Q('It is "the seven oft-repeated (verses)" and the Mother of the Quran.', 'এটি "বারবার পঠিত সাত আয়াত" ও উম্মুল কুরআন।'), 'Quran 15:87; Sahih al-Bukhari 4474'),
            ayah_order(1, 2, Q('"All praise is for Allah, Lord of all the worlds."', '"সকল প্রশংসা আল্লাহর, যিনি সকল জগতের রব।"')),
            choice(Q('What does "Al-hamdu lillah" mean?', '"আলহামদুলিল্লাহ" অর্থ কী?'),
                   [Q('All praise is for Allah', 'সকল প্রশংসা আল্লাহর'), Q('Allah is the Greatest', 'আল্লাহ সবচেয়ে বড়'),
                    Q('Glory be to Allah', 'আল্লাহ পবিত্র'), Q('In the name of Allah', 'আল্লাহর নামে')], 0,
                   Q('Al-hamdu = all praise, lillah = is for Allah.', 'আল-হামদু = সকল প্রশংসা, লিল্লাহ = আল্লাহর জন্য।'), 'Quran 1:2'),
            ayah_fill(1, 4, -1, [(1, 2, -1), (1, 6, -1)], Q('"Master of the Day of Judgement."', '"বিচার দিবসের মালিক।"')),
            ayah_order(1, 4, Q('"Master of the Day of Judgement."', '"বিচার দিবসের মালিক।"')),
            ayah_fill(1, 6, 1, [(1, 7, 3), (1, 2, 2)], Q('"Guide us to the straight path."', '"আমাদের সরল পথ দেখান।"')),
            choice(Q('In "Iyyaka na‘budu wa iyyaka nasta‘in", what do we ask Allah for?', '"ইয়্যাকা নাবুদু ওয়া ইয়্যাকা নাসতাইন"-এ আমরা আল্লাহর কাছে কী চাই?'),
                   [Q('Help', 'সাহায্য'), Q('Wealth', 'সম্পদ'), Q('Rain', 'বৃষ্টি'), Q('Sleep', 'ঘুম')], 0,
                   Q('"You alone we worship, and You alone we ask for help."', '"আমরা শুধু আপনারই ইবাদত করি এবং শুধু আপনারই সাহায্য চাই।"'), 'Quran 1:5'),
        ]),
        ('checkpoint', Q('Unit review', 'ইউনিট রিভিউ'), 'checkpoint', [
            bank('pillars-and-salah', 3),
            bank('pillars-and-salah', 4),
            ayah_fill(1, 2, 0, [(1, 3, 0), (1, 6, 1)], Q('"All praise is for Allah, Lord of all the worlds."', '"সকল প্রশংসা আল্লাহর, যিনি সকল জগতের রব।"')),
            bank('wudu-and-salah', 7),
            tf(Q('Tayammum with clean earth is allowed when there is no water.', 'পানি না থাকলে পবিত্র মাটি দিয়ে তায়াম্মুম করা যায়।'), True,
               Q('"…and you find no water, then seek clean earth."', '"…আর পানি না পাও, তবে পবিত্র মাটি দিয়ে তায়াম্মুম করো।"'), 'Quran 4:43'),
            bank('pillars-and-salah', 1),
            bank('pillars-and-salah', 0),
            tf(Q('Maghrib has four fard rak‘ahs.', 'মাগরিবে চার রাকাত ফরজ।'), False,
               Q('Maghrib has three fard rak‘ahs.', 'মাগরিবে তিন রাকাত ফরজ।')),
        ]),
    ]),
]


# Short surahs, generated ------------------------------------------------------------

SURAH_NAMES = {
    103: ('Al-Asr', 'আল-আসর'), 105: ('Al-Fil', 'আল-ফিল'), 106: ('Quraysh', 'কুরাইশ'), 108: ('Al-Kawthar', 'আল-কাওসার'),
    109: ('Al-Kafirun', 'আল-কাফিরুন'), 110: ('An-Nasr', 'আন-নাসর'), 111: ('Al-Masad', 'আল-মাসাদ'),
    112: ('Al-Ikhlas', 'আল-ইখলাস'), 113: ('Al-Falaq', 'আল-ফালাক'), 114: ('An-Nas', 'আন-নাস'),
}
BN_DIGITS = str.maketrans('0123456789', '০১২৩৪৫৬৭৮৯')


def ref(surah: int, n: int | None = None):
    en, bn = SURAH_NAMES[surah]
    if n is None:
        return Q(f'Surah {en}.', f'সূরা {bn}।')
    return Q(f'Surah {en}, ayah {n}.', f'সূরা {bn}, আয়াত {str(n).translate(BN_DIGITS)}।')


def gen_order(surah: int, n: int):
    """The words of one ayah in order; None when the ayah is too short or long. A repeated word may go in
    either place: the app compares the words, not the tiles."""
    words = ayah(surah, n).split()
    if not 2 <= len(words) <= 10:
        return None
    return order(Q('Put the words of this ayah in order', 'আয়াতের শব্দগুলো সাজান'), [AR(w) for w in words], ref(surah, n), f'Quran {surah}:{n}', rtl=True)


def gen_fill(surah: int, n: int):
    """The ayah's last word missing; the wrong choices are words of the surah's other ayahs."""
    words = ayah(surah, n).split()
    if len(words) < 2:
        return None
    answer = words[-1]
    others = []
    for m in range(1, len(SURAHS[surah]['ayahs']) + 1):
        if m == n:
            continue
        for w in reversed(ayah(surah, m).split()):
            if w != answer and w not in others:
                others.append(w)
                break
    if len(others) < 2:
        return None
    data = {'before': AR(' '.join(words[:-1])), 'options': [AR(answer)] + [AR(w) for w in others[:3]], 'correct': 0, 'rtl': True}
    return ('fill', Q('Complete the ayah', 'আয়াতটি পূর্ণ করুন'), data, ref(surah, n), f'Quran {surah}:{n}')


def gen_ayahs_in_order(surah: int):
    ayahs = SURAHS[surah]['ayahs']
    if not 2 <= len(ayahs) <= 6 or len(set(ayahs)) != len(ayahs):
        return None
    en, bn = SURAH_NAMES[surah]
    return order(Q(f'Put the ayahs of Surah {en} in order', f'সূরা {bn}-এর আয়াতগুলো সাজান'), [AR(a) for a in ayahs], ref(surah), f'Quran {surah}', rtl=True)


def gen_which_surah(surah: int, others: list[int]):
    first = ayah(surah, 1)
    names = [surah] + others[:3]
    return choice(Q(f'Which surah begins with «{first}»?', f'«{first}» দিয়ে কোন সূরা শুরু?'),
                  [Q(SURAH_NAMES[x][0], SURAH_NAMES[x][1]) for x in names], 0, ref(surah, 1), f'Quran {surah}:1')


def surah_lesson(surah: int):
    items = []
    for n in range(1, len(SURAHS[surah]['ayahs']) + 1):
        items += [x for x in (gen_order(surah, n), gen_fill(surah, n)) if x]
    whole = gen_ayahs_in_order(surah)
    items = items[:9] + ([whole] if whole else [])
    en, bn = SURAH_NAMES[surah]
    return (f'surah-{surah}', Q(f'Surah {en}', f'সূরা {bn}'), 'lesson', items)


def surah_unit(slug: str, title, description, surahs: list[int]):
    lessons = [surah_lesson(s) for s in surahs]
    # Wrong choices: the unit's other surahs first, then other short surahs (no repeats).
    review = [gen_which_surah(s, [x for x in dict.fromkeys(surahs + list(SURAH_NAMES)) if x != s][:3]) for s in surahs]
    for s in surahs:
        if len(review) >= 8:
            break
        n = len(SURAHS[s]['ayahs'])
        extra = gen_fill(s, n)
        if extra:
            review.append(extra)
    lessons.append(('checkpoint', Q('Unit review', 'ইউনিট রিভিউ'), 'checkpoint', review))
    return (slug, title, description, None, 'book-open', lessons)


# Units from the quiz bank ----------------------------------------------------------

QUIZ_TITLES = {q[0]: q[1] for q in PART_A + PART_B + PART_C + PART_D + PHASE2}


def bank_unit(unit_slug: str, title, questions: list[tuple[str, int]]):
    """Quiz-bank questions as a unit: lessons of 5 (a short last one joins the one before), then a review when there are enough."""
    if len(questions) < 5:
        return None
    parts = [questions[i:i + 5] for i in range(0, len(questions), 5)]
    if len(parts) > 1 and len(parts[-1]) < 5:
        last = parts.pop()
        parts[-1] += last
    lessons = [(f'part{k}', Q(f'Part {k}', f'পর্ব {str(k).translate(BN_DIGITS)}'), 'lesson', [bank(*q) for q in part])
               for k, part in enumerate(parts, 1)]
    if len(questions) >= 8:
        lessons.append(('checkpoint', Q('Unit review', 'ইউনিট রিভিউ'), 'checkpoint', [bank(*q) for q in questions[1::2][:6] + questions[:1]]))
    return (unit_slug, title, {}, None, None, lessons)


def unused(slug: str) -> list[tuple[str, int]]:
    return [(slug, n) for n in range(len(BANK[slug])) if (slug, n) not in USED]


# Categories and sections ----------------------------------------------------------------

HAND = {u[0]: u for u in UNITS}

# (slug, title, description, colour, icon, [(section slug, title, description, [unit specs])]);
# a unit spec is 'hand:<slug>', 'bank:<quiz>' (its questions not used by the hand-written units),
# 'practice:<quiz>' (all its questions, to practise what a hand-written unit taught),
# ('mix', key, title, [quizzes]) (the unused questions of several quizzes) or a ready unit tuple.
CATEGORIES = [
    ('iman', Q('Iman & Aqidah', 'ঈমান ও আকিদা'), Q('What a Muslim believes: Allah, the angels, the books, the prophets and the Last Day.', 'একজন মুসলিম কী বিশ্বাস করেন: আল্লাহ, ফেরেশতা, কিতাব, নবী-রাসুল ও শেষ দিবস।'),
     '#44bd32', 'sparkles', [
        ('first-steps', Q('First steps', 'প্রথম ধাপ'), Q('The six pillars of iman, Allah’s names, the angels and the Last Day.', 'ঈমানের ছয় স্তম্ভ, আল্লাহর নাম, ফেরেশতা ও শেষ দিবস।'), ['hand:iman']),
        ('unseen', Q('Allah, the angels & the unseen', 'আল্লাহ, ফেরেশতা ও গায়েব'), Q('Go deeper: Allah’s names, the unseen world and the Hereafter.', 'আরও গভীরে: আল্লাহর নাম, অদৃশ্য জগৎ ও আখিরাত।'),
         [('mix', 'pillars-names', Q('Pillars of iman & Allah’s names', 'ঈমানের স্তম্ভ ও আল্লাহর নাম'), ['six-pillars-of-iman', 'names-of-allah']),
          ('mix', 'unseen-akhirah', Q('The unseen & the Hereafter', 'গায়েব ও আখিরাত'), ['angels-and-unseen', 'akhirah'])]),
    ]),
    ('salah', Q('Salah & Purity', 'নামাজ ও পবিত্রতা'), Q('Wudu, the five prayers and the pillars of Islam.', 'অজু, পাঁচ ওয়াক্ত নামাজ ও ইসলামের স্তম্ভ।'),
     '#0097e6', 'clock', [
        ('learn-to-pray', Q('Learn to pray', 'নামাজ শিখুন'), Q('Wudu, the five prayers, the parts of salah and Al-Fatiha.', 'অজু, পাঁচ ওয়াক্ত নামাজ, নামাজের অংশ ও সূরা ফাতিহা।'), ['hand:salah']),
        ('practice', Q('Practice: pillars, wudu & salah', 'অনুশীলন: স্তম্ভ, অজু ও নামাজ'), Q('Practise the five pillars and the rules of wudu and salah.', 'পাঁচ স্তম্ভ এবং অজু ও নামাজের নিয়ম অনুশীলন করুন।'),
         ['practice:pillars-and-salah', 'practice:wudu-and-salah']),
    ]),
    ('quran', Q('Quran', 'কুরআন'), Q('Know the Quran, learn short surahs word by word, and its stories.', 'কুরআনকে জানুন, ছোট সূরাগুলো শব্দে শব্দে শিখুন, আর এর কাহিনিগুলো।'),
     '#8c7ae6', 'book-open', [
        ('know', Q('Know the Quran', 'কুরআনকে জানুন'), Q('How the Quran came down and how it is arranged.', 'কুরআন কীভাবে নাজিল হলো ও কীভাবে সাজানো।'),
         ['bank:quran-basics', 'bank:quran-structure', 'bank:surah-facts']),
        ('short-surahs', Q('Short surahs', 'ছোট সূরা'), Q('Learn the short surahs word by word: put the words and ayahs in order.', 'ছোট সূরাগুলো শব্দে শব্দে শিখুন: শব্দ ও আয়াত সাজিয়ে।'), [
            surah_unit('quran-3quls', Q('Al-Ikhlas, Al-Falaq & An-Nas', 'আল-ইখলাস, আল-ফালাক ও আন-নাস'), Q('The last three surahs of the Quran.', 'কুরআনের শেষ তিনটি সূরা।'), [112, 113, 114]),
            surah_unit('quran-asr-kawthar-kafirun', Q('Al-Asr, Al-Kawthar & Al-Kafirun', 'আল-আসর, আল-কাওসার ও আল-কাফিরুন'), Q('Three short surahs often read in salah.', 'নামাজে প্রায়ই পড়া তিনটি ছোট সূরা।'), [103, 108, 109]),
            surah_unit('quran-nasr-masad-quraysh-fil', Q('An-Nasr, Al-Masad, Quraysh & Al-Fil', 'আন-নাসর, আল-মাসাদ, কুরাইশ ও আল-ফিল'), Q('Four more short surahs.', 'আরও চারটি ছোট সূরা।'), [110, 111, 106, 105]),
            'bank:short-surahs']),
        ('stories', Q('Stories & ayahs', 'কাহিনি ও আয়াত'), Q('Stories of the Quran and well-known ayahs.', 'কুরআনের কাহিনি ও পরিচিত আয়াত।'),
         ['bank:quran-stories', 'bank:complete-the-ayah']),
    ]),
    ('prophets', Q('Prophets & Seerah', 'নবী-রাসুল ও সিরাত'), Q('The prophets of Allah and the life of the Prophet Muhammad ﷺ.', 'আল্লাহর নবী-রাসুলগণ ও নবী মুহাম্মাদ ﷺ-এর জীবন।'),
     '#e1b12c', 'users', [
        ('prophets', Q('Prophets of Allah', 'আল্লাহর নবীগণ'), Q('From Adam to Isa, peace be upon them.', 'আদম থেকে ঈসা পর্যন্ত, তাঁদের ওপর শান্তি বর্ষিত হোক।'),
         ['bank:prophets', 'bank:prophets-2', 'bank:prophets-3']),
        ('seerah', Q('Life of the Prophet ﷺ', 'নবীজির ﷺ জীবন'), Q('Makkah, the hijrah and Madinah.', 'মক্কা, হিজরত ও মদিনা।'), ['bank:seerah', 'bank:seerah-2']),
    ]),
    ('ibadah', Q('Fasting, Zakat & Hajj', 'রোজা, যাকাত ও হজ'), Q('Ramadan and fasting, zakat and charity, Hajj and Umrah.', 'রমজান ও রোজা, যাকাত ও দান, হজ ও উমরাহ।'),
     '#c23616', 'moon', [
        ('fasting', Q('Ramadan & fasting', 'রমজান ও রোজা'), Q('The month of the Quran, its rules and the Eids.', 'কুরআনের মাস, রোজার নিয়ম ও দুই ঈদ।'),
         ['bank:ramadan', 'bank:fasting-rules', 'bank:eid']),
        ('zakat-hajj', Q('Zakat & Hajj', 'যাকাত ও হজ'), Q('Giving, and the journey to Makkah.', 'দান, আর মক্কার সফর।'), ['bank:zakat-and-charity', 'bank:hajj-and-umrah']),
    ]),
    ('akhlaq', Q('Character & Daily Life', 'চরিত্র ও প্রতিদিনের জীবন'), Q('Manners, family, the Sunnah in daily life, duas and the Islamic calendar.', 'আদব, পরিবার, প্রতিদিনের সুন্নাহ, দোয়া ও ইসলামিক ক্যালেন্ডার।'),
     '#00a8ff', 'hand-heart', [
        ('manners', Q('Good manners', 'উত্তম আচরণ'), Q('Character, family and the Sunnah every day.', 'চরিত্র, পরিবার ও প্রতিদিনের সুন্নাহ।'),
         ['bank:good-manners', 'bank:family-and-character', 'bank:sunnah-daily-life']),
        ('words', Q('Duas, words & days', 'দোয়া, শব্দ ও দিন'), Q('Duas and dhikr, everyday Islamic words and the Hijri calendar.', 'দোয়া ও জিকির, প্রতিদিনের ইসলামিক শব্দ ও হিজরি ক্যালেন্ডার।'),
         ['bank:duas-and-dhikr', 'bank:arabic-words', 'bank:islamic-calendar']),
    ]),
    ('history', Q('Islamic History', 'ইসলামের ইতিহাস'), Q('The companions, holy places, scholars and Islam in Bengal.', 'সাহাবিগণ, পবিত্র স্থান, আলেমগণ ও বাংলায় ইসলাম।'),
     '#9c88ff', 'library', [
        ('early', Q('Early Islam', 'প্রাথমিক যুগ'), Q('The companions, great women of Islam and the holy places.', 'সাহাবিগণ, ইসলামের মহীয়সী নারীগণ ও পবিত্র স্থানসমূহ।'),
         ['bank:islamic-history', 'bank:companions', 'bank:women-in-islam', 'bank:holy-places']),
        ('scholars', Q('Scholars, science & Bengal', 'আলেম, বিজ্ঞান ও বাংলা'), Q('Hadith scholars, Muslim scientists, later history and Islam in Bengal.', 'হাদিসের আলেমগণ, মুসলিম বিজ্ঞানী, পরবর্তী ইতিহাস ও বাংলায় ইসলাম।'),
         ['bank:hadith-and-scholars', 'bank:muslim-scientists', 'bank:islamic-history-2', 'bank:islam-in-bengal']),
    ]),
    ('kids', Q('For Young Learners', 'ছোটদের জন্য'), Q('Easy first lessons for children, to do with a parent.', 'বাবা-মায়ের সঙ্গে করার জন্য ছোটদের সহজ প্রথম পাঠ।'),
     '#fbc531', 'graduation-cap', [
        ('first', Q('First lessons', 'প্রথম পাঠ'), Q('Allah, the prophets, salah and good manners, simply.', 'আল্লাহ, নবীগণ, নামাজ ও আদব, সহজভাবে।'), ['bank:kids-basics', 'bank:kids-basics-2']),
    ]),
]


def resolve():
    """[(category, [(section, [unit tuples])])] with every spec turned into a unit (skipping empty bank units)."""
    tree = []
    for cat in CATEGORIES:
        sections = []
        for sec_slug, sec_title, sec_desc, specs in cat[5]:
            units = []
            for spec in specs:
                if isinstance(spec, tuple) and spec[0] == 'mix':
                    _, key, title, quizzes = spec
                    unit = bank_unit(f'mix:{key}', title, [q for quiz in quizzes for q in unused(quiz)])
                elif isinstance(spec, tuple):
                    unit = spec
                elif spec.startswith('hand:'):
                    unit = HAND[spec[5:]]
                elif spec.startswith('practice:'):
                    quiz = spec[9:]
                    unit = bank_unit(f'practice:{quiz}', QUIZ_TITLES[quiz], [(quiz, n) for n in range(len(BANK[quiz]))])
                else:
                    quiz = spec[5:]
                    unit = bank_unit(f'bank:{quiz}', QUIZ_TITLES[quiz], unused(quiz))
                if unit:
                    units.append(unit)
            sections.append(((sec_slug, sec_title, sec_desc), units))
        tree.append((cat, sections))
    return tree


def check(tree):
    seen_units = set()
    slugs = [c[0] for c, _ in tree]
    assert len(slugs) == len(set(slugs)), 'repeated category'
    for cat, sections in tree:
        assert cat[1]['en'] and cat[1]['bn'] and cat[2]['en'] and cat[2]['bn'], cat[0]
        for (sec_slug, sec_title, sec_desc), units in sections:
            assert units, (cat[0], sec_slug, 'empty section')
            for unit_slug, title, description, color, icon, lessons in units:
                assert unit_slug not in seen_units, ('unit in two sections', unit_slug)
                seen_units.add(unit_slug)
                for lesson_slug, lesson_title, kind, items in lessons:
                    assert 5 <= len(items) <= 10, (unit_slug, lesson_slug, len(items))
                    for n, (kind_, prompt, data, explanation, source) in enumerate(items, 1):
                        where = (unit_slug, lesson_slug, n)
                        texts = [prompt] if kind_ not in ('match', 'order') or prompt else []
                        texts += [explanation] if explanation else []
                        for t in texts + [title, lesson_title]:
                            assert t.get('en', '').strip() and t.get('bn', '').strip(), where
                        values = data.get('options') or data.get('pieces') or [p[s] for p in data.get('pairs', []) for s in ('left', 'right')]
                        for v in values:
                            assert v.get('ar') or (v.get('en', '').strip() and v.get('bn', '').strip()), where
                        if 'options' in data:
                            assert len({json.dumps(o, sort_keys=True) for o in data['options']}) == len(data['options']), (where, 'repeated option')
                        if 'options' in data:
                            assert 2 <= len(data['options']) <= 6 and 0 <= data['correct'] < len(data['options']), where
                        if 'pieces' in data:
                            assert 2 <= len(data['pieces']) <= 10, where
                        if kind_ == 'match':
                            for side in ('left', 'right'):
                                assert len({json.dumps(p[side], sort_keys=True) for p in data['pairs']}) == len(data['pairs']), (where, 'repeated ' + side)


def statements(tree):
    """The SQL, one statement group per unit (so the output can be split between units)."""
    head = []
    for c_order, (cat, sections) in enumerate(tree, 1):
        c_slug, c_title, c_desc, c_color, c_icon, _ = cat
        cat_id = uid('category', c_slug)
        head.append(f'\n-- {c_title["en"]}')
        head.append('INSERT INTO is_learn_categories (id, title, description, color, icon, sort_order) VALUES ('
                    f"{sql(cat_id)}, {sql(c_title)}, {sql(c_desc)}, {sql(c_color)}, {sql(c_icon)}, {c_order}) ON CONFLICT (id) DO NOTHING;")
        for s_order, ((s_slug, s_title, s_desc), _units) in enumerate(sections, 1):
            head.append('INSERT INTO is_learn_sections (id, category_id, title, description, sort_order) VALUES ('
                        f"{sql(uid('section', f'{c_slug}:{s_slug}'))}, {sql(cat_id)}, {sql(s_title)}, {sql(s_desc)}, {s_order}) ON CONFLICT (id) DO NOTHING;")
    groups = []
    for cat, sections in tree:
        for (s_slug, _t, _d), units in sections:
            section_id = uid('section', f'{cat[0]}:{s_slug}')
            for u_order, (unit_slug, title, description, color, icon, lessons) in enumerate(units, 1):
                unit_id = uid('unit', unit_slug)
                g = [f'\n-- {cat[1]["en"]} › {title["en"]}',
                     'INSERT INTO is_learn_units (id, title, description, color, icon, review_status, sort_order, section_id) VALUES ('
                     f"{sql(unit_id)}, {sql(title)}, {sql(description)}, {sql(color or cat[3])}, {sql(icon or cat[4])}, 'in_review', {u_order}, {sql(section_id)}) ON CONFLICT (id) DO NOTHING;",
                     # Units from before categories (live already) join their section without other changes.
                     f"UPDATE is_learn_units SET section_id = {sql(section_id)}, sort_order = {u_order} WHERE id = {sql(unit_id)} AND section_id IS NULL;"]
                for lesson_order, (lesson_slug, lesson_title, kind, items) in enumerate(lessons, 1):
                    lesson_id = uid('lesson', f'{unit_slug}:{lesson_slug}')
                    g.append('INSERT INTO is_learn_lessons (id, unit_id, title, kind, sort_order) VALUES ('
                             f"{sql(lesson_id)}, {sql(unit_id)}, {sql(lesson_title)}, {sql(kind)}, {lesson_order}) ON CONFLICT (id) DO NOTHING;")
                    for n, (kind_, prompt, data, explanation, source) in enumerate(items, 1):
                        g.append('INSERT INTO is_learn_items (id, lesson_id, type, prompt, data, explanation, source_ref, sort_order) VALUES ('
                                 f"{sql(uid('item', f'{unit_slug}:{lesson_slug}:{n}'))}, {sql(lesson_id)}, {sql(kind_)}, {sql(prompt)}, {sql(data)}, "
                                 f"{sql(explanation)}, {sql(source)}, {n}) ON CONFLICT (id) DO NOTHING;")
                groups.append('\n'.join(g))
    return '\n'.join(head), groups


def build(tree) -> list[str]:
    head, groups = statements(tree)
    units = sum(len(u) for _, secs in tree for _, u in secs)
    lessons = sum(len(un[5]) for _, secs in tree for _, u in secs for un in u)
    items = sum(len(ls[3]) for _, secs in tree for _, u in secs for un in u for ls in un[5])
    parts, current = [], [head]
    for g in groups:
        if sum(len(x.encode()) for x in current) + len(g.encode()) > PART_BYTES:
            parts.append(current)
            current = []
        current.append(g)
    parts.append(current)
    total = len(parts)
    out = []
    for k, body in enumerate(parts, 1):
        intro = (f"-- Islamic Studio Academy, part {k} of {total}: {len(tree)} categories, {units} units, {lessons} lessons, {items} items in all\n"
                 f"-- (English and Bangla). Generated by islamic_studio_learn.py. Run after migrations 079 and 085, parts in order.\n"
                 f"-- Safe to run again. Approve the units in batools → Islamic Studio → Content Review.\n\nBEGIN;\n")
        tail = "\nCOMMIT;\n"
        if k == total:
            tail += """
SELECT 'categories' AS what, count(*) FROM is_learn_categories
UNION ALL SELECT 'sections', count(*) FROM is_learn_sections
UNION ALL SELECT 'units', count(*) FROM is_learn_units
UNION ALL SELECT 'units without a section', count(*) FROM is_learn_units WHERE section_id IS NULL
UNION ALL SELECT 'lessons', count(*) FROM is_learn_lessons
UNION ALL SELECT 'items', count(*) FROM is_learn_items
UNION ALL SELECT 'units waiting for review', count(*) FROM is_learn_units WHERE review_status = 'in_review';

-- Optional: publish every Academy unit at once instead of approving each in
-- Content Review (they come from the reviewed quiz bank and the Quran text).
-- UPDATE is_learn_units SET review_status = 'approved', reviewed_at = now() WHERE review_status = 'in_review';
"""
        out.append(intro + '\n'.join(body) + tail)
    return out


if __name__ == '__main__':
    tree = resolve()
    check(tree)
    for old in HERE.glob('islamic_studio_learn_part*.sql'):
        old.unlink()
    files = build(tree)
    for k, text in enumerate(files, 1):
        Path(str(OUT).format(k)).write_text(text)
    units = sum(len(u) for _, secs in tree for _, u in secs)
    lessons = sum(len(un[5]) for _, secs in tree for _, u in secs for un in u)
    items = sum(len(ls[3]) for _, secs in tree for _, u in secs for un in u for ls in un[5])
    for cat, secs in tree:
        print(f'  {cat[1]["en"]}: ' + ', '.join(f'{s[1]["en"]} ({len(u)} units)' for s, u in secs))
    print(f'✔ {len(files)} files: {len(tree)} categories, {sum(len(s) for _, s in tree)} sections, {units} units, {lessons} lessons, {items} items')
