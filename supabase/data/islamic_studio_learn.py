#!/usr/bin/env python3
"""
Writes islamic_studio_learn.sql: the first two units of the Islamic Academy
learning path (migration 079), in English and Bangla.

Multiple-choice items reuse questions of the quiz bank (quizbank_*.py and
islamic_studio_phase2.py); the other items are written here. Quran text is
never typed by hand: it is read from the app's bundled Tanzil Uthmani text
(islamic-studio-app/public/quran/quran.json, or the path in QURAN_JSON).

Units go in as 'in_review': approve them in batools → Content Review.
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

OUT = HERE / 'islamic_studio_learn.sql'
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

def bank(slug: str, n: int):
    """Question n (0-based) of a quiz in the bank, as a multiple-choice item."""
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


def check():
    for unit_slug, title, description, color, icon, lessons in UNITS:
        assert lessons[-1][2] == 'checkpoint', unit_slug
        for lesson_slug, lesson_title, kind, items in lessons:
            assert 5 <= len(items) <= 10, (unit_slug, lesson_slug)
            for n, (kind_, prompt, data, explanation, source) in enumerate(items, 1):
                where = (unit_slug, lesson_slug, n)
                texts = [prompt] if kind_ not in ('match', 'order') or prompt else []
                texts += [explanation] if explanation else []
                for t in texts + [title, description, lesson_title]:
                    assert t.get('en', '').strip() and t.get('bn', '').strip(), where
                values = data.get('options') or data.get('pieces') or [p[s] for p in data.get('pairs', []) for s in ('left', 'right')]
                for v in values:
                    assert v.get('ar') or (v.get('en', '').strip() and v.get('bn', '').strip()), where
                if 'options' in data:
                    assert len({json.dumps(o, sort_keys=True) for o in data['options']}) == len(data['options']), (where, 'repeated option')
                if kind_ == 'match':
                    for side in ('left', 'right'):
                        assert len({json.dumps(p[side], sort_keys=True) for p in data['pairs']}) == len(data['pairs']), (where, 'repeated ' + side)


def build() -> str:
    count = sum(len(items) for *_, lessons in UNITS for *__, items in lessons)
    out = [f"""-- Islamic Studio Academy: {len(UNITS)} units, {sum(len(u[5]) for u in UNITS)} lessons, {count} items (English and Bangla).
-- Generated by islamic_studio_learn.py. Run after migration 079. Safe to run again.
-- Approve the units in batools → Islamic Studio → Content Review.

BEGIN;
"""]
    for order_, (unit_slug, title, description, color, icon, lessons) in enumerate(UNITS, 1):
        unit_id = uid('unit', unit_slug)
        out.append(f'\n-- {title["en"]}')
        out.append('INSERT INTO is_learn_units (id, title, description, color, icon, review_status, sort_order) VALUES ('
                   f"{sql(unit_id)}, {sql(title)}, {sql(description)}, {sql(color)}, {sql(icon)}, 'in_review', {order_}) ON CONFLICT (id) DO NOTHING;")
        for lesson_order, (lesson_slug, lesson_title, kind, items) in enumerate(lessons, 1):
            lesson_id = uid('lesson', f'{unit_slug}:{lesson_slug}')
            out.append('INSERT INTO is_learn_lessons (id, unit_id, title, kind, sort_order) VALUES ('
                       f"{sql(lesson_id)}, {sql(unit_id)}, {sql(lesson_title)}, {sql(kind)}, {lesson_order}) ON CONFLICT (id) DO NOTHING;")
            for n, (kind_, prompt, data, explanation, source) in enumerate(items, 1):
                out.append('INSERT INTO is_learn_items (id, lesson_id, type, prompt, data, explanation, source_ref, sort_order) VALUES ('
                           f"{sql(uid('item', f'{unit_slug}:{lesson_slug}:{n}'))}, {sql(lesson_id)}, {sql(kind_)}, {sql(prompt)}, {sql(data)}, "
                           f"{sql(explanation)}, {sql(source)}, {n}) ON CONFLICT (id) DO NOTHING;")
    out.append("""
COMMIT;

SELECT 'units' AS what, count(*) FROM is_learn_units
UNION ALL SELECT 'lessons', count(*) FROM is_learn_lessons
UNION ALL SELECT 'items', count(*) FROM is_learn_items
UNION ALL SELECT 'units waiting for review', count(*) FROM is_learn_units WHERE review_status = 'in_review';
""")
    return '\n'.join(out)


if __name__ == '__main__':
    check()
    OUT.write_text(build())
    lessons = sum(len(u[5]) for u in UNITS)
    items = sum(len(items) for *_, ls in UNITS for *__, items in ls)
    print(f'✔ {OUT.name}: {len(UNITS)} units, {lessons} lessons, {items} items ({OUT.stat().st_size // 1024} KB)')
