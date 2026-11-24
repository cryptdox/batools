#!/usr/bin/env python3
"""
Writes islamic_studio_learn_batch2.sql: the second batch of the Islamic Academy
(migrations 079 and 085), in Bangla and English, focused on practice:
  * Salah & Purity  → section "নামাজ শিখি: ধাপে ধাপে": wudu & ghusl, the prayer
    step by step (what is said where), janazah
  * Fasting, Zakat & Hajj → section "হাতে-কলমে ইবাদত": fasting, zakat, Hajj & Umrah, qurbani
  * Iman & Aqidah → section "কালিমা ও আল্লাহর নাম": the kalimas, names of Allah (meanings)
  * Quran → section "ছোট সূরার অর্থ": meaning-matching lessons for 14 short surahs,
    generated from a per-ayah meaning table; the Arabic comes from the app's bundled
    Tanzil text (islamic-studio-app/public/quran/quran.json or QURAN_JSON), never typed.

The sections join the existing categories of islamic_studio_learn.py (same ids:
uuid5 of 'learn-category:<slug>'). If a category is missing the section is skipped
and its units go in without a section (the app then hides them) — nothing fails.
Only the item types the app plays today are used (no 'listen').
Where the madhhabs differ, items ask about what is agreed or quote the text.

Units go in as 'in_review' (the is_review_status enum has no 'pending'): approve
them in batools → Content Review. Categories, sections, lessons and items have no
review column (085: units carry the review).
Ids: uuid5 of 'batch2:learn-<kind>:<key>' — they never collide with the first batch.
Re-runnable: fixed ids, ON CONFLICT DO NOTHING, nothing existing is overwritten.

    python3 islamic_studio_learn_batch2.py
"""
import json
import os
import uuid
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / 'islamic_studio_learn_batch2.sql'
NS = uuid.UUID('6f1c1b8e-6c2a-4d4e-9a57-1d2c3b4a5e60')
QURAN_JSON = Path(os.environ.get('QURAN_JSON', HERE.parents[3] / 'islamic-studio-app' / 'public' / 'quran' / 'quran.json'))
SURAHS = {s['n']: s for s in json.loads(QURAN_JSON.read_text())['surahs']}
REVIEW_STATUS = 'in_review'
SECTION_SORT = 10   # after the first batch's sections in each category
PLAYABLE = ('choice', 'true_false', 'match', 'order', 'fill')


def sql(v) -> str:
    if v is None:
        return 'NULL'
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, (dict, list)):
        v = json.dumps(v, ensure_ascii=False)
    return "'" + str(v).replace("'", "''") + "'"


def uid(kind: str, key: str) -> str:
    return str(uuid.uuid5(NS, f'batch2:learn-{kind}:{key}'))


def category_id(slug: str) -> str:
    """The id islamic_studio_learn.py gave a category."""
    return str(uuid.uuid5(NS, f'learn-category:{slug}'))


def Q(en: str, bn: str) -> dict:
    return {'en': en, 'bn': bn}


def AR(text: str) -> dict:
    return {'ar': text}


BN_DIGITS = str.maketrans('0123456789', '০১২৩৪৫৬৭৮৯')


def bn(n) -> str:
    return str(n).translate(BN_DIGITS)


# Items: (type, prompt, data, explanation, source) ------------------------------

def choice(question, answers, correct, explanation, source=None):
    return ('choice', question, {'options': answers, 'correct': correct}, explanation, source)


def tf(statement, answer: bool, explanation, source=None):
    return ('true_false', statement, {'answer': answer}, explanation, source)


def match(prompt, pairs, explanation, source=None):
    return ('match', prompt, {'pairs': [{'left': a, 'right': b} for a, b in pairs]}, explanation, source)


def order(prompt, pieces, explanation, source=None, rtl=False):
    return ('order', prompt, {'pieces': pieces, 'rtl': rtl}, explanation, source)


def fill(prompt, before, after, answers, correct, explanation, source=None, rtl=False):
    data = {'options': answers, 'correct': correct, 'rtl': rtl}
    if before:
        data['before'] = before
    if after:
        data['after'] = after
    return ('fill', prompt, data, explanation, source)


MATCH = Q('Match each one', 'মিলিয়ে নিন')
ORDER = Q('Put these in the right order', 'সঠিক ক্রমে সাজান')
TF_OK = Q('Correct.', 'সঠিক।')


# ============================================================ Salah & Purity
WUDU = ('wudu-ghusl', Q('Learn wudu & ghusl', 'অজু ও গোসল শিখি'),
        Q('The steps of wudu, what breaks it, ghusl and tayammum.', 'অজুর ধাপ, যা অজু ভাঙে, গোসল ও তায়াম্মুম।'), None, 'droplets', [
    ('steps', Q('The steps of wudu', 'অজুর ধাপগুলো'), 'lesson', [
        order(Q('Put the steps of wudu in order', 'অজুর ধাপগুলো ক্রমানুসারে সাজান'),
              [Q('Say Bismillah', 'বিসমিল্লাহ বলা'), Q('Wash both hands', 'দুই হাত কব্জি পর্যন্ত ধোয়া'), Q('Rinse the mouth', 'কুলি করা'),
               Q('Rinse the nose', 'নাকে পানি দেওয়া'), Q('Wash the face', 'মুখমণ্ডল ধোয়া'), Q('Wash the arms to the elbows', 'কনুইসহ হাত ধোয়া'),
               Q('Wipe the head (and ears)', 'মাথা (ও কান) মাসেহ করা'), Q('Wash the feet to the ankles', 'টাখনুসহ পা ধোয়া')],
              Q('The Prophet’s ﷺ wudu as ‘Uthman (RA) showed it; the Quran names face, arms, head and feet in this order.',
                'উসমান (রা.) যেভাবে নবীজির ﷺ অজু দেখিয়েছেন; কুরআনেও মুখ, হাত, মাথা ও পা এই ক্রমে এসেছে।'), 'Quran 5:6; Sahih al-Bukhari 159'),
        fill(Q('Complete the step', 'ধাপটি পূর্ণ করুন'), Q('Wash the arms up to and including the', 'হাত ধুতে হবে'), Q('', 'পর্যন্ত (সহ)'),
             [Q('elbows', 'কনুই'), Q('wrists', 'কব্জি'), Q('shoulders', 'কাঁধ'), Q('fingertips', 'আঙুলের ডগা')], 0,
             Q('"…and your arms to the elbows."', '"…এবং কনুই পর্যন্ত তোমাদের হাত।"'), 'Quran 5:6'),
        match(Q('How is each part done?', 'কোন অঙ্গে কী করা হয়?'),
              [(Q('Face', 'মুখমণ্ডল'), Q('Wash it', 'ধোয়া')), (Q('Head', 'মাথা'), Q('Wipe it with wet hands', 'ভেজা হাতে মাসেহ')),
               (Q('Arms', 'হাত'), Q('Wash to the elbows', 'কনুই পর্যন্ত ধোয়া')), (Q('Feet', 'পা'), Q('Wash to the ankles', 'টাখনু পর্যন্ত ধোয়া'))],
              Q('Wash the face, arms and feet; wipe the head.', 'মুখ, হাত ও পা ধোয়া; মাথা মাসেহ।'), 'Quran 5:6'),
        tf(Q('The Prophet ﷺ liked to begin with the right side.', 'নবী ﷺ ডান দিক থেকে শুরু করা পছন্দ করতেন।'), True,
           Q('‘A’ishah (RA): he liked to start with the right in putting on shoes, combing and in his purification.', 'আয়েশা (রা.): জুতা পরা, চুল আঁচড়ানো ও পবিত্রতা অর্জনে তিনি ডান দিক থেকে শুরু করা পছন্দ করতেন।'), 'Sahih al-Bukhari 168'),
        tf(Q('Washing each limb more than three times is the Sunnah.', 'প্রতিটি অঙ্গ তিনবারের বেশি ধোয়া সুন্নাত।'), False,
           Q('He ﷺ washed up to three times and said whoever adds to this has done wrong.', 'নবী ﷺ সর্বোচ্চ তিনবার ধুয়েছেন এবং বলেছেন, এর বেশি যে করে সে ভুল করল।'), 'Sunan Abi Dawud 135'),
        tf(Q('One wudu can be used for several prayers, as long as it is not broken.', 'অজু না ভাঙলে এক অজুতে একাধিক নামাজ পড়া যায়।'), True,
           Q('On the day of the conquest of Makkah he ﷺ prayed several prayers with one wudu.', 'মক্কা বিজয়ের দিন নবী ﷺ এক অজুতে কয়েক ওয়াক্ত নামাজ পড়েছেন।'), 'Sahih Muslim 277'),
        choice(Q('What did the Prophet ﷺ teach us to say after wudu?', 'অজুর পর নবী ﷺ কী পড়তে শিখিয়েছেন?'),
               [Q('Ashhadu an la ilaha illallah… wa ashhadu anna Muhammadan ‘abduhu wa rasuluh', 'আশহাদু আল্লা ইলাহা ইল্লাল্লাহু… ওয়া আশহাদু আন্না মুহাম্মাদান আবদুহু ওয়া রাসুলুহ'),
                Q('Allahu Akbar', 'আল্লাহু আকবার'), Q('As-salamu ‘alaykum', 'আসসালামু আলাইকুম'), Q('Rabbana atina', 'রাব্বানা আতিনা')], 0,
               Q('Whoever says the shahadah after a complete wudu, the eight gates of Paradise are opened for him.', 'পূর্ণ অজুর পর যে শাহাদাত পড়ে, তার জন্য জান্নাতের আটটি দরজা খুলে দেওয়া হয়।'), 'Sahih Muslim 234'),
    ]),
    ('breaks', Q('What breaks wudu', 'যা অজু ভাঙে'), 'lesson', [
        tf(Q('Passing wind breaks wudu.', 'বায়ু বের হলে অজু ভেঙে যায়।'), True,
           Q('"Allah does not accept the prayer of one who has broken his wudu until he does wudu." Abu Hurayrah explained: passing wind.', '"অজু ভেঙে গেলে অজু না করা পর্যন্ত আল্লাহ নামাজ কবুল করেন না।" আবু হুরায়রা (রা.) ব্যাখ্যা করেন: বায়ু বের হওয়া।'), 'Sahih al-Bukhari 135'),
        choice(Q('Which of these breaks wudu?', 'নিচের কোনটি অজু ভাঙে?'),
               [Q('Smiling', 'মুচকি হাসি'), Q('Drinking water', 'পানি পান করা'), Q('Urinating', 'পেশাব করা'), Q('Saying salam', 'সালাম দেওয়া')], 2,
               Q('Whatever comes out from the toilet passages (urine, stool, wind) breaks wudu.', 'পেশাব-পায়খানার রাস্তা দিয়ে যা বের হয় (পেশাব, পায়খানা, বায়ু) তাতে অজু ভাঙে।'), 'Quran 5:6'),
        tf(Q('Eating bread or rice breaks wudu.', 'রুটি বা ভাত খেলে অজু ভেঙে যায়।'), False,
           Q('Ordinary food does not break wudu; he ﷺ ate and prayed without a new wudu.', 'সাধারণ খাবারে অজু ভাঙে না; নবী ﷺ খেয়ে নতুন অজু ছাড়াই নামাজ পড়েছেন।'), 'Sahih al-Bukhari 207'),
        tf(Q('Deep sleep lying down breaks wudu.', 'শুয়ে গভীর ঘুমালে অজু ভেঙে যায়।'), True,
           Q('In deep sleep one cannot know if wudu was broken, so a new wudu is needed — all the schools agree on this case.', 'গভীর ঘুমে অজু ভাঙল কি না টের পাওয়া যায় না, তাই নতুন অজু লাগে — এ ক্ষেত্রে সব মাজহাব একমত।'), 'Sunan Abi Dawud 203'),
        tf(Q('Fainting (losing consciousness) breaks wudu.', 'অজ্ঞান হলে অজু ভেঙে যায়।'), True,
           Q('Scholars agree that losing consciousness breaks wudu, even more than sleep.', 'আলেমগণ একমত, অজ্ঞান হওয়া ঘুমের চেয়েও বেশি করে অজু ভাঙে।'), 'Ijma‘ (scholarly agreement)'),
        tf(Q('A man who feels something in his stomach during salah was told not to leave the prayer unless he hears a sound or finds a smell.', 'নামাজে পেটে কিছু অনুভব করা ব্যক্তিকে বলা হয়েছে: শব্দ না শুনলে বা গন্ধ না পেলে নামাজ ছেড়ে যাবে না।'), True,
           Q('Mere doubt does not cancel a certain wudu inside the prayer.', 'নিছক সন্দেহে নামাজের মধ্যে নিশ্চিত অজু বাতিল হয় না।'), 'Sahih al-Bukhari 137; Sahih Muslim 362'),
        choice(Q('After janabah (major impurity), what is needed before salah?', 'জানাবাতের (বড় নাপাকির) পর নামাজের আগে কী লাগবে?'),
               [Q('Only wudu', 'শুধু অজু'), Q('Ghusl (a full bath)', 'গোসল'), Q('Nothing', 'কিছু না'), Q('Only washing the hands', 'শুধু হাত ধোয়া')], 1,
               Q('"If you are in a state of janabah, then purify yourselves."', '"যদি তোমরা জানাবাত অবস্থায় থাকো, তবে ভালোভাবে পবিত্র হও।"'), 'Quran 5:6'),
    ]),
    ('ghusl-tayammum', Q('Ghusl & tayammum', 'গোসল ও তায়াম্মুম'), 'lesson', [
        choice(Q('Which of these makes ghusl obligatory?', 'নিচের কোনটির পর গোসল ফরজ?'),
               [Q('Eating', 'খাওয়া'), Q('Cutting hair', 'চুল কাটা'), Q('The end of menstruation', 'ঋতুস্রাব শেষ হওয়া'), Q('A short nap', 'অল্প তন্দ্রা')], 2,
               Q('"…do not approach them until they are pure; when they have purified themselves…"', '"…পবিত্র না হওয়া পর্যন্ত তাদের কাছে যেয়ো না; যখন তারা ভালোভাবে পবিত্র হয়…"'), 'Quran 2:222; Sahih al-Bukhari 228'),
        order(Q('Put the Prophet’s ﷺ way of ghusl in order', 'নবীজির ﷺ গোসলের পদ্ধতি ক্রমানুসারে সাজান'),
              [Q('Wash the hands', 'দুই হাত ধোয়া'), Q('Wash the private parts', 'লজ্জাস্থান ধোয়া'), Q('Do wudu as for salah', 'নামাজের মতো অজু করা'),
               Q('Pour water over the head three times', 'মাথায় তিনবার পানি ঢালা'), Q('Pour water over the whole body', 'সারা শরীরে পানি ঢালা')],
              Q('As ‘A’ishah and Maymunah (RA) described it. What is a must is that water reaches the whole body.', 'আয়েশা ও মাইমুনা (রা.) যেভাবে বর্ণনা করেছেন। আবশ্যক হলো সারা শরীরে পানি পৌঁছানো।'), 'Sahih al-Bukhari 248; Sahih al-Bukhari 249'),
        tf(Q('In ghusl, water must reach the whole body.', 'গোসলে সারা শরীরে পানি পৌঁছানো আবশ্যক।'), True,
           Q('That is the core of ghusl; a dry spot left on purpose means the ghusl is not complete.', 'এটিই গোসলের মূল; ইচ্ছা করে শুকনো জায়গা রাখলে গোসল পূর্ণ হয় না।'), 'Quran 5:6'),
        fill(Q('Complete the sentence', 'বাক্যটি পূর্ণ করুন'), Q('If there is no water, purify yourself with clean', 'পানি না পেলে পবিত্র'), Q('(tayammum).', 'দিয়ে পবিত্র হও (তায়াম্মুম)।'),
             [Q('earth', 'মাটি'), Q('milk', 'দুধ'), Q('perfume', 'সুগন্ধি'), Q('juice', 'শরবত')], 0,
             Q('"…and you find no water, then seek clean earth."', '"…আর পানি না পাও, তবে পবিত্র মাটি দিয়ে তায়াম্মুম করো।"'), 'Quran 4:43'),
        tf(Q('Tayammum is allowed for someone who is ill and would be harmed by water.', 'পানিতে ক্ষতি হবে এমন অসুস্থ ব্যক্তির জন্য তায়াম্মুম জায়েজ।'), True,
           Q('"And if you are ill, or on a journey… and find no water, then seek clean earth."', '"আর যদি তোমরা অসুস্থ হও বা সফরে থাকো… এবং পানি না পাও, তবে পবিত্র মাটি দিয়ে তায়াম্মুম করো।"'), 'Quran 5:6'),
        choice(Q('In tayammum, what is wiped?', 'তায়াম্মুমে কী মাসেহ করা হয়?'),
               [Q('The feet', 'পা'), Q('The face and hands', 'মুখমণ্ডল ও হাত'), Q('The head', 'মাথা'), Q('The whole body', 'সারা শরীর')], 1,
               Q('"…and wipe your faces and hands with it."', '"…এবং তা দিয়ে মুখমণ্ডল ও হাত মাসেহ করো।"'), 'Quran 5:6'),
        tf(Q('When water is found and can be used, the tayammum no longer counts.', 'পানি পাওয়া গেলে এবং ব্যবহার করা গেলে তায়াম্মুম আর থাকে না।'), True,
           Q('"Clean earth is the Muslim’s means of purification… when he finds water, let him touch it to his skin."', '"পবিত্র মাটি মুসলিমের পবিত্রতার উপায়… যখন সে পানি পাবে, তখন যেন তা শরীরে লাগায়।"'), 'Sunan Abi Dawud 332; Jami‘ at-Tirmidhi 124'),
    ]),
])

SALAH = ('salah-steps', Q('Learn to pray', 'নামাজ শিখি'),
         Q('Before the prayer, each position and what is said in it, and the rak‘ahs.', 'নামাজের আগে, প্রতিটি অবস্থা ও তাতে কী পড়া হয়, এবং রাকাত।'), None, 'clock', [
    ('before', Q('Before the prayer', 'নামাজের আগে'), 'lesson', [
        choice(Q('Before salah, the body, clothes and place must be…?', 'নামাজের আগে শরীর, কাপড় ও জায়গা কেমন হতে হবে?'),
               [Q('Clean (pure)', 'পবিত্র'), Q('New', 'নতুন'), Q('Expensive', 'দামি'), Q('Perfumed', 'সুগন্ধিযুক্ত')], 0,
               Q('"And your clothing purify." Purity of body, clothes and place is a condition of salah.', '"আর তোমার পোশাক পবিত্র রাখো।" শরীর, কাপড় ও জায়গা পবিত্র থাকা নামাজের শর্ত।'), 'Quran 74:4'),
        tf(Q('A prayer offered before its time has begun is valid.', 'ওয়াক্ত শুরুর আগে পড়া নামাজ সহিহ হয়।'), False,
           Q('"Indeed, prayer has been prescribed for the believers at fixed times."', '"নিশ্চয় নামাজ মুমিনদের ওপর নির্দিষ্ট সময়ে ফরজ।"'), 'Quran 4:103'),
        tf(Q('Covering the ‘awrah (the parts that must be covered) is a condition of salah.', 'সতর ঢাকা নামাজের শর্ত।'), True,
           Q('"O children of Adam, take your adornment at every masjid."', '"হে আদম সন্তান, প্রত্যেক নামাজের সময় তোমরা সাজসজ্জা (পোশাক) গ্রহণ করো।"'), 'Quran 7:31'),
        choice(Q('Where is the intention (niyyah) for salah made?', 'নামাজের নিয়ত কোথায় করা হয়?'),
               [Q('In the heart', 'অন্তরে'), Q('On paper', 'কাগজে'), Q('Only aloud to others', 'শুধু অন্যকে শুনিয়ে'), Q('After the salam', 'সালামের পর')], 0,
               Q('"Actions are only by intentions" — the intention is the heart’s purpose to pray this prayer.', '"সকল কাজ নিয়তের ওপর নির্ভরশীল" — নিয়ত হলো অন্তরে এই নামাজ পড়ার সংকল্প।'), 'Sahih al-Bukhari 1'),
        order(Q('Put the phrases of the adhan in order', 'আজানের বাক্যগুলো ক্রমানুসারে সাজান'),
              [Q('Allahu Akbar', 'আল্লাহু আকবার'), Q('Ashhadu an la ilaha illallah', 'আশহাদু আল্লা ইলাহা ইল্লাল্লাহ'),
               Q('Ashhadu anna Muhammadar-Rasulullah', 'আশহাদু আন্না মুহাম্মাদার রাসুলুল্লাহ'), Q('Hayya ‘alas-salah', 'হাইয়া আলাস সালাহ'),
               Q('Hayya ‘alal-falah', 'হাইয়া আলাল ফালাহ'), Q('Allahu Akbar (again)', 'আল্লাহু আকবার (আবার)'), Q('La ilaha illallah', 'লা ইলাহা ইল্লাল্লাহ')],
              Q('The adhan taught to ‘Abdullah ibn Zayd (RA); each phrase is repeated as the mu’adhdhin calls.', 'আবদুল্লাহ ইবনে যায়েদ (রা.)-কে শেখানো আজান; মুয়াজ্জিন প্রতিটি বাক্য নির্দিষ্ট সংখ্যায় বলেন।'), 'Sunan Abi Dawud 499'),
        fill(Q('In the Fajr adhan', 'ফজরের আজানে'), Q('"As-salatu khayrun minan-nawm": prayer is better than', '"আসসালাতু খাইরুম মিনান নাউম": নামাজ'), Q('', 'থেকে উত্তম'),
             [Q('sleep', 'ঘুম'), Q('food', 'খাবার'), Q('work', 'কাজ'), Q('play', 'খেলা')], 0,
             Q('It is added in the Fajr adhan only.', 'এটি শুধু ফজরের আজানে বলা হয়।'), 'Sunan Abi Dawud 500'),
        tf(Q('If you truly cannot find the qiblah, you try your best and pray in the direction you judge.', 'কিবলা কোন দিকে কোনোভাবেই জানতে না পারলে সাধ্যমতো চিন্তা করে যে দিক মনে হয় সেদিকে নামাজ পড়বেন।'), True,
           Q('"Allah does not burden a soul beyond its capacity"; facing the qiblah is required as far as one is able.', '"আল্লাহ কাউকে সাধ্যের বাইরে দায়িত্ব দেন না"; সাধ্যমতো কিবলামুখী হওয়া আবশ্যক।'), 'Quran 2:286; Quran 2:144'),
    ]),
    ('standing-ruku', Q('From takbir to ruku‘', 'তাকবির থেকে রুকু'), 'lesson', [
        order(Q('Put the first rak‘ah in order', 'প্রথম রাকাত ক্রমানুসারে সাজান'),
              [Q('Opening takbir: Allahu Akbar', 'শুরুর তাকবির: আল্লাহু আকবার'), Q('Recite al-Fatiha', 'সূরা ফাতিহা পড়া'),
               Q('Recite another surah or some ayahs', 'অন্য সূরা বা কিছু আয়াত পড়া'), Q('Ruku‘: Subhana Rabbiyal-‘Azim', 'রুকু: সুবহানা রাব্বিয়াল আযিম'),
               Q('Rise: Sami‘Allahu liman hamidah', 'ওঠা: সামি‘আল্লাহু লিমান হামিদাহ'), Q('First sujud', 'প্রথম সিজদা'),
               Q('Sit briefly between the two', 'দুই সিজদার মাঝে একটু বসা'), Q('Second sujud', 'দ্বিতীয় সিজদা')],
              Q('This is the order he ﷺ taught the man who prayed badly.', 'যে ব্যক্তি ভুলভাবে নামাজ পড়েছিল, তাকে নবী ﷺ এই ক্রম শিখিয়েছিলেন।'), 'Sahih al-Bukhari 757; Sahih al-Bukhari 789'),
        tf(Q('"Amin" is said after al-Fatiha.', 'সূরা ফাতিহার পর "আমিন" বলা হয়।'), True,
           Q('"When the imam says Amin, say Amin…"', '"ইমাম যখন আমিন বলে, তোমরাও আমিন বলো…"'), 'Sahih al-Bukhari 780'),
        fill(Q('What is said in ruku‘?', 'রুকুতে কী পড়া হয়?'), Q('Subhana Rabbiyal-', 'সুবহানা রাব্বিয়াল'), None,
             [Q('‘Azim', 'আযিম'), Q('A‘la', 'আ‘লা'), Q('Hamd', 'হামদ'), Q('Akbar', 'আকবার')], 0,
             Q('"Glory be to my Lord, the Most Great."', '"আমার মহান রবের পবিত্রতা ঘোষণা করছি।"'), 'Sahih Muslim 772'),
        tf(Q('In ruku‘ the back is kept level, the head neither raised nor lowered.', 'রুকুতে পিঠ সমান রাখা হয়, মাথা উঁচুও নয় নিচুও নয়।'), True,
           Q('‘A’ishah (RA): when he bowed he neither raised his head nor lowered it, but kept it in between.', 'আয়েশা (রা.): রুকুতে তিনি মাথা উঁচুও করতেন না, নিচুও করতেন না, বরং মাঝামাঝি রাখতেন।'), 'Sahih Muslim 498'),
        choice(Q('When the imam says "Sami‘Allahu liman hamidah", the people behind him say…?', 'ইমাম "সামি‘আল্লাহু লিমান হামিদাহ" বললে পেছনের মুসল্লিরা কী বলেন?'),
               [Q('Amin', 'আমিন'), Q('Allahu Akbar', 'আল্লাহু আকবার'), Q('Rabbana wa lakal-hamd', 'রাব্বানা ওয়া লাকাল হামদ'), Q('Subhanallah', 'সুবহানাল্লাহ')], 2,
               Q('"…say: Allahumma Rabbana lakal-hamd (O Allah, our Lord, to You is all praise)."', '"…তোমরা বলো: আল্লাহুম্মা রাব্বানা লাকাল হামদ (হে আল্লাহ, আমাদের রব, সব প্রশংসা আপনার)।"'), 'Sahih al-Bukhari 796'),
        match(Q('Match each phrase to its meaning', 'প্রতিটি বাক্যের অর্থ মেলান'),
              [(Q('Allahu Akbar', 'আল্লাহু আকবার'), Q('Allah is the Greatest', 'আল্লাহ সবচেয়ে বড়')),
               (Q('Subhana Rabbiyal-‘Azim', 'সুবহানা রাব্বিয়াল আযিম'), Q('Glory be to my Lord, the Most Great', 'আমার মহান রবের পবিত্রতা')),
               (Q('Sami‘Allahu liman hamidah', 'সামি‘আল্লাহু লিমান হামিদাহ'), Q('Allah hears whoever praises Him', 'যে প্রশংসা করে আল্লাহ তা শোনেন')),
               (Q('Rabbana wa lakal-hamd', 'রাব্বানা ওয়া লাকাল হামদ'), Q('Our Lord, to You is all praise', 'হে আমাদের রব, সব প্রশংসা আপনার'))],
              Q('The words of the standing and the ruku‘.', 'দাঁড়ানো ও রুকুর বাক্যগুলো।'), 'Sahih al-Bukhari 789; Sahih Muslim 772'),
        tf(Q('We should recite the Quran in ruku‘ and sujud.', 'রুকু ও সিজদায় কুরআন তিলাওয়াত করা উচিত।'), False,
           Q('"I have been forbidden to recite the Quran while bowing or prostrating."', '"রুকু বা সিজদা অবস্থায় কুরআন পড়তে আমাকে নিষেধ করা হয়েছে।"'), 'Sahih Muslim 479'),
    ]),
    ('sujud-sitting', Q('Sujud & sitting', 'সিজদা ও বৈঠক'), 'lesson', [
        choice(Q('On how many body parts did the Prophet ﷺ say to prostrate?', 'নবী ﷺ কয়টি অঙ্গের ওপর সিজদা করতে বলেছেন?'),
               [Q('Three', 'তিনটি'), Q('Five', 'পাঁচটি'), Q('Seven', 'সাতটি'), Q('Ten', 'দশটি')], 2,
               Q('"…on seven bones: the forehead (and nose), the two hands, the two knees and the ends of the two feet."', '"…সাতটি অঙ্গের ওপর: কপাল (ও নাক), দুই হাত, দুই হাঁটু ও দুই পায়ের আঙুল।"'), 'Sahih al-Bukhari 812'),
        match(Q('What is said where? Match them', 'কোথায় কী পড়া হয়? মেলান'),
              [(Q('Subhana Rabbiyal-‘Azim', 'সুবহানা রাব্বিয়াল আযিম'), Q('Ruku‘', 'রুকু')),
               (Q('Subhana Rabbiyal-A‘la', 'সুবহানা রাব্বিয়াল আ‘লা'), Q('Sujud', 'সিজদা')),
               (Q('Rabbighfir li', 'রাব্বিগফিরলি'), Q('Between the two sujud', 'দুই সিজদার মাঝে')),
               (Q('At-tahiyyatu lillah…', 'আত্তাহিয়্যাতু লিল্লাহ…'), Q('The sitting (tashahhud)', 'বৈঠক (তাশাহহুদ)'))],
              Q('Each position has its own remembrance.', 'প্রতিটি অবস্থার নিজস্ব জিকির আছে।'), 'Sahih Muslim 772; Sunan Abi Dawud 874; Sahih al-Bukhari 831'),
        fill(Q('What is said in sujud?', 'সিজদায় কী পড়া হয়?'), Q('Subhana Rabbiyal-', 'সুবহানা রাব্বিয়াল'), None,
             [Q('‘Azim', 'আযিম'), Q('A‘la', 'আ‘লা'), Q('Karim', 'কারিম'), Q('Hamd', 'হামদ')], 1,
             Q('"Glory be to my Lord, the Most High."', '"আমার সর্বোচ্চ রবের পবিত্রতা ঘোষণা করছি।"'), 'Sahih Muslim 772'),
        tf(Q('A servant is closest to his Lord in sujud, so make much dua there.', 'সিজদায় বান্দা তার রবের সবচেয়ে নিকটে থাকে, তাই সেখানে বেশি দোয়া করো।'), True,
           Q('"The closest a servant is to his Lord is while he is prostrating, so make much dua."', '"বান্দা তার রবের সবচেয়ে নিকটে থাকে সিজদা অবস্থায়, তাই বেশি করে দোয়া করো।"'), 'Sahih Muslim 482'),
        tf(Q('In a four-rak‘ah prayer there is a sitting after the second rak‘ah and another at the end.', 'চার রাকাতের নামাজে দ্বিতীয় রাকাতের পর একটি এবং শেষে আরেকটি বৈঠক আছে।'), True,
           Q('When he ﷺ once stood up without the first sitting, he made two prostrations of forgetfulness for it.', 'একবার নবী ﷺ প্রথম বৈঠক না করে দাঁড়িয়ে গেলে তার জন্য সাহু সিজদা করেছিলেন।'), 'Sahih al-Bukhari 829'),
        choice(Q('What is recited in the first sitting, after two rak‘ahs?', 'দুই রাকাতের পর প্রথম বৈঠকে কী পড়া হয়?'),
               [Q('Al-Fatiha', 'সূরা ফাতিহা'), Q('The tashahhud (at-tahiyyat)', 'তাশাহহুদ (আত্তাহিয়্যাতু)'), Q('Ayat al-Kursi', 'আয়াতুল কুরসি'), Q('The adhan', 'আজান')], 1,
               Q('"When you sit after every two rak‘ahs, say: At-tahiyyatu lillah…"', '"প্রতি দুই রাকাত পর যখন বসবে, বলবে: আত্তাহিয়্যাতু লিল্লাহ…"'), 'Sahih al-Bukhari 831; Sunan an-Nasa’i (from Ibn Mas‘ud)'),
    ]),
    ('tashahhud-salam', Q('Tashahhud, salawat & salam', 'তাশাহহুদ, দরুদ ও সালাম'), 'lesson', [
        order(Q('Put the tashahhud in order (Ibn Mas‘ud’s wording)', 'তাশাহহুদ ক্রমানুসারে সাজান (ইবনে মাসউদের বর্ণনা)'),
              [Q('At-tahiyyatu lillahi', 'আত্তাহিয়্যাতু লিল্লাহি'), Q('was-salawatu wat-tayyibat', 'ওয়াস সালাওয়াতু ওয়াত তাইয়্যিবাতু'),
               Q('As-salamu ‘alayka ayyuhan-nabiyyu wa rahmatullahi wa barakatuh', 'আসসালামু আলাইকা আইয়্যুহান নাবিয়্যু ওয়া রাহমাতুল্লাহি ওয়া বারাকাতুহ'),
               Q('As-salamu ‘alayna wa ‘ala ‘ibadillahis-salihin', 'আসসালামু আলাইনা ওয়া আলা ইবাদিল্লাহিস সালিহিন'),
               Q('Ashhadu an la ilaha illallah', 'আশহাদু আল্লা ইলাহা ইল্লাল্লাহু'), Q('wa ashhadu anna Muhammadan ‘abduhu wa rasuluh', 'ওয়া আশহাদু আন্না মুহাম্মাদান আবদুহু ওয়া রাসুলুহ')],
              Q('Ibn Mas‘ud (RA) learnt it from the Prophet ﷺ like a surah. (Other authentic wordings exist, e.g. Ibn ‘Abbas’s.)', 'ইবনে মাসউদ (রা.) নবী ﷺ থেকে সূরার মতো করে এটি শিখেছেন। (ইবনে আব্বাসের বর্ণনার মতো অন্য সহিহ শব্দও আছে।)'), 'Sahih al-Bukhari 831; Sahih al-Bukhari 6265'),
        match(Q('Match each part of the tashahhud to its meaning', 'তাশাহহুদের প্রতিটি অংশের অর্থ মেলান'),
              [(Q('At-tahiyyatu lillah', 'আত্তাহিয়্যাতু লিল্লাহ'), Q('All greetings are for Allah', 'সকল সম্মান-অভিবাদন আল্লাহর জন্য')),
               (Q('As-salamu ‘alayka ayyuhan-nabiyy', 'আসসালামু আলাইকা আইয়্যুহান নাবিয়্যু'), Q('Peace be upon you, O Prophet', 'হে নবী, আপনার ওপর শান্তি বর্ষিত হোক')),
               (Q('As-salamu ‘alayna wa ‘ala ‘ibadillahis-salihin', 'আসসালামু আলাইনা ওয়া আলা ইবাদিল্লাহিস সালিহিন'), Q('Peace be upon us and on Allah’s righteous servants', 'শান্তি বর্ষিত হোক আমাদের ওপর ও আল্লাহর নেক বান্দাদের ওপর')),
               (Q('Ashhadu an la ilaha illallah', 'আশহাদু আল্লা ইলাহা ইল্লাল্লাহ'), Q('I testify that there is no god but Allah', 'আমি সাক্ষ্য দিচ্ছি, আল্লাহ ছাড়া কোনো ইলাহ নেই'))],
              Q('Understanding what we say makes the prayer come alive.', 'যা পড়ছি তা বুঝলে নামাজ প্রাণবন্ত হয়।'), 'Sahih al-Bukhari 831'),
        choice(Q('Besides Muhammad ﷺ, which prophet is named in the salawat (Durud Ibrahim)?', 'দরুদে ইবরাহিমে মুহাম্মাদ ﷺ ছাড়া আর কোন নবীর নাম আছে?'),
               [Q('Musa', 'মুসা (আ.)'), Q('Ibrahim', 'ইবরাহিম (আ.)'), Q('Isa', 'ঈসা (আ.)'), Q('Nuh', 'নূহ (আ.)')], 1,
               Q('"…as You sent blessings on Ibrahim and the family of Ibrahim…"', '"…যেমন আপনি ইবরাহিম ও ইবরাহিমের পরিবারের ওপর রহমত পাঠিয়েছেন…"'), 'Sahih al-Bukhari 3370'),
        tf(Q('The salawat (Durud Ibrahim) is recited in the last sitting, after the tashahhud.', 'দরুদে ইবরাহিম শেষ বৈঠকে তাশাহহুদের পর পড়া হয়।'), True,
           Q('The companions asked how to send salawat on him in the prayer, and he ﷺ taught this.', 'সাহাবিরা নামাজে কীভাবে দরুদ পড়বেন জিজ্ঞেস করলে নবী ﷺ এটি শেখান।'), 'Sahih al-Bukhari 3370'),
        tf(Q('Before the salam, it is good to seek refuge from four things: Hell, the grave, the trials of life and death, and the Dajjal.', 'সালামের আগে চারটি জিনিস থেকে আশ্রয় চাওয়া ভালো: জাহান্নাম, কবরের আজাব, জীবন-মৃত্যুর ফিতনা ও দাজ্জাল।'), True,
           Q('"When one of you finishes the last tashahhud, let him seek refuge with Allah from four…"', '"তোমাদের কেউ শেষ তাশাহহুদ শেষ করলে চারটি জিনিস থেকে আল্লাহর কাছে আশ্রয় চাইবে…"'), 'Sahih Muslim 588'),
        choice(Q('With which words does the prayer end?', 'কোন বাক্য দিয়ে নামাজ শেষ হয়?'),
               [Q('Allahu Akbar', 'আল্লাহু আকবার'), Q('Amin', 'আমিন'), Q('Bismillah', 'বিসমিল্লাহ'), Q('As-salamu ‘alaykum wa rahmatullah', 'আসসালামু আলাইকুম ওয়া রাহমাতুল্লাহ')], 3,
               Q('"…its closing is the salam."', '"…নামাজের সমাপ্তি সালাম।"'), 'Sunan Abi Dawud 61; Sahih Muslim 582'),
    ]),
    ('rakahs-times', Q('Rak‘ahs & times', 'রাকাত ও ওয়াক্ত'), 'lesson', [
        match(Q('Match each prayer to its time', 'প্রতিটি নামাজের সময় মেলান'),
              [(Q('Fajr', 'ফজর'), Q('From dawn until sunrise', 'সুবহে সাদিক থেকে সূর্যোদয় পর্যন্ত')), (Q('Dhuhr', 'যোহর'), Q('After the sun passes its height', 'সূর্য মাথার ওপর থেকে হেলে পড়ার পর')),
               (Q('Asr', 'আসর'), Q('The afternoon', 'বিকেল')), (Q('Maghrib', 'মাগরিব'), Q('Just after sunset', 'সূর্যাস্তের পরপর')),
               (Q('Isha', 'এশা'), Q('Night, after the twilight goes', 'রাতে, পশ্চিম আকাশের লালিমা মিলিয়ে যাওয়ার পর'))],
              Q('The five times the Prophet ﷺ described.', 'নবী ﷺ যে পাঁচ সময়ের বর্ণনা দিয়েছেন।'), 'Sahih Muslim 612'),
        fill(Q('Count the fard rak‘ahs', 'ফরজ রাকাত গুনুন'), Q('Fard rak‘ahs in a day (not travelling): 2 + 4 + 4 + 3 + 4 =', 'দিনে ফরজ রাকাত (মুসাফির না হলে): ২ + ৪ + ৪ + ৩ + ৪ ='), None,
             [Q('17', '১৭'), Q('15', '১৫'), Q('20', '২০'), Q('12', '১২')], 0,
             Q('Fajr 2, Dhuhr 4, Asr 4, Maghrib 3, Isha 4 = 17.', 'ফজর ২, যোহর ৪, আসর ৪, মাগরিব ৩, এশা ৪ = ১৭।'), 'Sahih al-Bukhari 350'),
        choice(Q('Which prayer is prayed after the sun passes its highest point?', 'সূর্য মাথার ওপর থেকে হেলে পড়ার পর কোন নামাজ?'),
               [Q('Fajr', 'ফজর'), Q('Dhuhr', 'যোহর'), Q('Maghrib', 'মাগরিব'), Q('Isha', 'এশা')], 1,
               Q('"The time of Dhuhr is when the sun has passed the meridian…"', '"সূর্য হেলে পড়লে যোহরের সময়…"'), 'Sahih Muslim 612'),
        tf(Q('A traveller prays Maghrib as two rak‘ahs.', 'মুসাফির মাগরিব দুই রাকাত পড়েন।'), False,
           Q('Only four-rak‘ah prayers are shortened; Maghrib stays three.', 'শুধু চার রাকাতের নামাজ কসর হয়; মাগরিব তিন রাকাতই থাকে।'), 'Sahih al-Bukhari 1090'),
        tf(Q('The Prophet ﷺ forbade praying at the moment the sun is rising.', 'সূর্য উদয়ের মুহূর্তে নামাজ পড়তে নবী ﷺ নিষেধ করেছেন।'), True,
           Q('‘Uqbah (RA): three times he forbade us to pray — when the sun rises, at its height, and when it sets.', 'উকবা (রা.): তিন সময়ে নামাজ পড়তে তিনি নিষেধ করেছেন — সূর্যোদয়, ঠিক দুপুর ও সূর্যাস্তের সময়।'), 'Sahih Muslim 831'),
        choice(Q('How many rak‘ahs is the Eid prayer?', 'ঈদের নামাজ কত রাকাত?'),
               [Q('2', '২'), Q('3', '৩'), Q('4', '৪'), Q('1', '১')], 0,
               Q('Ibn ‘Abbas (RA): he ﷺ went out on the day of Eid and prayed two rak‘ahs.', 'ইবনে আব্বাস (রা.): নবী ﷺ ঈদের দিন বের হয়ে দুই রাকাত নামাজ পড়েছেন।'), 'Sahih al-Bukhari 989'),
    ]),
    ('review', Q('Unit review', 'ইউনিট রিভিউ'), 'checkpoint', [
        match(Q('What is said where? Match them', 'কোথায় কী পড়া হয়? মেলান'),
              [(Q('Allahu Akbar', 'আল্লাহু আকবার'), Q('Opening the prayer', 'নামাজ শুরু')), (Q('Al-Fatiha', 'সূরা ফাতিহা'), Q('Standing', 'দাঁড়ানো অবস্থায়')),
               (Q('Subhana Rabbiyal-A‘la', 'সুবহানা রাব্বিয়াল আ‘লা'), Q('Sujud', 'সিজদা')), (Q('As-salamu ‘alaykum wa rahmatullah', 'আসসালামু আলাইকুম ওয়া রাহমাতুল্লাহ'), Q('Ending the prayer', 'নামাজ শেষ'))],
              Q('"Its opening is the takbir and its closing is the salam."', '"নামাজের শুরু তাকবির আর শেষ সালাম।"'), 'Sunan Abi Dawud 61'),
        tf(Q('Rabbighfir li is said in ruku‘.', 'রাব্বিগফিরলি রুকুতে পড়া হয়।'), False,
           Q('"Rabbighfir li" is said between the two prostrations; in ruku‘ we say "Subhana Rabbiyal-‘Azim".', '"রাব্বিগফিরলি" পড়া হয় দুই সিজদার মাঝে; রুকুতে "সুবহানা রাব্বিয়াল আযিম"।'), 'Sunan Abi Dawud 874'),
        choice(Q('How many sujud are in each rak‘ah?', 'প্রতি রাকাতে কয়টি সিজদা?'),
               [Q('1', '১'), Q('2', '২'), Q('3', '৩'), Q('4', '৪')], 1,
               Q('Prostrate, sit, prostrate again.', 'সিজদা, বসা, আবার সিজদা।'), 'Sahih al-Bukhari 757'),
        fill(Q('Complete the phrase', 'বাক্যটি পূর্ণ করুন'), Q('Sami‘Allahu liman', 'সামি‘আল্লাহু লিমান'), None,
             [Q('hamidah', 'হামিদাহ'), Q('‘Azim', 'আযিম'), Q('akbar', 'আকবার'), Q('rajim', 'রাজিম')], 0,
             Q('Said while rising from ruku‘.', 'রুকু থেকে ওঠার সময় বলা হয়।'), 'Sahih al-Bukhari 789'),
        tf(Q('The adhan begins with "Allahu Akbar" and ends with "La ilaha illallah".', 'আজান "আল্লাহু আকবার" দিয়ে শুরু ও "লা ইলাহা ইল্লাল্লাহ" দিয়ে শেষ হয়।'), True,
           Q('As taught to ‘Abdullah ibn Zayd (RA).', 'আবদুল্লাহ ইবনে যায়েদ (রা.)-কে যেভাবে শেখানো হয়েছিল।'), 'Sunan Abi Dawud 499'),
        choice(Q('In which position is a servant closest to his Lord?', 'কোন অবস্থায় বান্দা তার রবের সবচেয়ে নিকটে?'),
               [Q('Standing', 'দাঁড়ানো'), Q('Ruku‘', 'রুকু'), Q('Sujud', 'সিজদা'), Q('Sitting', 'বসা')], 2,
               Q('"…while he is prostrating, so make much dua."', '"…সিজদা অবস্থায়, তাই বেশি দোয়া করো।"'), 'Sahih Muslim 482'),
        tf(Q('Asr has four fard rak‘ahs for one who is not travelling.', 'মুসাফির না হলে আসরে চার রাকাত ফরজ।'), True,
           Q('Dhuhr, Asr and Isha have four each.', 'যোহর, আসর ও এশায় চার রাকাত করে।'), 'Sahih al-Bukhari 350'),
    ]),
])

JANAZAH = ('janazah', Q('Learn about janazah', 'জানাযা শিখি'),
           Q('What to do after a death, the janazah prayer, burial and visiting graves.', 'মৃত্যুর পর করণীয়, জানাযার নামাজ, দাফন ও কবর জিয়ারত।'), None, 'hand-heart', [
    ('after-death', Q('After a death', 'মৃত্যুর পর করণীয়'), 'lesson', [
        fill(Q('What do we say on hearing of a death?', 'মৃত্যুর খবর শুনলে কী বলি?'), Q('Inna lillahi wa inna ilayhi', 'ইন্না লিল্লাহি ওয়া ইন্না ইলাইহি'), None,
             [Q('raji‘un', 'রাজিউন'), Q('akbar', 'আকবার'), Q('‘alaykum', 'আলাইকুম'), Q('al-hamd', 'আল-হামদ')], 0,
             Q('"Indeed we belong to Allah, and to Him we will return."', '"নিশ্চয় আমরা আল্লাহর জন্য এবং নিশ্চয় আমরা তাঁরই দিকে ফিরে যাব।"'), 'Quran 2:156'),
        tf(Q('The Prophet ﷺ closed the eyes of Abu Salamah after he died.', 'আবু সালামা (রা.)-এর মৃত্যুর পর নবী ﷺ তাঁর চোখ বন্ধ করে দিয়েছিলেন।'), True,
           Q('He ﷺ closed his eyes and said: "When the soul is taken, the sight follows it."', 'তিনি চোখ বন্ধ করে বললেন: "যখন রুহ কবজ করা হয়, দৃষ্টি তার অনুসরণ করে।"'), 'Sahih Muslim 920'),
        tf(Q('The deceased is washed an odd number of times, as the Prophet ﷺ instructed.', 'নবী ﷺ-এর নির্দেশমতো মৃতকে বেজোড় সংখ্যকবার গোসল দেওয়া হয়।'), True,
           Q('"Wash her three or five times, or more if you see fit… and begin with her right side and the places of wudu."', '"তাকে তিন বা পাঁচবার, প্রয়োজন মনে করলে আরও বেশি গোসল দাও… ডান দিক ও অজুর অঙ্গ থেকে শুরু করো।"'), 'Sahih al-Bukhari 1253; Sahih al-Bukhari 167'),
        tf(Q('The martyrs of Uhud were buried without being washed.', 'উহুদের শহিদদের গোসল ছাড়াই দাফন করা হয়েছিল।'), True,
           Q('He ﷺ ordered them buried in their blood, without washing.', 'নবী ﷺ তাঁদের রক্তমাখা অবস্থায় গোসল ছাড়া দাফনের নির্দেশ দেন।'), 'Sahih al-Bukhari 1343'),
        choice(Q('What colour of cloth did the Prophet ﷺ recommend for the shroud?', 'কাফনের জন্য নবী ﷺ কোন রঙের কাপড় পছন্দ করেছেন?'),
               [Q('Black', 'কালো'), Q('Green', 'সবুজ'), Q('Red', 'লাল'), Q('White', 'সাদা')], 3,
               Q('"Wear white clothes… and shroud your dead in them."', '"তোমরা সাদা পোশাক পরো… এবং তাতে তোমাদের মৃতদের কাফন দাও।"'), 'Sunan Abi Dawud 3878; Jami‘ at-Tirmidhi 994'),
        tf(Q('The deceased’s debts are paid before the inheritance is shared out.', 'মৃতের ঋণ মিরাস বণ্টনের আগে পরিশোধ করা হয়।'), True,
           Q('"…after any bequest he made or debt."', '"…তার অসিয়ত পূরণ ও ঋণ পরিশোধের পর।"'), 'Quran 4:11–12'),
        choice(Q('When Ja‘far (RA) was martyred, what did the Prophet ﷺ tell people to do for his family?', 'জাফর (রা.) শহিদ হলে নবী ﷺ তাঁর পরিবারের জন্য কী করতে বলেছিলেন?'),
               [Q('Make food for them', 'তাদের জন্য খাবার তৈরি করো'), Q('Hold a feast at their house', 'তাদের বাড়িতে ভোজ করো'), Q('Leave them alone for a year', 'এক বছর তাদের থেকে দূরে থাকো'), Q('Nothing', 'কিছু না')], 0,
               Q('"Make food for the family of Ja‘far, for something has come to them that keeps them busy."', '"জাফরের পরিবারের জন্য খাবার তৈরি করো, কারণ তাদের ওপর এমন বিপদ এসেছে যা তাদের ব্যস্ত রেখেছে।"'), 'Sunan Abi Dawud 3132; Jami‘ at-Tirmidhi 998'),
    ]),
    ('prayer', Q('The janazah prayer', 'জানাযার নামাজ'), 'lesson', [
        choice(Q('How many takbirs are in the janazah prayer?', 'জানাযার নামাজে কয়টি তাকবির?'),
               [Q('2', '২'), Q('3', '৩'), Q('4', '৪'), Q('5', '৫')], 2,
               Q('He ﷺ prayed over the Negus with four takbirs.', 'নবী ﷺ চার তাকবিরে নাজাশির জানাযা পড়েছেন।'), 'Sahih al-Bukhari 1333'),
        tf(Q('The janazah prayer has ruku‘ and sujud.', 'জানাযার নামাজে রুকু ও সিজদা আছে।'), False,
           Q('It is prayed standing: takbirs, praise, salawat and dua, then the salam.', 'এটি দাঁড়িয়ে পড়া হয়: তাকবির, প্রশংসা, দরুদ ও দোয়া, তারপর সালাম।'), 'Sahih al-Bukhari 1333'),
        choice(Q('What is the heart of the janazah duas?', 'জানাযার দোয়ার মূল বিষয় কী?'),
               [Q('Asking forgiveness and mercy for the deceased', 'মৃতের জন্য ক্ষমা ও রহমত চাওয়া'), Q('Praising his wealth', 'তার সম্পদের প্রশংসা'),
                Q('Asking for rain', 'বৃষ্টি চাওয়া'), Q('Reciting poetry', 'কবিতা পাঠ')], 0,
               Q('"When you pray over the deceased, make your dua for him sincere."', '"মৃতের জানাযা পড়লে তার জন্য আন্তরিকভাবে দোয়া করো।"'), 'Sunan Abi Dawud 3199'),
        choice(Q('What does "Allahummaghfir lahu warhamhu" mean?', '"আল্লাহুম্মাগফির লাহু ওয়ারহামহু" অর্থ কী?'),
               [Q('O Allah, give him wealth', 'হে আল্লাহ, তাকে সম্পদ দিন'), Q('O Allah, forgive him and have mercy on him', 'হে আল্লাহ, তাকে ক্ষমা করুন ও তার প্রতি দয়া করুন'),
                Q('O Allah, guide us', 'হে আল্লাহ, আমাদের হেদায়াত দিন'), Q('O Allah, send rain', 'হে আল্লাহ, বৃষ্টি দিন')], 1,
               Q('The opening of a janazah dua the Prophet ﷺ made, reported by ‘Awf ibn Malik (RA).', 'আউফ ইবনে মালিক (রা.) বর্ণিত নবীজির ﷺ জানাযার দোয়ার শুরু।'), 'Sahih Muslim 963'),
        tf(Q('If a hundred Muslims pray over someone, interceding for him, their intercession for him is accepted.', 'কারো জানাযায় একশো মুসলিম তার জন্য সুপারিশ করে নামাজ পড়লে তাদের সুপারিশ কবুল হয়।'), True,
           Q('In another narration: forty men who associate nothing with Allah.', 'আরেক বর্ণনায়: চল্লিশজন, যারা আল্লাহর সঙ্গে কিছু শরিক করে না।'), 'Sahih Muslim 947; Sahih Muslim 948'),
        tf(Q('Whoever stays with the funeral until the burial gets two qirats of reward, each like a great mountain.', 'যে দাফন পর্যন্ত জানাযার সঙ্গে থাকে সে দুই কিরাত সওয়াব পায়, প্রতিটি বিশাল পাহাড়ের মতো।'), True,
           Q('One qirat for the prayer, two for staying until the burial.', 'নামাজে এক কিরাত, দাফন পর্যন্ত থাকলে দুই কিরাত।'), 'Sahih al-Bukhari 1325'),
    ]),
    ('burial', Q('Burial & visiting graves', 'দাফন ও কবর জিয়ারত'), 'lesson', [
        tf(Q('The deceased is laid in the grave facing the qiblah.', 'মৃতকে কবরে কিবলামুখী করে শোয়ানো হয়।'), True,
           Q('On the right side facing the qiblah — the unbroken practice of the Muslims.', 'ডান কাতে কিবলামুখী — মুসলিমদের অবিচ্ছিন্ন আমল।'), 'Ijma‘ (agreed practice)'),
        choice(Q('What is said while placing the body in the grave?', 'লাশ কবরে রাখার সময় কী বলা হয়?'),
               [Q('Allahu Akbar', 'আল্লাহু আকবার'), Q('Bismillah wa ‘ala millati Rasulillah', 'বিসমিল্লাহি ওয়া আলা মিল্লাতি রাসুলিল্লাহ'), Q('Amin', 'আমিন'), Q('Nothing', 'কিছু না')], 1,
               Q('"In the name of Allah, and upon the way of the Messenger of Allah."', '"আল্লাহর নামে এবং আল্লাহর রাসুলের আদর্শের ওপর।"'), 'Sunan Abi Dawud 3213; Jami‘ at-Tirmidhi 1046'),
        choice(Q('After a burial, the Prophet ﷺ said: ask forgiveness for your brother and ask that he be made firm, for he is now…', 'দাফনের পর নবী ﷺ বললেন: তোমাদের ভাইয়ের জন্য ক্ষমা চাও ও দৃঢ়তা চাও, কারণ এখন তাকে…'),
               [Q('…being questioned', '…প্রশ্ন করা হচ্ছে'), Q('…asleep', '…ঘুমিয়ে আছে'), Q('…travelling', '…সফর করছে'), Q('…hearing poetry', '…কবিতা শুনছে')], 0,
               Q('"…for he is now being questioned."', '"…কারণ এখন তাকে প্রশ্ন করা হচ্ছে।"'), 'Sunan Abi Dawud 3221'),
        tf(Q('The Prophet ﷺ forbade building over graves and plastering them.', 'নবী ﷺ কবরের ওপর স্থাপনা বানাতে ও কবর পাকা করতে নিষেধ করেছেন।'), True,
           Q('Jabir (RA): he forbade plastering graves, sitting on them and building over them.', 'জাবির (রা.): তিনি কবর পাকা করা, তার ওপর বসা ও স্থাপনা নির্মাণ নিষেধ করেছেন।'), 'Sahih Muslim 970'),
        choice(Q('What do we say on entering a graveyard?', 'কবরস্থানে প্রবেশ করে কী বলি?'),
               [Q('As-salamu ‘alaykum ahlad-diyari minal-mu’minina wal-muslimin…', 'আসসালামু আলাইকুম আহলাদ দিয়ারি মিনাল মুমিনিনা ওয়াল মুসলিমিন…'),
                Q('The adhan', 'আজান'), Q('Happy greetings', 'শুভেচ্ছা বাক্য'), Q('Nothing at all', 'কিছুই না')], 0,
               Q('"Peace be upon you, people of these dwellings, believers and Muslims; we will join you, if Allah wills…"', '"হে এই ঘরগুলোর মুমিন ও মুসলিম অধিবাসীরা, তোমাদের ওপর শান্তি; ইনশাআল্লাহ আমরাও তোমাদের সঙ্গে মিলিত হব…"'), 'Sahih Muslim 975'),
        tf(Q('Visiting graves reminds us of death.', 'কবর জিয়ারত মৃত্যুর কথা মনে করিয়ে দেয়।'), True,
           Q('"Visit the graves, for they remind you of death."', '"কবর জিয়ারত করো, কারণ তা মৃত্যুর কথা মনে করিয়ে দেয়।"'), 'Sahih Muslim 976'),
        tf(Q('Wailing, slapping the cheeks and tearing clothes over the dead is allowed.', 'মৃতের জন্য বিলাপ করা, গাল চাপড়ানো ও কাপড় ছেঁড়া জায়েজ।'), False,
           Q('"He is not one of us who slaps the cheeks, tears the clothes and calls out like the people of ignorance." Quiet tears are not blamed.', '"যে গাল চাপড়ায়, কাপড় ছেঁড়ে ও জাহেলি যুগের মতো চিৎকার করে, সে আমাদের দলভুক্ত নয়।" নীরবে কান্নায় দোষ নেই।'), 'Sahih al-Bukhari 1294; Sahih al-Bukhari 1303'),
    ]),
])


# ======================================================= Fasting, Zakat & Hajj
FASTING = ('fasting', Q('Learn to fast', 'রোজা শিখি'),
           Q('A day of fasting, what breaks a fast and what does not, and voluntary fasts.', 'রোজার একটি দিন, যা রোজা ভাঙে আর যা ভাঙে না, এবং নফল রোজা।'), None, 'moon', [
    ('a-day', Q('A day of fasting', 'রোজার একটি দিন'), 'lesson', [
        order(Q('Put a day of fasting in order', 'রোজার দিনটি ক্রমানুসারে সাজান'),
              [Q('Eat suhur before dawn', 'সুবহে সাদিকের আগে সেহরি খাওয়া'), Q('At true dawn (Fajr) the fast begins', 'সুবহে সাদিক (ফজর) থেকে রোজা শুরু'),
               Q('Hold back from food, drink and intimacy all day', 'সারাদিন পানাহার ও স্ত্রী-সহবাস থেকে বিরত থাকা'), Q('The sun sets: the fast ends', 'সূর্য ডুবলে রোজা শেষ'),
               Q('Break the fast (iftar), ideally with dates', 'ইফতার করা, সম্ভব হলে খেজুর দিয়ে')],
              Q('"…eat and drink until the white thread of dawn becomes distinct… then complete the fast until the night."', '"…খাও ও পান করো যতক্ষণ না ভোরের সাদা রেখা স্পষ্ট হয়… তারপর রাত পর্যন্ত রোজা পূর্ণ করো।"'), 'Quran 2:187'),
        tf(Q('Fasting Ramadan is obligatory on every adult, sane Muslim who is able.', 'রমজানের রোজা প্রত্যেক প্রাপ্তবয়স্ক, সুস্থ মস্তিষ্ক, সক্ষম মুসলিমের ওপর ফরজ।'), True,
           Q('"So whoever of you witnesses the month, let him fast it."', '"অতএব তোমাদের যে এ মাস পাবে, সে যেন রোজা রাখে।"'), 'Quran 2:185'),
        fill(Q('Complete the sentence', 'বাক্যটি পূর্ণ করুন'), Q('The fast lasts from true dawn until', 'রোজা সুবহে সাদিক থেকে'), Q('', 'পর্যন্ত'),
             [Q('sunset', 'সূর্যাস্ত'), Q('midnight', 'মধ্যরাত'), Q('noon', 'দুপুর'), Q('Isha', 'এশা')], 0,
             Q('"…then complete the fast until the night", which begins at sunset.', '"…তারপর রাত পর্যন্ত রোজা পূর্ণ করো" — রাত শুরু হয় সূর্যাস্তে।'), 'Quran 2:187'),
        tf(Q('The Sunnah is to eat suhur late and to hurry the iftar.', 'সুন্নাত হলো দেরিতে সেহরি খাওয়া এবং দ্রুত ইফতার করা।'), True,
           Q('"People will remain upon good as long as they hasten the iftar." Their suhur ended about fifty ayahs’ time before Fajr.', '"মানুষ ততদিন কল্যাণে থাকবে যতদিন দ্রুত ইফতার করবে।" তাঁদের সেহরি ফজরের প্রায় পঞ্চাশ আয়াত পড়ার সময় আগে শেষ হতো।'), 'Sahih al-Bukhari 1957; Sahih al-Bukhari 1921'),
        choice(Q('For children who have not yet reached puberty, fasting is…?', 'যে শিশুরা এখনো প্রাপ্তবয়স্ক হয়নি, তাদের জন্য রোজা…?'),
               [Q('Not yet obligatory, but they may be trained gently', 'এখনো ফরজ নয়, তবে ধীরে ধীরে অভ্যাস করানো যায়'), Q('Obligatory every day', 'প্রতিদিন ফরজ'),
                Q('Forbidden', 'নিষিদ্ধ'), Q('Only on Eid', 'শুধু ঈদের দিনে')], 0,
               Q('The companions had their children fast and gave them toys of wool to distract them until iftar.', 'সাহাবিরা শিশুদের রোজা রাখাতেন এবং ইফতার পর্যন্ত ভুলিয়ে রাখতে পশমের খেলনা দিতেন।'), 'Sahih al-Bukhari 1960'),
        tf(Q('Laylat al-Qadr is in Ramadan.', 'লাইলাতুল কদর রমজান মাসে।'), True,
           Q('The Quran was sent down in Ramadan, on the Night of Decree.', 'কুরআন রমজানে, কদরের রাতে নাজিল হয়েছে।'), 'Quran 2:185; Quran 97:1'),
    ]),
    ('breaks', Q('What breaks a fast?', 'কিসে রোজা ভাঙে?'), 'lesson', [
        tf(Q('Eating or drinking forgetfully breaks the fast.', 'ভুলে খেলে বা পান করলে রোজা ভেঙে যায়।'), False,
           Q('"Whoever forgets and eats or drinks, let him complete his fast; it is Allah who fed him."', '"যে ভুলে খেয়ে বা পান করে ফেলে, সে যেন রোজা পূর্ণ করে; আল্লাহই তাকে খাইয়েছেন।"'), 'Sahih al-Bukhari 1933'),
        tf(Q('Eating or drinking on purpose during the day breaks the fast.', 'দিনের বেলা ইচ্ছাকৃতভাবে খেলে বা পান করলে রোজা ভেঙে যায়।'), True,
           Q('The fast is holding back from these from dawn to sunset.', 'ভোর থেকে সূর্যাস্ত পর্যন্ত এগুলো থেকে বিরত থাকাই রোজা।'), 'Quran 2:187'),
        tf(Q('Brushing the teeth with a miswak does not break the fast.', 'মিসওয়াক করলে রোজা ভাঙে না।'), True,
           Q('‘Amir ibn Rabi‘ah (RA) saw the Prophet ﷺ use the miswak while fasting more times than he could count.', 'আমির ইবনে রাবিআ (রা.) নবী ﷺ-কে রোজা অবস্থায় অগণিতবার মিসওয়াক করতে দেখেছেন।'), 'Jami‘ at-Tirmidhi 725'),
        tf(Q('Waking up in janabah (needing ghusl) means that day’s fast is lost.', 'জানাবাত অবস্থায় (গোসল ফরজ অবস্থায়) ঘুম থেকে উঠলে সেদিনের রোজা হয় না।'), False,
           Q('He ﷺ sometimes woke at Fajr in janabah in Ramadan, did ghusl and fasted.', 'নবী ﷺ কখনো রমজানে জানাবাত অবস্থায় ফজরে জেগে গোসল করে রোজা রেখেছেন।'), 'Sahih al-Bukhari 1925–1926'),
        tf(Q('If menstruation begins during the day, that day is not counted and is made up later.', 'দিনের বেলা ঋতুস্রাব শুরু হলে সেদিনের রোজা গণ্য হয় না, পরে কাজা করতে হয়।'), True,
           Q('‘A’ishah (RA): "We were ordered to make up the fasts."', 'আয়েশা (রা.): "আমাদের রোজা কাজা করার নির্দেশ দেওয়া হতো।"'), 'Sahih Muslim 335'),
        tf(Q('Swallowing one’s own saliva breaks the fast.', 'নিজের থুথু গিলে ফেললে রোজা ভেঙে যায়।'), False,
           Q('Saliva cannot be avoided and does not break the fast.', 'থুথু এড়ানো যায় না, এতে রোজা ভাঙে না।'), 'Ijma‘ (scholarly agreement)'),
        choice(Q('A fasting person is insulted. What should he say?', 'রোজাদারকে কেউ গালি দিলে সে কী বলবে?'),
               [Q('Insult him back', 'পাল্টা গালি'), Q('"I am fasting"', '"আমি রোজাদার"'), Q('Nothing ever', 'কখনো কিছু না'), Q('"I break my fast"', '"আমি রোজা ভেঙে দিলাম"')], 1,
               Q('Fasting is a shield: no foul talk or quarrelling.', 'রোজা ঢাল: অশ্লীল কথা বা ঝগড়া নয়।'), 'Sahih al-Bukhari 1904'),
    ]),
    ('voluntary', Q('Voluntary fasts', 'নফল রোজা'), 'lesson', [
        match(Q('Match each fast to its virtue', 'প্রতিটি রোজার ফজিলত মেলান'),
              [(Q('Day of Arafah', 'আরাফার দিন'), Q('Expiates the year before and after', 'আগের ও পরের বছরের কাফফারা')),
               (Q('Ashura', 'আশুরা'), Q('Expiates the year before', 'আগের বছরের কাফফারা')),
               (Q('Six days of Shawwal', 'শাওয়ালের ছয় রোজা'), Q('With Ramadan, like a whole year', 'রমজানসহ সারা বছরের মতো')),
               (Q('Monday', 'সোমবার'), Q('The day he ﷺ was born', 'যেদিন নবী ﷺ জন্মগ্রহণ করেছেন'))],
              Q('All from Sahih Muslim.', 'সবগুলো সহিহ মুসলিম থেকে।'), 'Sahih Muslim 1162; Sahih Muslim 1164'),
        choice(Q('The "white days" for fasting are which dates of each Hijri month?', '"আইয়ামে বীজ"-এর রোজা প্রতি হিজরি মাসের কোন তারিখে?'),
               [Q('13, 14, 15', '১৩, ১৪, ১৫'), Q('1, 2, 3', '১, ২, ৩'), Q('20, 21, 22', '২০, ২১, ২২'), Q('27, 28, 29', '২৭, ২৮, ২৯')], 0,
               Q('The nights of the full moon.', 'পূর্ণিমার রাতগুলোর দিন।'), 'Jami‘ at-Tirmidhi 761'),
        tf(Q('The Prophet ﷺ liked to fast on Mondays and Thursdays because deeds are presented then.', 'আমল পেশ করা হয় বলে নবী ﷺ সোম ও বৃহস্পতিবার রোজা রাখতে পছন্দ করতেন।'), True,
           Q('"Deeds are presented on Monday and Thursday, and I like my deeds to be presented while I am fasting."', '"সোম ও বৃহস্পতিবার আমল পেশ করা হয়, আর আমি চাই রোজা অবস্থায় আমার আমল পেশ হোক।"'), 'Jami‘ at-Tirmidhi 747'),
        tf(Q('Fasting on the day of Eid al-Fitr is recommended.', 'ঈদুল ফিতরের দিন রোজা রাখা মুস্তাহাব।'), False,
           Q('He ﷺ forbade fasting on the two days of Eid.', 'নবী ﷺ দুই ঈদের দিনে রোজা রাখতে নিষেধ করেছেন।'), 'Sahih al-Bukhari 1991'),
        choice(Q('How did Prophet Dawud (AS) fast?', 'দাউদ (আ.) কীভাবে রোজা রাখতেন?'),
               [Q('Every day', 'প্রতিদিন'), Q('One day on, one day off', 'একদিন রোজা, একদিন বিরতি'), Q('Only on Fridays', 'শুধু শুক্রবার'), Q('Once a year', 'বছরে একবার')], 1,
               Q('"The most beloved fasting to Allah is that of Dawud: he fasted a day and broke the next."', '"আল্লাহর কাছে সবচেয়ে প্রিয় রোজা দাউদের রোজা: একদিন রাখতেন, একদিন রাখতেন না।"'), 'Sahih al-Bukhari 3420'),
        choice(Q('For Ashura, which days did the Prophet ﷺ intend to fast?', 'আশুরার জন্য নবী ﷺ কোন দিনগুলোতে রোজার ইচ্ছা করেছিলেন?'),
               [Q('The 10th of Muharram, and the 9th as well', 'মহররমের ১০ তারিখ, সঙ্গে ৯ তারিখও'), Q('The 1st of Muharram only', 'শুধু মহররমের ১ তারিখ'),
                Q('The whole of Muharram', 'পুরো মহররম'), Q('The 15th of Sha‘ban', 'শাবানের ১৫ তারিখ')], 0,
               Q('"If I live until next year I will fast the ninth (too)."', '"আগামী বছর বেঁচে থাকলে নবম তারিখেও রোজা রাখব।"'), 'Sahih Muslim 1134'),
    ]),
])

ZAKAT = ('zakat', Q('Learn zakat', 'যাকাত শিখি'),
         Q('Who pays and how much, who receives it, and Sadaqat al-Fitr.', 'কে দেবে ও কত, কারা পাবে, এবং সদকাতুল ফিতর।'), None, 'coins', [
    ('how-much', Q('Who pays, and how much', 'কে দেবে, কত দেবে'), 'lesson', [
        tf(Q('Zakat is due on savings that reach the nisab and stay with you for a full lunar year.', 'সঞ্চয় নিসাব পরিমাণ হয়ে পূর্ণ এক চান্দ্রবছর থাকলে যাকাত ফরজ হয়।'), True,
           Q('"No zakat is due on wealth until a year has passed over it."', '"এক বছর অতিক্রম না করা পর্যন্ত সম্পদে যাকাত নেই।"'), 'Sunan Abi Dawud 1573'),
        fill(Q('Complete the rule', 'নিয়মটি পূর্ণ করুন'), Q('Zakat on cash savings is', 'নগদ সঞ্চয়ের যাকাত'), Q('percent.', 'শতাংশ।'),
             [Q('2.5', '২.৫'), Q('10', '১০'), Q('5', '৫'), Q('20', '২০')], 0,
             Q('One fortieth: "on two hundred dirhams, five dirhams."', 'চল্লিশ ভাগের এক ভাগ: "দুইশো দিরহামে পাঁচ দিরহাম।"'), 'Sunan Abi Dawud 1573'),
        choice(Q('Rahim has had 2,00,000 taka in savings, above the nisab, for a full year. His zakat is…?', 'রহিমের এক বছর ধরে নিসাবের ওপরে ২,০০,০০০ টাকা সঞ্চয় আছে। তার যাকাত কত?'),
               [Q('500 taka', '৫০০ টাকা'), Q('5,000 taka', '৫,০০০ টাকা'), Q('20,000 taka', '২০,০০০ টাকা'), Q('50,000 taka', '৫০,০০০ টাকা')], 1,
               Q('2,00,000 × 2.5% = 5,000 taka.', '২,০০,০০০ × ২.৫% = ৫,০০০ টাকা।'), 'Sunan Abi Dawud 1573'),
        choice(Q('The gold nisab of 20 dinars is about how much gold today?', '২০ দিনার স্বর্ণের নিসাব আজকের হিসাবে প্রায় কত?'),
               [Q('About 10 g', 'প্রায় ১০ গ্রাম'), Q('About 85–87.5 g', 'প্রায় ৮৫–৮৭.৫ গ্রাম (সাড়ে সাত তোলা)'), Q('About 1 kg', 'প্রায় ১ কেজি'), Q('About 500 g', 'প্রায় ৫০০ গ্রাম')], 1,
               Q('Scholars convert 20 mithqal to about 85–87.5 g (7.5 tola); the silver nisab (200 dirhams) is about 595–612 g (52.5 tola).', 'আলেমগণ ২০ মিসকালকে প্রায় ৮৫–৮৭.৫ গ্রাম (সাড়ে সাত তোলা) ধরেন; রুপার নিসাব (২০০ দিরহাম) প্রায় ৫৯৫–৬১২ গ্রাম (সাড়ে বাহান্ন তোলা)।'), 'Sunan Abi Dawud 1573'),
        tf(Q('Zakat is due on the car you use for yourself.', 'নিজে ব্যবহারের গাড়িতে যাকাত দিতে হয়।'), False,
           Q('Things kept for personal use are exempt: "No zakat on a Muslim’s slave or his horse."', 'ব্যক্তিগত ব্যবহারের জিনিসে যাকাত নেই: "মুসলিমের দাস ও ঘোড়ায় যাকাত নেই।"'), 'Sahih al-Bukhari 1464'),
        tf(Q('Zakat purifies the wealth and the soul of the giver.', 'যাকাত দাতার সম্পদ ও অন্তরকে পবিত্র করে।'), True,
           Q('"Take from their wealth a charity by which you purify them and cause them to grow."', '"তাদের সম্পদ থেকে সদকা গ্রহণ করুন, যা দ্বারা আপনি তাদের পবিত্র ও পরিশুদ্ধ করবেন।"'), 'Quran 9:103'),
    ]),
    ('recipients', Q('Who receives zakat', 'যাকাত কারা পাবে'), 'lesson', [
        choice(Q('Which ayah lists those who may receive zakat?', 'কোন আয়াতে যাকাতের হকদারদের তালিকা আছে?'),
               [Q('At-Tawbah 9:60', 'আত-তাওবা ৯:৬০'), Q('Al-Baqarah 2:255', 'আল-বাকারা ২:২৫৫'), Q('Yasin 36:1', 'ইয়াসিন ৩৬:১'), Q('Al-Mulk 67:1', 'আল-মুলক ৬৭:১')], 0,
               Q('"Zakat is only for the poor, the needy, those who work on it…"', '"যাকাত কেবল ফকির, মিসকিন, যাকাত আদায়কারী…-দের জন্য"'), 'Quran 9:60'),
        match(Q('Match each group in 9:60 to its meaning', '৯:৬০-এর প্রতিটি খাতের অর্থ মেলান'),
              [(Q('Al-fuqara’', 'ফুকারা'), Q('The poor', 'দরিদ্র')), (Q('Al-gharimin', 'গারিমিন'), Q('Those in debt', 'ঋণগ্রস্ত')),
               (Q('Ibn as-sabil', 'ইবনুস সাবিল'), Q('The stranded traveller', 'বিপদগ্রস্ত মুসাফির')), (Q('Al-‘amilina ‘alayha', 'আমিলিনা আলাইহা'), Q('Those who collect it', 'যাকাত আদায়ের কর্মী')),
               (Q('Fir-riqab', 'ফির রিকাব'), Q('Freeing captives', 'দাস ও বন্দি মুক্তি'))],
              Q('Five of the eight groups named in the ayah.', 'আয়াতে উল্লিখিত আট খাতের পাঁচটি।'), 'Quran 9:60'),
        choice(Q('How many groups does 9:60 name?', '৯:৬০ আয়াতে কয়টি খাতের কথা আছে?'),
               [Q('4', '৪'), Q('6', '৬'), Q('8', '৮'), Q('10', '১০')], 2,
               Q('The poor, the needy, its workers, those whose hearts are to be won, captives, debtors, in Allah’s way, and the traveller.', 'ফকির, মিসকিন, আদায়কারী, মন জয়ের জন্য যাদের দেওয়া হয়, দাসমুক্তি, ঋণগ্রস্ত, আল্লাহর পথে ও মুসাফির।'), 'Quran 9:60'),
        tf(Q('A person may give his zakat to his own parents.', 'নিজের বাবা-মাকে যাকাত দেওয়া যায়।'), False,
           Q('Supporting one’s parents is already a duty, so scholars agree zakat does not go to them.', 'বাবা-মায়ের ভরণপোষণ এমনিতেই দায়িত্ব, তাই আলেমগণ একমত যে তাঁদের যাকাত দেওয়া যায় না।'), 'Ibn al-Mundhir, al-Ijma‘'),
        tf(Q('Zakat may be used to help someone who cannot pay his debts.', 'ঋণ শোধে অক্ষম ব্যক্তিকে যাকাত দিয়ে সাহায্য করা যায়।'), True,
           Q('Al-gharimin, those in debt, are one of the eight groups.', 'আল-গারিমিন বা ঋণগ্রস্তরা আট খাতের একটি।'), 'Quran 9:60'),
        tf(Q('Giving charity secretly to the poor is better for you, though giving openly is also good.', 'গরিবকে গোপনে দান করা তোমার জন্য উত্তম, যদিও প্রকাশ্যে দানও ভালো।'), True,
           Q('"If you show your charities, that is good; but if you hide them and give them to the poor, it is better for you."', '"তোমরা প্রকাশ্যে দান করলে তা ভালো; আর গোপনে অভাবীদের দিলে তা তোমাদের জন্য আরও উত্তম।"'), 'Quran 2:271'),
    ]),
    ('fitr-sadaqah', Q('Sadaqat al-Fitr & charity', 'সদকাতুল ফিতর ও দান'), 'lesson', [
        tf(Q('Sadaqat al-Fitr is given before the Eid prayer.', 'সদকাতুল ফিতর ঈদের নামাজের আগে দিতে হয়।'), True,
           Q('He ﷺ ordered it to be given before people went out to the prayer.', 'মানুষ নামাজে বের হওয়ার আগে তা আদায় করার নির্দেশ দিয়েছেন।'), 'Sahih al-Bukhari 1503'),
        choice(Q('Who pays the Sadaqat al-Fitr of a small child?', 'ছোট শিশুর সদকাতুল ফিতর কে দেবে?'),
               [Q('The child, when grown up', 'শিশু নিজে, বড় হয়ে'), Q('The one who supports the child, e.g. the father', 'যিনি শিশুর ভরণপোষণ করেন, যেমন বাবা'),
                Q('No one', 'কেউ না'), Q('The neighbours', 'প্রতিবেশীরা')], 1,
               Q('It is due "on the young and the old"; the guardian pays it for those he supports.', 'এটি "ছোট-বড় সবার ওপর"; অভিভাবক তার পোষ্যদের পক্ষ থেকে আদায় করেন।'), 'Sahih al-Bukhari 1503'),
        choice(Q('What is Sadaqat al-Fitr for, according to the hadith?', 'হাদিস অনুযায়ী সদকাতুল ফিতরের উদ্দেশ্য কী?'),
               [Q('To decorate the masjid', 'মসজিদ সাজানো'), Q('To pay the imam', 'ইমামের বেতন'),
                Q('To purify the fasting person from idle talk and to feed the poor', 'রোজাদারকে অনর্থক কথা থেকে পবিত্র করা ও গরিবদের খাওয়ানো'), Q('To buy new clothes', 'নতুন জামা কেনা')], 2,
               Q('Ibn ‘Abbas (RA): "…a purification for the fasting person from idle and obscene talk, and food for the poor."', 'ইবনে আব্বাস (রা.): "…রোজাদারের অনর্থক ও অশ্লীল কথা থেকে পবিত্রতা এবং মিসকিনদের খাবার।"'), 'Sunan Abi Dawud 1609'),
        tf(Q('Every good deed is a charity.', 'প্রতিটি ভালো কাজই সদকা।'), True,
           Q('"Every good deed (ma‘ruf) is a charity."', '"প্রতিটি সৎকাজ সদকা।"'), 'Sahih al-Bukhari 6021'),
        choice(Q('When a person dies, his deeds end except three. Sadaqah jariyah, beneficial knowledge and…?', 'মানুষ মারা গেলে তিনটি ছাড়া তার আমল বন্ধ হয়ে যায়: সদকায়ে জারিয়া, উপকারী জ্ঞান এবং…?'),
               [Q('A big house', 'একটি বড় বাড়ি'), Q('A famous name', 'খ্যাতি'), Q('Gold', 'স্বর্ণ'), Q('A righteous child who prays for him', 'নেক সন্তান, যে তার জন্য দোয়া করে')], 3,
               Q('The three that continue after death.', 'মৃত্যুর পরও যে তিনটি চলতে থাকে।'), 'Sahih Muslim 1631'),
        tf(Q('Giving charity decreases wealth.', 'দান করলে সম্পদ কমে যায়।'), False,
           Q('"Charity does not decrease wealth."', '"দান সম্পদ কমায় না।"'), 'Sahih Muslim 2588'),
    ]),
])

HAJJ = ('hajj-umrah', Q('Learn Hajj & Umrah', 'হজ ও উমরাহ শিখি'),
        Q('Ihram and the talbiyah, the steps of Umrah, and the days of Hajj.', 'ইহরাম ও তালবিয়া, উমরাহর ধাপ এবং হজের দিনগুলো।'), None, 'landmark', [
    ('ihram', Q('Ihram & the talbiyah', 'ইহরাম ও তালবিয়া'), 'lesson', [
        choice(Q('What does a man wear in ihram?', 'ইহরামে পুরুষ কী পরেন?'),
               [Q('Two unstitched sheets: an izar and a rida’', 'দুটি সেলাইবিহীন চাদর: লুঙ্গির মতো ইজার ও গায়ের চাদর রিদা'), Q('A shirt and trousers', 'জামা ও প্যান্ট'),
                Q('A turban and cloak', 'পাগড়ি ও জোব্বা'), Q('Anything he likes', 'যা খুশি')], 0,
               Q('He ﷺ set out from Madinah in an izar and a rida’; men do not wear shirts, turbans, trousers or hooded cloaks in ihram.', 'নবী ﷺ ইজার ও রিদা পরে মদিনা থেকে রওনা দেন; ইহরামে পুরুষ জামা, পাগড়ি, পায়জামা বা টুপিওয়ালা জোব্বা পরে না।'), 'Sahih al-Bukhari 1545; Sahih al-Bukhari 1542'),
        tf(Q('Men cover their heads in ihram.', 'ইহরামে পুরুষরা মাথা ঢেকে রাখেন।'), False,
           Q('Turbans and caps are among the things a man in ihram does not wear.', 'ইহরামে পুরুষ পাগড়ি বা টুপি পরে না।'), 'Sahih al-Bukhari 1542'),
        tf(Q('A woman in ihram wears her ordinary modest clothes, but not the niqab or gloves.', 'ইহরামে নারী তাঁর সাধারণ শালীন পোশাক পরেন, তবে নিকাব ও হাতমোজা নয়।'), True,
           Q('"The woman in ihram does not wear the niqab or gloves."', '"ইহরামধারী নারী নিকাব ও হাতমোজা পরবে না।"'), 'Sahih al-Bukhari 1838'),
        order(Q('Put the talbiyah in order', 'তালবিয়া ক্রমানুসারে সাজান'),
              [Q('Labbayk Allahumma labbayk', 'লাব্বাইক আল্লাহুম্মা লাব্বাইক'), Q('Labbayka la sharika laka labbayk', 'লাব্বাইকা লা শারিকা লাকা লাব্বাইক'),
               Q('Innal-hamda wan-ni‘mata laka wal-mulk', 'ইন্নাল হামদা ওয়ান নি‘মাতা লাকা ওয়াল মুলক'), Q('La sharika lak', 'লা শারিকা লাক')],
              Q('The talbiyah of the Prophet ﷺ, as Ibn ‘Umar (RA) reported it.', 'ইবনে উমর (রা.) বর্ণিত নবীজির ﷺ তালবিয়া।'), 'Sahih al-Bukhari 1549'),
        match(Q('Match each part of the talbiyah to its meaning', 'তালবিয়ার প্রতিটি অংশের অর্থ মেলান'),
              [(Q('Labbayk', 'লাব্বাইক'), Q('Here I am, at Your service', 'আমি হাজির, আপনার খেদমতে')), (Q('La sharika lak', 'লা শারিকা লাক'), Q('You have no partner', 'আপনার কোনো শরিক নেই')),
               (Q('Innal-hamda wan-ni‘mata lak', 'ইন্নাল হামদা ওয়ান নি‘মাতা লাক'), Q('All praise and blessings are Yours', 'সব প্রশংসা ও নিয়ামত আপনারই')), (Q('Wal-mulk', 'ওয়াল মুলক'), Q('And the dominion', 'এবং সার্বভৌমত্বও'))],
              Q('The pilgrim answers Allah’s call.', 'হাজি আল্লাহর ডাকে সাড়া দেন।'), 'Sahih al-Bukhari 1549'),
        tf(Q('Using perfume after entering ihram is allowed.', 'ইহরাম বাঁধার পর সুগন্ধি ব্যবহার জায়েজ।'), False,
           Q('Clothes touched by saffron or wars (scents) are among what the muhrim avoids.', 'জাফরান বা ওয়ারস (সুগন্ধি) লাগানো কাপড় ইহরামধারী এড়িয়ে চলেন।'), 'Sahih al-Bukhari 1542'),
        tf(Q('Hunting land animals is forbidden in ihram.', 'ইহরাম অবস্থায় স্থলের প্রাণী শিকার নিষিদ্ধ।'), True,
           Q('"Do not kill game while you are in ihram."', '"ইহরাম অবস্থায় তোমরা শিকার বধ কোরো না।"'), 'Quran 5:95'),
    ]),
    ('umrah', Q('The steps of Umrah', 'উমরাহর ধাপ'), 'lesson', [
        order(Q('Put the steps of Umrah in order', 'উমরাহর ধাপগুলো ক্রমানুসারে সাজান'),
              [Q('Enter ihram at the miqat', 'মিকাত থেকে ইহরাম বাঁধা'), Q('Tawaf: seven rounds of the Ka‘bah', 'তাওয়াফ: কাবার চারপাশে সাত চক্কর'),
               Q('Pray two rak‘ahs (behind Maqam Ibrahim if possible)', 'দুই রাকাত নামাজ (সম্ভব হলে মাকামে ইবরাহিমের পেছনে)'), Q('Sa‘i: seven trips between Safa and Marwah', 'সাঈ: সাফা-মারওয়ায় সাত চক্কর'),
               Q('Shave or shorten the hair', 'মাথা মুণ্ডন বা চুল ছোট করা')],
              Q('As in the Prophet’s ﷺ Umrah and Hajj described by Jabir (RA).', 'জাবির (রা.) বর্ণিত নবীজির ﷺ উমরাহ ও হজের মতো।'), 'Sahih Muslim 1218'),
        choice(Q('From where does each tawaf begin?', 'প্রতিটি তাওয়াফ কোথা থেকে শুরু হয়?'),
               [Q('The Black Stone corner', 'হাজরে আসওয়াদের কোণ'), Q('The door of the Ka‘bah', 'কাবার দরজা'), Q('Zamzam', 'জমজম'), Q('Safa', 'সাফা')], 0,
               Q('He ﷺ touched the Black Stone corner and began.', 'নবী ﷺ হাজরে আসওয়াদের কোণ স্পর্শ করে শুরু করলেন।'), 'Sahih Muslim 1218'),
        tf(Q('In tawaf the Ka‘bah is kept on your left.', 'তাওয়াফে কাবা বাম দিকে থাকে।'), True,
           Q('Walking anticlockwise, with the House on the left, as he ﷺ did.', 'নবীজির ﷺ মতো ঘড়ির কাঁটার উল্টো দিকে হাঁটা, কাবা বাম পাশে রেখে।'), 'Sahih Muslim 1218'),
        choice(Q('Sa‘i begins at…?', 'সাঈ কোথা থেকে শুরু হয়?'),
               [Q('Marwah', 'মারওয়া'), Q('Safa', 'সাফা'), Q('Mina', 'মিনা'), Q('Arafat', 'আরাফাত')], 1,
               Q('"I begin with what Allah began with" — as-Safa.', '"আল্লাহ যা দিয়ে শুরু করেছেন আমিও তা দিয়ে শুরু করছি" — সাফা।'), 'Quran 2:158; Sahih Muslim 1218'),
        tf(Q('Zamzam water is for whatever it is drunk for.', 'জমজমের পানি যে উদ্দেশ্যে পান করা হয়, তার জন্যই।'), True,
           Q('"The water of Zamzam is for whatever it is drunk for." Drink it and make dua.', '"জমজমের পানি যে নিয়তে পান করা হয় তার জন্য।" পান করে দোয়া করুন।'), 'Sunan Ibn Majah 3062'),
        tf(Q('Umrah can only be done in Ramadan.', 'উমরাহ শুধু রমজানেই করা যায়।'), False,
           Q('Umrah may be done any time; an Umrah in Ramadan is equal (in reward) to a Hajj.', 'উমরাহ যেকোনো সময় করা যায়; রমজানের উমরাহ (সওয়াবে) একটি হজের সমান।'), 'Sahih al-Bukhari 1782'),
    ]),
    ('hajj-days', Q('The days of Hajj', 'হজের দিনগুলো'), 'lesson', [
        order(Q('Put the days of Hajj in order', 'হজের দিনগুলো ক্রমানুসারে সাজান'),
              [Q('8th: go to Mina', '৮ তারিখ: মিনায় যাওয়া'), Q('9th: stand at Arafah', '৯ তারিখ: আরাফায় অবস্থান'), Q('Night: Muzdalifah', 'রাতে: মুজদালিফা'),
               Q('10th: stone Jamrat al-‘Aqabah, sacrifice, shave, Tawaf al-Ifadah', '১০ তারিখ: জামরাতুল আকাবায় কংকর, কুরবানি, মাথা মুণ্ডন, তাওয়াফে ইফাদা'),
               Q('11th–13th: stay in Mina and stone the three jamarat', '১১–১৩ তারিখ: মিনায় থেকে তিন জামরায় কংকর'), Q('Farewell tawaf before leaving', 'বিদায়ের আগে বিদায়ী তাওয়াফ')],
              Q('The order of the Prophet’s ﷺ Hajj, from Jabir’s long hadith.', 'জাবির (রা.)-এর দীর্ঘ হাদিস থেকে নবীজির ﷺ হজের ক্রম।'), 'Sahih Muslim 1218; Sahih al-Bukhari 1755'),
        match(Q('Match each day to its place', 'প্রতিটি দিনের স্থান মেলান'),
              [(Q('8 Dhul Hijjah', '৮ জিলহজ'), Q('Mina', 'মিনা')), (Q('9 Dhul Hijjah', '৯ জিলহজ'), Q('Arafah', 'আরাফা')),
               (Q('The night after Arafah', 'আরাফার পরের রাত'), Q('Muzdalifah', 'মুজদালিফা')), (Q('10 Dhul Hijjah, morning', '১০ জিলহজ, সকাল'), Q('Jamrat al-‘Aqabah', 'জামরাতুল আকাবা'))],
              Q('Mina, Arafah, Muzdalifah, then back to Mina.', 'মিনা, আরাফা, মুজদালিফা, তারপর আবার মিনা।'), 'Sahih Muslim 1218'),
        tf(Q('Standing at Arafah is the heart of Hajj: whoever misses it misses the Hajj.', 'আরাফায় অবস্থান হজের মূল: যে তা হারায় সে হজ হারায়।'), True,
           Q('"Hajj is Arafah."', '"হজ হলো আরাফা।"'), 'Jami‘ at-Tirmidhi 889'),
        choice(Q('How many pebbles are thrown at a jamrah each time?', 'প্রতিবার একটি জামরায় কয়টি কংকর মারা হয়?'),
               [Q('3', '৩'), Q('5', '৫'), Q('7', '৭'), Q('9', '৯')], 2,
               Q('Seven, saying "Allahu Akbar" with each.', 'সাতটি, প্রতিটির সঙ্গে "আল্লাহু আকবার"।'), 'Sahih Muslim 1218'),
        tf(Q('On the days of Tashriq all three jamarat are stoned.', 'আইয়ামে তাশরিকে তিনটি জামরাতেই কংকর মারা হয়।'), True,
           Q('The small, the middle, then al-‘Aqabah, each with seven pebbles.', 'ছোট, মাঝেরটি, তারপর আকাবা — প্রতিটিতে সাতটি করে।'), 'Sahih al-Bukhari 1751'),
        choice(Q('Which tawaf is a pillar of Hajj?', 'কোন তাওয়াফ হজের রুকন?'),
               [Q('Tawaf al-Ifadah', 'তাওয়াফে ইফাদা'), Q('A voluntary tawaf', 'নফল তাওয়াফ'), Q('Tawaf al-Qudum', 'তাওয়াফে কুদুম'), Q('None', 'কোনোটিই না')], 0,
               Q('"…and let them perform tawaf around the Ancient House."', '"…এবং তারা যেন প্রাচীন ঘরের তাওয়াফ করে।"'), 'Quran 22:29'),
    ]),
])

QURBANI = ('qurbani', Q('Learn about qurbani', 'কুরবানি শিখি'),
           Q('Which animals, sharing, defects, and how to slaughter.', 'কোন পশু, শরিকানা, ত্রুটি এবং জবাইয়ের নিয়ম।'), None, 'star', [
    ('animal', Q('The animal', 'কুরবানির পশু'), 'lesson', [
        choice(Q('From which animals is qurbani given?', 'কোন পশু দিয়ে কুরবানি হয়?'),
               [Q('Chickens and ducks', 'মুরগি ও হাঁস'), Q('Camels, cattle, sheep and goats', 'উট, গরু-মহিষ, ভেড়া ও ছাগল'), Q('Fish', 'মাছ'), Q('Deer', 'হরিণ')], 1,
               Q('"…the livestock (bahimat al-an‘am) He has provided them."', '"…তাদের দেওয়া চতুষ্পদ গৃহপালিত পশু (বাহিমাতুল আনআম)।"'), 'Quran 22:34'),
        tf(Q('Seven people may share one cow for qurbani.', 'সাতজন মিলে একটি গরু কুরবানি দিতে পারেন।'), True,
           Q('"…a camel for seven and a cow for seven."', '"…একটি উট সাতজনের পক্ষ থেকে, একটি গরু সাতজনের পক্ষ থেকে।"'), 'Sahih Muslim 1318'),
        tf(Q('Seven people may share one goat for qurbani.', 'সাতজন মিলে একটি ছাগল কুরবানি দিতে পারেন।'), False,
           Q('Sharing in shares is for camels and cattle; a sheep or goat is one person’s sacrifice.', 'ভাগে শরিক হওয়া উট ও গরুর ক্ষেত্রে; ভেড়া বা ছাগল একজনের কুরবানি।'), 'Sahih Muslim 1318'),
        choice(Q('Which animal is not accepted for qurbani?', 'কোন পশু কুরবানির জন্য গ্রহণযোগ্য নয়?'),
               [Q('A healthy male goat', 'সুস্থ খাসি/পাঁঠা'), Q('A fat cow', 'মোটাতাজা গরু'), Q('A black sheep', 'কালো ভেড়া'), Q('One that is clearly blind in one eye', 'স্পষ্টভাবে এক চোখ কানা')], 3,
               Q('Four are not accepted: clearly one-eyed, clearly sick, clearly lame, and very thin.', 'চারটি চলবে না: স্পষ্ট কানা, স্পষ্ট অসুস্থ, স্পষ্ট খোঁড়া ও অত্যন্ত দুর্বল।'), 'Sunan Abi Dawud 2802'),
        tf(Q('A clearly lame animal is fine for qurbani.', 'স্পষ্টভাবে খোঁড়া পশু দিয়ে কুরবানি চলে।'), False,
           Q('A clearly lame animal is one of the four not accepted.', 'স্পষ্ট খোঁড়া পশু অগ্রহণযোগ্য চারটির একটি।'), 'Sunan Abi Dawud 2802; Jami‘ at-Tirmidhi 1497'),
        tf(Q('Choosing a good, healthy animal honours Allah’s symbols.', 'ভালো ও সুস্থ পশু বাছাই করা আল্লাহর নিদর্শনের সম্মান।'), True,
           Q('"Whoever honours the symbols of Allah — it is from the piety of hearts."', '"যে আল্লাহর নিদর্শনসমূহকে সম্মান করে, তা তো অন্তরের তাকওয়া থেকেই।"'), 'Quran 22:32'),
    ]),
    ('slaughter', Q('How to sacrifice', 'কুরবানির নিয়ম'), 'lesson', [
        order(Q('Put the steps in order', 'ধাপগুলো ক্রমানুসারে সাজান'),
              [Q('Pray the Eid prayer first', 'আগে ঈদের নামাজ পড়া'), Q('Lay the animal down facing the qiblah', 'পশুকে কিবলামুখী করে শোয়ানো'),
               Q('Say: Bismillah, Allahu Akbar', 'বলা: বিসমিল্লাহ, আল্লাহু আকবার'), Q('Slaughter quickly with a sharp knife', 'ধারালো ছুরি দিয়ে দ্রুত জবাই'),
               Q('Eat, gift and give to the poor', 'নিজে খাওয়া, উপহার দেওয়া ও গরিবকে দেওয়া')],
              Q('After the prayer, with Allah’s name, with mercy to the animal, and sharing the meat.', 'নামাজের পর, আল্লাহর নামে, পশুর প্রতি দয়া রেখে, আর গোশত ভাগ করে।'), 'Sahih al-Bukhari 5560; Sahih Muslim 1966; Sahih Muslim 1955'),
        fill(Q('What is said when slaughtering?', 'জবাইয়ের সময় কী বলা হয়?'), Q('Bismillah,', 'বিসমিল্লাহ,'), None,
             [Q('Allahu Akbar', 'আল্লাহু আকবার'), Q('Alhamdulillah', 'আলহামদুলিল্লাহ'), Q('Amin', 'আমিন'), Q('Insha’Allah', 'ইনশাআল্লাহ')], 0,
             Q('He ﷺ said "Bismillah" and "Allahu Akbar" over his two rams.', 'নবী ﷺ তাঁর দুই দুম্বার ওপর "বিসমিল্লাহ" ও "আল্লাহু আকবার" বলেছেন।'), 'Sahih Muslim 1966'),
        tf(Q('An animal slaughtered before the Eid prayer counts as qurbani.', 'ঈদের নামাজের আগে জবাই করা পশু কুরবানি হিসেবে গণ্য।'), False,
           Q('"Whoever slaughtered before the prayer, it is only meat he gave his family."', '"যে নামাজের আগে জবাই করল, তা শুধু পরিবারের জন্য গোশত।"'), 'Sahih al-Bukhari 5560'),
        tf(Q('The one who sacrifices may eat from the meat.', 'কুরবানিদাতা নিজে গোশত খেতে পারেন।'), True,
           Q('"So eat from them and feed the needy and the poor."', '"অতঃপর তোমরা তা থেকে খাও এবং দুস্থ-অভাবীকে খাওয়াও।"'), 'Quran 22:28'),
        choice(Q('What reaches Allah from the sacrifice?', 'কুরবানির কোন জিনিস আল্লাহর কাছে পৌঁছায়?'),
               [Q('The meat', 'গোশত'), Q('The blood', 'রক্ত'), Q('Your piety (taqwa)', 'তোমাদের তাকওয়া'), Q('The price', 'দাম')], 2,
               Q('"Neither their meat nor their blood reaches Allah, but piety from you reaches Him."', '"এগুলোর গোশত বা রক্ত আল্লাহর কাছে পৌঁছায় না, বরং তোমাদের তাকওয়া পৌঁছায়।"'), 'Quran 22:37'),
        tf(Q('Paying the butcher with meat from the qurbani is the Sunnah.', 'কসাইকে কুরবানির গোশত দিয়ে পারিশ্রমিক দেওয়া সুন্নাত।'), False,
           Q('‘Ali (RA): he ﷺ told me not to give the butcher anything from it as his wage; "we will pay him ourselves."', 'আলী (রা.): নবী ﷺ আমাকে কসাইকে পারিশ্রমিক হিসেবে তা থেকে কিছু দিতে নিষেধ করেছেন; "আমরা নিজেরা তাকে দেব।"'), 'Sahih Muslim 1317'),
        tf(Q('The Prophet ﷺ told us to sharpen the blade and spare the animal suffering.', 'নবী ﷺ ছুরি ধারালো করতে ও পশুকে কষ্ট না দিতে বলেছেন।'), True,
           Q('"Allah has prescribed excellence in everything…"', '"আল্লাহ সবকিছুতে উত্তমতা ফরজ করেছেন…"'), 'Sahih Muslim 1955'),
    ]),
])


# ============================================================== Iman & Aqidah
KALIMA_AR = ['لَا', 'إِلٰهَ', 'إِلَّا', 'اللّٰهُ', 'مُحَمَّدٌ', 'رَسُولُ', 'اللّٰهِ']
SHAHADAH_AR = ['أَشْهَدُ', 'أَنْ لَا إِلٰهَ', 'إِلَّا اللّٰهُ', 'وَأَشْهَدُ', 'أَنَّ مُحَمَّدًا', 'عَبْدُهُ', 'وَرَسُولُهُ']

KALIMA = ('kalima', Q('The kalima', 'কালিমা'),
          Q('Kalima Tayyibah and Kalima Shahadah: words, meaning and virtue.', 'কালিমা তাইয়্যিবা ও কালিমা শাহাদাত: শব্দ, অর্থ ও ফজিলত।'), None, 'sparkles', [
    ('tayyibah', Q('Kalima Tayyibah', 'কালিমা তাইয়্যিবা'), 'lesson', [
        order(Q('Put the words of the kalima in order', 'কালিমার শব্দগুলো সাজান'), [AR(w) for w in KALIMA_AR],
              Q('"La ilaha illallah, Muhammadur-Rasulullah" — There is no god but Allah; Muhammad is the Messenger of Allah.', '"লা ইলাহা ইল্লাল্লাহু মুহাম্মাদুর রাসুলুল্লাহ" — আল্লাহ ছাড়া কোনো ইলাহ নেই, মুহাম্মাদ ﷺ আল্লাহর রাসুল।'),
              'Quran 47:19; Quran 48:29', rtl=True),
        choice(Q('What does "La ilaha illallah, Muhammadur-Rasulullah" mean?', '"লা ইলাহা ইল্লাল্লাহু মুহাম্মাদুর রাসুলুল্লাহ" অর্থ কী?'),
               [Q('Allah is the Greatest; all praise is His', 'আল্লাহ সবচেয়ে বড়; সব প্রশংসা তাঁর'),
                Q('There is no god but Allah; Muhammad is the Messenger of Allah', 'আল্লাহ ছাড়া কোনো ইলাহ নেই; মুহাম্মাদ ﷺ আল্লাহর রাসুল'),
                Q('In the name of Allah, the Merciful', 'পরম দয়ালু আল্লাহর নামে'), Q('Glory be to Allah', 'আল্লাহ পবিত্র')], 1,
               Q('The first half is tawhid; the second accepts the Prophet ﷺ as Allah’s messenger.', 'প্রথম অংশ তাওহিদ; দ্বিতীয় অংশে নবী ﷺ-কে আল্লাহর রাসুল হিসেবে মেনে নেওয়া।'), 'Quran 47:19; Quran 48:29'),
        match(Q('Match each word to its meaning', 'প্রতিটি শব্দের অর্থ মেলান'),
              [(AR('لَا'), Q('No / none', 'নেই')), (AR('إِلٰهَ'), Q('god (worthy of worship)', 'ইলাহ (ইবাদতের যোগ্য)')),
               (AR('إِلَّا'), Q('except', 'ছাড়া')), (AR('رَسُولُ'), Q('messenger', 'রাসুল (বার্তাবাহক)'))],
              Q('La = no, ilaha = god, illa = except, rasul = messenger.', 'লা = নেই, ইলাহ = উপাস্য, ইল্লা = ছাড়া, রাসুল = বার্তাবাহক।'), 'Quran 47:19'),
        tf(Q('"La ilaha" denies every false god, and "illallah" affirms Allah alone.', '"লা ইলাহা" সব মিথ্যা উপাস্যকে অস্বীকার করে, আর "ইল্লাল্লাহ" শুধু আল্লাহকে সাব্যস্ত করে।'), True,
           Q('"Whoever disbelieves in false gods and believes in Allah has grasped the most firm handhold."', '"যে তাগুতকে অস্বীকার করে এবং আল্লাহর ওপর ঈমান আনে, সে মজবুত হাতল আঁকড়ে ধরেছে।"'), 'Quran 2:256'),
        choice(Q('Which surah has the ayah "Muhammad is the Messenger of Allah"?', 'কোন সূরায় "মুহাম্মাদ আল্লাহর রাসুল" আয়াতটি আছে?'),
               [Q('Al-Fath', 'আল-ফাতহ'), Q('Al-Ikhlas', 'আল-ইখলাস'), Q('Al-Fatiha', 'আল-ফাতিহা'), Q('An-Nas', 'আন-নাস')], 0,
               Q('"Muhammad is the Messenger of Allah, and those with him are firm against the disbelievers, merciful among themselves…"', '"মুহাম্মাদ আল্লাহর রাসুল; আর যারা তাঁর সঙ্গে আছে তারা কাফিরদের প্রতি কঠোর, নিজেদের মধ্যে দয়ালু…"'), 'Quran 48:29'),
        tf(Q('Whoever’s last words are "La ilaha illallah" will enter Paradise.', 'যার শেষ কথা "লা ইলাহা ইল্লাল্লাহ", সে জান্নাতে প্রবেশ করবে।'), True,
           Q('"Whoever’s last words are La ilaha illallah will enter Paradise." So we gently remind the dying.', '"যার শেষ কথা লা ইলাহা ইল্লাল্লাহ, সে জান্নাতে যাবে।" তাই মুমূর্ষুকে কোমলভাবে স্মরণ করিয়ে দেওয়া হয়।'), 'Sunan Abi Dawud 3116'),
    ]),
    ('shahadah', Q('Kalima Shahadah & beloved words', 'কালিমা শাহাদাত ও প্রিয় বাক্য'), 'lesson', [
        order(Q('Put the shahadah in order', 'কালিমা শাহাদাত সাজান'), [AR(w) for w in SHAHADAH_AR],
              Q('"I testify that there is no god but Allah, and I testify that Muhammad is His servant and His messenger."', '"আমি সাক্ষ্য দিচ্ছি, আল্লাহ ছাড়া কোনো ইলাহ নেই, এবং আমি সাক্ষ্য দিচ্ছি, মুহাম্মাদ ﷺ তাঁর বান্দা ও রাসুল।"'),
              'Sahih Muslim 234; Sahih al-Bukhari 831', rtl=True),
        choice(Q('In the shahadah, what does "‘abduhu wa rasuluh" mean?', 'শাহাদাতে "আবদুহু ওয়া রাসুলুহ" অর্থ কী?'),
               [Q('His servant and His messenger', 'তাঁর বান্দা ও তাঁর রাসুল'), Q('His friend and His angel', 'তাঁর বন্ধু ও ফেরেশতা'),
                Q('The first and the last', 'প্রথম ও শেষ'), Q('The king and the judge', 'রাজা ও বিচারক')], 0,
               Q('He ﷺ is a servant — not to be worshipped — and a messenger — to be followed.', 'তিনি ﷺ বান্দা — তাঁর ইবাদত নয় — এবং রাসুল — তাঁর অনুসরণ করতে হবে।'), 'Sahih al-Bukhari 3445'),
        tf(Q('The shahadah is the first pillar of Islam.', 'শাহাদাত ইসলামের প্রথম স্তম্ভ।'), True,
           Q('"Islam is built on five: testifying that there is no god but Allah and that Muhammad is the Messenger of Allah…"', '"ইসলাম পাঁচটি ভিত্তির ওপর: সাক্ষ্য দেওয়া যে আল্লাহ ছাড়া কোনো ইলাহ নেই ও মুহাম্মাদ ﷺ আল্লাহর রাসুল…"'), 'Sahih al-Bukhari 8'),
        choice(Q('Which four phrases did the Prophet ﷺ call the most beloved words to Allah?', 'কোন চারটি বাক্যকে নবী ﷺ আল্লাহর কাছে সবচেয়ে প্রিয় বলেছেন?'),
               [Q('Bismillah, Insha’Allah, Masha’Allah, Amin', 'বিসমিল্লাহ, ইনশাআল্লাহ, মাশাআল্লাহ, আমিন'),
                Q('SubhanAllah, Alhamdulillah, La ilaha illallah, Allahu Akbar', 'সুবহানাল্লাহ, আলহামদুলিল্লাহ, লা ইলাহা ইল্লাল্লাহ, আল্লাহু আকবার'),
                Q('Astaghfirullah four times', 'চারবার আসতাগফিরুল্লাহ'), Q('Labbayk four times', 'চারবার লাব্বাইক')], 1,
               Q('"The most beloved words to Allah are four…" — in Bangladesh they are taught as Kalima Tamjid, with "la hawla wa la quwwata illa billah" added.', '"আল্লাহর কাছে সবচেয়ে প্রিয় বাক্য চারটি…" — বাংলাদেশে এগুলো কালিমা তামজিদ হিসেবে শেখানো হয়, সঙ্গে "লা হাওলা ওয়া লা কুওয়াতা ইল্লা বিল্লাহ"।'), 'Sahih Muslim 2137'),
        choice(Q('Saying "La ilaha illallahu wahdahu la sharika lah, lahul-mulku wa lahul-hamdu wa huwa ‘ala kulli shay’in qadir" a hundred times a day is like freeing how many slaves?', 'দিনে একশোবার "লা ইলাহা ইল্লাল্লাহু ওয়াহদাহু লা শারিকা লাহ, লাহুল মুলকু ওয়া লাহুল হামদু ওয়া হুয়া আলা কুল্লি শাইয়িন কাদির" বললে কয়টি দাস মুক্ত করার সমান?'),
               [Q('One', 'একটি'), Q('Three', 'তিনটি'), Q('Ten', 'দশটি'), Q('A hundred', 'একশোটি')], 2,
               Q('"…it is like freeing ten slaves; a hundred good deeds are written for him, a hundred sins wiped away, and it guards him from Shaytan that day."', '"…দশটি দাস মুক্ত করার সমান; তার জন্য একশো নেকি লেখা হয়, একশো গুনাহ মোছা হয়, আর সেদিন শয়তান থেকে সুরক্ষা হয়।"'), 'Sahih al-Bukhari 6403'),
        match(Q('Match the words to what the hadith calls them', 'বাক্যগুলোকে হাদিসের পরিচয়ের সঙ্গে মেলান'),
              [(Q('La ilaha illallah, Muhammadur-Rasulullah', 'লা ইলাহা ইল্লাল্লাহু মুহাম্মাদুর রাসুলুল্লাহ'), Q('Kalima Tayyibah, the good word', 'কালিমা তাইয়্যিবা, পবিত্র বাক্য')),
               (Q('Ashhadu an la ilaha illallah…', 'আশহাদু আল্লা ইলাহা ইল্লাল্লাহু…'), Q('Kalima Shahadah, the testimony', 'কালিমা শাহাদাত, সাক্ষ্যবাণী')),
               (Q('SubhanAllah, walhamdulillah, wa la ilaha illallah, wallahu akbar', 'সুবহানাল্লাহি ওয়াল হামদু লিল্লাহি ওয়া লা ইলাহা ইল্লাল্লাহু ওয়াল্লাহু আকবার'), Q('The most beloved words to Allah', 'আল্লাহর কাছে সবচেয়ে প্রিয় বাক্য')),
               (Q('La hawla wa la quwwata illa billah', 'লা হাওলা ওয়া লা কুওয়াতা ইল্লা বিল্লাহ'), Q('A treasure of Paradise', 'জান্নাতের একটি ভান্ডার'))],
              Q('"A good word is like a good tree, its root firm and its branches in the sky."', '"পবিত্র বাক্য একটি পবিত্র গাছের মতো, যার মূল সুদৃঢ় আর শাখা আকাশে।"'), 'Quran 14:24; Sahih Muslim 2137; Sahih al-Bukhari 4205'),
    ]),
])


# Names of Allah found in the Quran: (Arabic, transliteration en, bn, meaning en, bn, source)
NAMES = {
    'malik': ('الملك', 'Al-Malik', 'আল-মালিক', 'The King, the Sovereign', 'অধিপতি, সার্বভৌম', 'Quran 59:23'),
    'quddus': ('القدوس', 'Al-Quddus', 'আল-কুদ্দুস', 'The Most Holy', 'মহাপবিত্র', 'Quran 59:23'),
    'salam': ('السلام', 'As-Salam', 'আস-সালাম', 'The Source of peace', 'শান্তির উৎস', 'Quran 59:23'),
    'mumin': ('المؤمن', 'Al-Mu’min', 'আল-মুমিন', 'The Giver of safety', 'নিরাপত্তাদাতা', 'Quran 59:23'),
    'muhaymin': ('المهيمن', 'Al-Muhaymin', 'আল-মুহাইমিন', 'The Guardian over all', 'রক্ষণাবেক্ষণকারী', 'Quran 59:23'),
    'aziz': ('العزيز', 'Al-‘Aziz', 'আল-আজিজ', 'The Almighty', 'মহাপরাক্রমশালী', 'Quran 59:23'),
    'jabbar': ('الجبار', 'Al-Jabbar', 'আল-জাব্বার', 'The Compeller, who sets right', 'মহাপ্রতাপশালী, যিনি সব ঠিক করে দেন', 'Quran 59:23'),
    'mutakabbir': ('المتكبر', 'Al-Mutakabbir', 'আল-মুতাকাব্বির', 'The Supreme in greatness', 'সর্বশ্রেষ্ঠ মহিমার অধিকারী', 'Quran 59:23'),
    'khaliq': ('الخالق', 'Al-Khaliq', 'আল-খালিক', 'The Creator', 'সৃষ্টিকর্তা', 'Quran 59:24'),
    'bari': ('البارئ', 'Al-Bari’', 'আল-বারি', 'The Originator', 'উদ্ভাবনকর্তা', 'Quran 59:24'),
    'musawwir': ('المصور', 'Al-Musawwir', 'আল-মুসাওয়ির', 'The Fashioner of forms', 'আকৃতিদাতা', 'Quran 59:24'),
    'rahman': ('الرحمن', 'Ar-Rahman', 'আর-রহমান', 'The Entirely Merciful', 'পরম করুণাময়', 'Quran 1:3'),
    'ghaffar': ('الغفار', 'Al-Ghaffar', 'আল-গাফফার', 'The Ever-Forgiving', 'বারবার ক্ষমাকারী', 'Quran 71:10'),
    'tawwab': ('التواب', 'At-Tawwab', 'আত-তাওয়াব', 'The Accepter of repentance', 'তওবা কবুলকারী', 'Quran 2:37'),
    'afuww': ('العفو', 'Al-‘Afuww', 'আল-আফুউ', 'The Pardoner', 'মার্জনাকারী', 'Quran 4:43'),
    'rauf': ('الرؤوف', 'Ar-Ra’uf', 'আর-রাউফ', 'The Most Kind', 'অতি স্নেহশীল', 'Quran 2:143'),
    'wadud': ('الودود', 'Al-Wadud', 'আল-ওয়াদুদ', 'The Loving', 'প্রেমময়', 'Quran 85:14'),
    'halim': ('الحليم', 'Al-Halim', 'আল-হালিম', 'The Forbearing', 'সহনশীল', 'Quran 2:225'),
    'karim': ('الكريم', 'Al-Karim', 'আল-কারিম', 'The Most Generous', 'মহাদয়ালু, মহানুভব', 'Quran 82:6'),
    'shakur': ('الشكور', 'Ash-Shakur', 'আশ-শাকুর', 'The Appreciative', 'গুণগ্রাহী', 'Quran 35:30'),
    'alim': ('العليم', 'Al-‘Alim', 'আল-আলিম', 'The All-Knowing', 'সর্বজ্ঞ', 'Quran 2:32'),
    'sami': ('السميع', 'As-Sami‘', 'আস-সামি', 'The All-Hearing', 'সর্বশ্রোতা', 'Quran 42:11'),
    'basir': ('البصير', 'Al-Basir', 'আল-বাসির', 'The All-Seeing', 'সর্বদ্রষ্টা', 'Quran 42:11'),
    'khabir': ('الخبير', 'Al-Khabir', 'আল-খাবির', 'The All-Aware', 'সম্যক অবগত', 'Quran 67:14'),
    'latif': ('اللطيف', 'Al-Latif', 'আল-লাতিফ', 'The Subtle, the Gentle', 'সূক্ষ্মদর্শী, কোমল', 'Quran 67:14'),
    'hakim': ('الحكيم', 'Al-Hakim', 'আল-হাকিম', 'The Wise', 'প্রজ্ঞাময়', 'Quran 2:32'),
    'qawi': ('القوي', 'Al-Qawi', 'আল-কাওয়ি', 'The All-Strong', 'মহাশক্তিমান', 'Quran 22:40'),
    'qahhar': ('القهار', 'Al-Qahhar', 'আল-কাহহার', 'The Subduer of all', 'মহাপ্রতাপশালী, সবকিছুর ওপর পরাক্রমশালী', 'Quran 13:16'),
    'azim': ('العظيم', 'Al-‘Azim', 'আল-আজিম', 'The Magnificent', 'মহামহিম', 'Quran 2:255'),
    'aliyy': ('العلي', 'Al-‘Aliyy', 'আল-আলিয়্যু', 'The Most High', 'সমুচ্চ', 'Quran 2:255'),
    'raqib': ('الرقيب', 'Ar-Raqib', 'আর-রাকিব', 'The Watchful', 'সদা পর্যবেক্ষক', 'Quran 4:1'),
    'hayy': ('الحي', 'Al-Hayy', 'আল-হাইয়ু', 'The Ever-Living', 'চিরঞ্জীব', 'Quran 2:255'),
    'qayyum': ('القيوم', 'Al-Qayyum', 'আল-কাইয়ুম', 'The Sustainer of all', 'সবকিছুর ধারক', 'Quran 2:255'),
    'razzaq': ('الرزاق', 'Ar-Razzaq', 'আর-রাযযাক', 'The Provider', 'রিজিকদাতা', 'Quran 51:58'),
    'wahhab': ('الوهاب', 'Al-Wahhab', 'আল-ওয়াহহাব', 'The Bestower', 'মহাদাতা', 'Quran 3:8'),
    'fattah': ('الفتاح', 'Al-Fattah', 'আল-ফাত্তাহ', 'The Opener, the Judge', 'উন্মোচনকারী, ফয়সালাকারী', 'Quran 34:26'),
    'mujib': ('المجيب', 'Al-Mujib', 'আল-মুজিব', 'The Answerer of prayers', 'দোয়া কবুলকারী', 'Quran 11:61'),
    'wakil': ('الوكيل', 'Al-Wakil', 'আল-ওয়াকিল', 'The Trustee', 'কর্মবিধায়ক, ভরসাস্থল', 'Quran 3:173'),
    'ghani': ('الغني', 'Al-Ghani', 'আল-গনি', 'The Free of need', 'অমুখাপেক্ষী', 'Quran 35:15'),
    'awwal': ('الأول', 'Al-Awwal', 'আল-আউয়াল', 'The First', 'আদি (সর্বপ্রথম)', 'Quran 57:3'),
    'akhir': ('الآخر', 'Al-Akhir', 'আল-আখির', 'The Last', 'অন্ত (সর্বশেষ)', 'Quran 57:3'),
    'zahir': ('الظاهر', 'Az-Zahir', 'আজ-জাহির', 'The Manifest', 'প্রকাশ্য', 'Quran 57:3'),
    'batin': ('الباطن', 'Al-Batin', 'আল-বাতিন', 'The Hidden', 'গোপন', 'Quran 57:3'),
    'nur': ('النور', 'An-Nur', 'আন-নূর', 'The Light', 'আলো', 'Quran 24:35'),
    'haqq': ('الحق', 'Al-Haqq', 'আল-হাক', 'The Truth', 'পরম সত্য', 'Quran 22:6'),
}


def name_match(keys, prompt=None):
    pairs = [(AR(NAMES[k][0]), Q(NAMES[k][3], NAMES[k][4])) for k in keys]
    names = ', '.join(NAMES[k][1] for k in keys)
    names_bn = ', '.join(NAMES[k][2] for k in keys)
    sources = '; '.join(dict.fromkeys(NAMES[k][5] for k in keys))
    return match(prompt or Q('Match each name to its meaning', 'প্রতিটি নামের অর্থ মেলান'), pairs, Q(names + '.', names_bn + '।'), sources)


def name_meaning(key, wrong, correct):
    """What does <name> mean? `wrong` = keys whose meanings are the wrong answers; `correct` = the answer's place."""
    ar, en, bn_, m_en, m_bn, src = NAMES[key]
    options = [Q(NAMES[w][3], NAMES[w][4]) for w in wrong]
    options.insert(correct, Q(m_en, m_bn))
    return choice(Q(f'What does {en} ({ar}) mean?', f'{bn_} ({ar}) অর্থ কী?'), options, correct, Q(f'{en}: {m_en}.', f'{bn_}: {m_bn}।'), src)


def which_name(key, wrong, correct):
    ar, en, bn_, m_en, m_bn, src = NAMES[key]
    options = [AR(NAMES[w][0]) for w in wrong]
    options.insert(correct, AR(ar))
    return choice(Q(f'Which name means "{m_en}"?', f'কোন নামের অর্থ "{m_bn}"?'), options, correct, Q(f'{en}: {m_en}.', f'{bn_}: {m_bn}।'), src)


NAMES_UNIT = ('names-of-allah', Q('The beautiful names of Allah', 'আল্লাহর সুন্দর নামসমূহ'),
              Q('Forty-five of Allah’s names from the Quran and what they mean.', 'কুরআনে বর্ণিত আল্লাহর পঁয়তাল্লিশটি নাম ও তাদের অর্থ।'), None, 'sparkles', [
    ('hashr', Q('The names at the end of al-Hashr', 'সূরা হাশরের শেষের নামসমূহ'), 'lesson', [
        name_match(['malik', 'quddus', 'salam', 'mumin', 'muhaymin']),
        name_match(['aziz', 'jabbar', 'mutakabbir', 'khaliq', 'musawwir']),
        name_meaning('bari', ['malik', 'nur', 'wadud'], 2),
        which_name('quddus', ['qahhar', 'ghani', 'wakil'], 0),
        tf(Q('The last three ayahs of Surah al-Hashr gather many of Allah’s names.', 'সূরা হাশরের শেষ তিন আয়াতে আল্লাহর অনেক নাম একসঙ্গে এসেছে।'), True,
           Q('"…To Him belong the most beautiful names."', '"…সুন্দরতম নামসমূহ তাঁরই।"'), 'Quran 59:22–24'),
        tf(Q('The Prophet ﷺ said Allah has ninety-nine names; whoever learns them will enter Paradise.', 'নবী ﷺ বলেছেন, আল্লাহর নিরানব্বইটি নাম আছে; যে এগুলো আয়ত্ত করবে সে জান্নাতে যাবে।'), True,
           Q('Learning them means knowing them, understanding them and living by them.', 'আয়ত্ত করা মানে জানা, বোঝা এবং সে অনুযায়ী জীবন গড়া।'), 'Sahih al-Bukhari 2736'),
    ]),
    ('mercy', Q('Names of mercy & forgiveness', 'দয়া ও ক্ষমার নামসমূহ'), 'lesson', [
        name_match(['rahman', 'tawwab', 'rauf', 'wadud', 'halim']),
        name_match(['ghaffar', 'karim', 'shakur', 'afuww'], Q('Match each name to its meaning', 'প্রতিটি নামের অর্থ মেলান')),
        name_meaning('halim', ['qawi', 'awwal', 'basir'], 1),
        which_name('afuww', ['jabbar', 'alim', 'hayy'], 3),
        tf(Q('"Say: O My servants who have wronged themselves, do not despair of Allah’s mercy; Allah forgives all sins."', '"বলুন: হে আমার বান্দারা, যারা নিজেদের ওপর জুলুম করেছ, আল্লাহর রহমত থেকে নিরাশ হয়ো না; আল্লাহ সব গুনাহ ক্ষমা করেন।"'), True,
           Q('This is Quran 39:53 — for those who turn back to Him in repentance.', 'এটি কুরআনের ৩৯:৫৩ আয়াত — যারা তওবা করে তাঁর দিকে ফিরে আসে তাদের জন্য।'), 'Quran 39:53'),
        fill(Q('Complete the dua of Laylat al-Qadr', 'লাইলাতুল কদরের দোয়াটি পূর্ণ করুন'), Q('Allahumma innaka', 'আল্লাহুম্মা ইন্নাকা'), Q('tuhibbul-‘afwa fa‘fu ‘anni', 'তুহিব্বুল আফওয়া ফা‘ফু আন্নি'),
             [Q('‘afuwwun', 'আফুউন'), Q('jabbarun', 'জাব্বারুন'), Q('qahharun', 'কাহহারুন'), Q('ghaniyyun', 'গনিয়্যুন')], 0,
             Q('"O Allah, You are the Pardoner, You love to pardon, so pardon me."', '"হে আল্লাহ, আপনি ক্ষমাশীল, ক্ষমা করতে ভালোবাসেন, তাই আমাকে ক্ষমা করুন।"'), 'Jami‘ at-Tirmidhi 3513'),
    ]),
    ('knowledge-power', Q('Names of knowledge & power', 'জ্ঞান ও শক্তির নামসমূহ'), 'lesson', [
        name_match(['alim', 'sami', 'basir', 'khabir', 'hakim']),
        name_match(['qawi', 'qahhar', 'azim', 'aliyy', 'raqib']),
        name_meaning('latif', ['haqq', 'malik', 'zahir'], 0),
        which_name('raqib', ['razzaq', 'salam', 'nur'], 2),
        tf(Q('"There is nothing like Him, and He is the All-Hearing, the All-Seeing."', '"কোনো কিছুই তাঁর সদৃশ নয়, তিনি সর্বশ্রোতা, সর্বদ্রষ্টা।"'), True,
           Q('Allah hears and sees, but nothing is like Him.', 'আল্লাহ শোনেন ও দেখেন, কিন্তু কোনো কিছুই তাঁর মতো নয়।'), 'Quran 42:11'),
        choice(Q('Ayat al-Kursi ends with which two names?', 'আয়াতুল কুরসি কোন দুটি নাম দিয়ে শেষ হয়?'),
               [Q('Al-‘Aliyy, al-‘Azim (the Most High, the Magnificent)', 'আল-আলিয়্যু, আল-আজিম (সমুচ্চ, মহামহিম)'), Q('Al-Ghafur, ar-Rahim', 'আল-গাফুর, আর-রাহিম'),
                Q('Al-‘Aziz, al-Hakim', 'আল-আজিজ, আল-হাকিম'), Q('As-Sami‘, al-Basir', 'আস-সামি, আল-বাসির')], 0,
               Q('"…and He is the Most High, the Magnificent (wa huwal-‘Aliyyul-‘Azim)."', '"…আর তিনি সমুচ্চ, মহামহিম (ওয়া হুয়াল আলিয়্যুল আজিম)।"'), 'Quran 2:255'),
    ]),
    ('life-provision', Q('Names of life & provision', 'জীবন ও রিজিকের নামসমূহ'), 'lesson', [
        name_match(['hayy', 'qayyum', 'razzaq', 'wahhab', 'fattah']),
        name_match(['awwal', 'akhir', 'zahir', 'batin'], Q('Match the four names of al-Hadid 57:3', 'সূরা হাদিদ ৫৭:৩-এর চারটি নাম মেলান')),
        name_match(['mujib', 'wakil', 'ghani', 'nur', 'haqq']),
        name_meaning('razzaq', ['mutakabbir', 'awwal', 'sami'], 3),
        which_name('mujib', ['batin', 'khaliq', 'aziz'], 1),
        tf(Q('"Hasbunallahu wa ni‘mal-Wakil" — Allah is enough for us, and He is the best Trustee.', '"হাসবুনাল্লাহু ওয়া নি‘মাল ওয়াকিল" — আল্লাহই আমাদের জন্য যথেষ্ট, তিনি উত্তম কর্মবিধায়ক।'), True,
           Q('Said by the believers when they were frightened by the enemy, and by Ibrahim (AS) when thrown into the fire.', 'শত্রুর ভয় দেখানো হলে মুমিনরা এবং আগুনে নিক্ষেপের সময় ইবরাহিম (আ.) এটি বলেছিলেন।'), 'Quran 3:173; Sahih al-Bukhari 4563'),
    ]),
    ('review', Q('Unit review', 'ইউনিট রিভিউ'), 'checkpoint', [
        name_match(['rahman', 'razzaq', 'alim', 'quddus', 'ghani'], Q('Match each name to its meaning', 'প্রতিটি নামের অর্থ মেলান')),
        name_meaning('wadud', ['qahhar', 'batin', 'jabbar'], 2),
        name_meaning('khabir', ['karim', 'akhir', 'salam'], 1),
        which_name('hayy', ['nur', 'hakim', 'shakur'], 0),
        which_name('tawwab', ['aliyy', 'mumin', 'fattah'], 3),
        name_match(['malik', 'basir', 'wakil', 'awwal'], Q('Match each name to its meaning', 'প্রতিটি নামের অর্থ মেলান')),
    ]),
])


# ===================================================== Quran: short-surah meanings
# Per-ayah meanings (a simple rendering of the meaning, not a published translation).
SURAH_NAMES = {
    1: ('Al-Fatiha', 'আল-ফাতিহা'), 97: ('Al-Qadr', 'আল-কদর'), 102: ('At-Takathur', 'আত-তাকাসুর'), 103: ('Al-‘Asr', 'আল-আসর'),
    105: ('Al-Fil', 'আল-ফিল'), 106: ('Quraysh', 'কুরাইশ'), 107: ('Al-Ma‘un', 'আল-মাউন'), 108: ('Al-Kawthar', 'আল-কাওসার'),
    109: ('Al-Kafirun', 'আল-কাফিরুন'), 110: ('An-Nasr', 'আন-নাসর'), 111: ('Al-Masad', 'আল-মাসাদ'), 112: ('Al-Ikhlas', 'আল-ইখলাস'),
    113: ('Al-Falaq', 'আল-ফালাক'), 114: ('An-Nas', 'আন-নাস'),
}
MEANINGS = {
    1: [Q('In the name of Allah, the Entirely Merciful, the Especially Merciful.', 'পরম করুণাময়, অতি দয়ালু আল্লাহর নামে।'),
        Q('All praise is for Allah, Lord of all the worlds.', 'সকল প্রশংসা আল্লাহর, যিনি সকল জগতের রব।'),
        Q('The Entirely Merciful, the Especially Merciful.', 'যিনি পরম করুণাময়, অতি দয়ালু।'),
        Q('Master of the Day of Judgement.', 'বিচার দিবসের মালিক।'),
        Q('You alone we worship, and You alone we ask for help.', 'আমরা শুধু আপনারই ইবাদত করি এবং শুধু আপনারই কাছে সাহায্য চাই।'),
        Q('Guide us to the straight path —', 'আমাদের সরল পথ দেখান —'),
        Q('the path of those You have blessed, not of those who earned anger, nor of those who went astray.', 'তাদের পথ, যাদের আপনি অনুগ্রহ করেছেন; তাদের নয় যারা গজবপ্রাপ্ত, এবং তাদেরও নয় যারা পথভ্রষ্ট।')],
    97: [Q('Indeed, We sent it (the Quran) down on the Night of Decree.', 'নিশ্চয় আমি এটি (কুরআন) কদরের রাতে নাজিল করেছি।'),
         Q('And what will make you know what the Night of Decree is?', 'আর আপনি কি জানেন, কদরের রাত কী?'),
         Q('The Night of Decree is better than a thousand months.', 'কদরের রাত হাজার মাসের চেয়েও উত্তম।'),
         Q('The angels and the Spirit (Jibril) come down in it, by their Lord’s leave, with every matter.', 'সে রাতে ফেরেশতাগণ ও রুহ (জিবরাইল) তাঁদের রবের অনুমতিক্রমে প্রত্যেক বিষয় নিয়ে অবতরণ করেন।'),
         Q('Peace it is, until the rising of the dawn.', 'শান্তিময় সে রাত, ফজরের উদয় পর্যন্ত।')],
    102: [Q('Competing for more and more distracts you,', 'প্রাচুর্যের প্রতিযোগিতা তোমাদের (আল্লাহ থেকে) ভুলিয়ে রেখেছে,'),
          Q('until you visit the graves.', 'যতক্ষণ না তোমরা কবরে পৌঁছে যাও।'),
          Q('No! You are going to know.', 'কখনো না! শীঘ্রই তোমরা জানবে।'),
          Q('Then no! You are going to know.', 'আবার বলি, কখনো না! শীঘ্রই তোমরা জানবে।'),
          Q('No! If only you knew with the knowledge of certainty…', 'কখনো না! যদি তোমরা নিশ্চিত জ্ঞানে জানতে…'),
          Q('You will surely see the Blazing Fire.', 'তোমরা অবশ্যই জাহান্নাম দেখবে।'),
          Q('Then you will surely see it with the eye of certainty.', 'তারপর তোমরা তা অবশ্যই নিশ্চিত চোখে দেখবে।'),
          Q('Then on that Day you will surely be asked about the pleasures (you enjoyed).', 'তারপর সেদিন তোমাদের অবশ্যই (দুনিয়ার) নিয়ামত সম্পর্কে জিজ্ঞাসা করা হবে।')],
    103: [Q('By time!', 'সময়ের শপথ!'),
          Q('Indeed, mankind is in loss,', 'নিশ্চয় মানুষ ক্ষতির মধ্যে আছে,'),
          Q('except those who believe, do righteous deeds, and urge one another to the truth and to patience.', 'তবে তারা নয়, যারা ঈমান আনে, সৎকাজ করে, পরস্পরকে সত্যের উপদেশ দেয় এবং ধৈর্যের উপদেশ দেয়।')],
    105: [Q('Have you not seen how your Lord dealt with the people of the Elephant?', 'আপনি কি দেখেননি, আপনার রব হাতিওয়ালাদের সঙ্গে কী করেছিলেন?'),
          Q('Did He not make their plan go astray?', 'তিনি কি তাদের চক্রান্ত ব্যর্থ করে দেননি?'),
          Q('And He sent against them birds in flocks,', 'আর তিনি তাদের ওপর ঝাঁকে ঝাঁকে পাখি পাঠালেন,'),
          Q('striking them with stones of baked clay,', 'যারা তাদের ওপর পোড়া মাটির পাথর নিক্ষেপ করছিল,'),
          Q('and He made them like eaten straw.', 'অতঃপর তিনি তাদের খাওয়া ভুসির মতো করে দিলেন।')],
    106: [Q('For the familiar safety of Quraysh —', 'কুরাইশের অভ্যস্ততার কারণে —'),
          Q('their familiar journeys of winter and summer —', 'শীত ও গ্রীষ্মের সফরে তাদের অভ্যস্ততার কারণে —'),
          Q('let them worship the Lord of this House,', 'তারা যেন এই ঘরের (কাবার) রবের ইবাদত করে,'),
          Q('who fed them against hunger and made them safe from fear.', 'যিনি তাদের ক্ষুধায় খাবার দিয়েছেন এবং ভয় থেকে নিরাপদ রেখেছেন।')],
    107: [Q('Have you seen the one who denies the Judgement?', 'আপনি কি তাকে দেখেছেন, যে প্রতিদান দিবসকে অস্বীকার করে?'),
          Q('That is the one who drives away the orphan,', 'সে-ই তো এতিমকে রূঢ়ভাবে তাড়িয়ে দেয়,'),
          Q('and does not urge the feeding of the poor.', 'এবং মিসকিনকে খাবার দিতে উৎসাহ দেয় না।'),
          Q('So woe to those who pray,', 'অতএব দুর্ভোগ সেই নামাজিদের,'),
          Q('who are heedless of their prayer,', 'যারা নিজেদের নামাজের ব্যাপারে উদাসীন,'),
          Q('those who only show off,', 'যারা লোক দেখানোর জন্য আমল করে,'),
          Q('and withhold small kindnesses.', 'এবং ছোটখাটো সাহায্যের জিনিসও দেয় না।')],
    108: [Q('Indeed, We have given you al-Kawthar (abundant good).', 'নিশ্চয় আমি আপনাকে কাওসার (অফুরন্ত কল্যাণ) দান করেছি।'),
          Q('So pray to your Lord and sacrifice.', 'অতএব আপনার রবের উদ্দেশে নামাজ পড়ুন ও কুরবানি করুন।'),
          Q('Indeed, it is your enemy who is cut off.', 'নিশ্চয় আপনার শত্রুই শিকড়কাটা (নির্বংশ)।')],
    109: [Q('Say: O disbelievers,', 'বলুন: হে কাফিররা,'),
          Q('I do not worship what you worship,', 'আমি তার ইবাদত করি না, যার ইবাদত তোমরা করো,'),
          Q('nor do you worship what I worship,', 'এবং তোমরাও তাঁর ইবাদতকারী নও, যাঁর ইবাদত আমি করি,'),
          Q('nor will I worship what you have worshipped,', 'আর আমি তার ইবাদতকারী নই, যার ইবাদত তোমরা করেছ,'),
          Q('nor will you worship what I worship.', 'এবং তোমরাও তাঁর ইবাদতকারী হবে না, যাঁর ইবাদত আমি করি।'),
          Q('For you is your religion, and for me is mine.', 'তোমাদের জন্য তোমাদের দ্বীন, আর আমার জন্য আমার দ্বীন।')],
    110: [Q('When the help of Allah and the victory come,', 'যখন আল্লাহর সাহায্য ও বিজয় আসবে,'),
          Q('and you see people entering Allah’s religion in crowds,', 'এবং আপনি দেখবেন মানুষ দলে দলে আল্লাহর দ্বীনে প্রবেশ করছে,'),
          Q('then glorify your Lord with praise and ask His forgiveness; He is ever accepting of repentance.', 'তখন আপনার রবের প্রশংসাসহ তাঁর পবিত্রতা ঘোষণা করুন এবং তাঁর কাছে ক্ষমা চান; নিশ্চয় তিনি তওবা কবুলকারী।')],
    111: [Q('May the hands of Abu Lahab perish, and perish he has!', 'আবু লাহাবের দুই হাত ধ্বংস হোক, আর সে নিজেও ধ্বংস হয়েছে!'),
          Q('His wealth did not help him, nor what he earned.', 'তার সম্পদ ও উপার্জন তার কোনো কাজে আসেনি।'),
          Q('He will burn in a Fire of blazing flame,', 'অচিরেই সে লেলিহান শিখার আগুনে প্রবেশ করবে,'),
          Q('and his wife too, the carrier of firewood,', 'আর তার স্ত্রীও — যে কাঠ বহনকারিণী,'),
          Q('around her neck a rope of palm fibre.', 'তার গলায় খেজুর-আঁশের পাকানো রশি।')],
    112: [Q('Say: He is Allah, the One.', 'বলুন: তিনিই আল্লাহ, এক-অদ্বিতীয়।'),
          Q('Allah, the Self-Sufficient, whom all need.', 'আল্লাহ অমুখাপেক্ষী, সবাই তাঁর মুখাপেক্ষী।'),
          Q('He neither begets nor was He begotten.', 'তিনি কাউকে জন্ম দেননি এবং কারো থেকে জন্ম নেননি।'),
          Q('And there is none comparable to Him.', 'এবং তাঁর সমতুল্য কেউ নেই।')],
    113: [Q('Say: I seek refuge with the Lord of daybreak,', 'বলুন: আমি আশ্রয় চাই ঊষার রবের কাছে,'),
          Q('from the evil of what He created,', 'তিনি যা সৃষ্টি করেছেন তার অনিষ্ট থেকে,'),
          Q('and from the evil of darkness when it settles,', 'এবং রাতের অন্ধকারের অনিষ্ট থেকে, যখন তা ছেয়ে যায়,'),
          Q('and from the evil of those who blow on knots,', 'এবং গিরায় ফুঁ দেয় এমন (জাদুকর) নারীদের অনিষ্ট থেকে,'),
          Q('and from the evil of an envier when he envies.', 'এবং হিংসুকের অনিষ্ট থেকে, যখন সে হিংসা করে।')],
    114: [Q('Say: I seek refuge with the Lord of mankind,', 'বলুন: আমি আশ্রয় চাই মানুষের রবের কাছে,'),
          Q('the King of mankind,', 'মানুষের অধিপতির কাছে,'),
          Q('the God of mankind,', 'মানুষের ইলাহের কাছে,'),
          Q('from the evil of the retreating whisperer,', 'আত্মগোপনকারী কুমন্ত্রণাদাতার অনিষ্ট থেকে,'),
          Q('who whispers in the hearts of mankind,', 'যে মানুষের অন্তরে কুমন্ত্রণা দেয়,'),
          Q('from among the jinn and mankind.', 'জিনের মধ্য থেকে এবং মানুষের মধ্য থেকে।')],
}
# Ayahs too alike to be wrong answers for each other.
ALIKE = [{(1, 1), (1, 3)}, {(102, 3), (102, 4)}, {(109, 2), (109, 3), (109, 4), (109, 5)}, {(114, 1), (114, 2), (114, 3)}]


def ayah(surah: int, n: int) -> str:
    return SURAHS[surah]['ayahs'][n - 1]


def alike(a, b) -> bool:
    return a == b or any(a in g and b in g for g in ALIKE)


def ayah_ref(surah: int, n: int | None = None):
    en, bn_ = SURAH_NAMES[surah]
    if n is None:
        return Q(f'Surah {en}.', f'সূরা {bn_}।')
    return Q(f'Surah {en}, ayah {n}: {MEANINGS[surah][n - 1]["en"]}', f'সূরা {bn_}, আয়াত {bn(n)}: {MEANINGS[surah][n - 1]["bn"]}')


def unique_ayahs(surah: int) -> list[int]:
    """Ayah numbers whose Arabic text is not repeated earlier in the surah (109:5 repeats 109:3)."""
    seen, out = set(), []
    for n, text in enumerate(SURAHS[surah]['ayahs'], 1):
        if text not in seen:
            seen.add(text)
            out.append(n)
    return out


def wrong_meanings(surah: int, n: int, pool: list[int], k: int = 3) -> list[tuple[int, int]]:
    """k wrong answers: other ayahs of the same surah first, then of the pool's surahs; never alike ones."""
    out = []
    for s in [surah] + [p for p in pool if p != surah]:
        for m in unique_ayahs(s):
            cand = (s, m)
            if len(out) < k and not alike(cand, (surah, n)) and MEANINGS[s][m - 1] not in [MEANINGS[a][b - 1] for a, b in out] \
                    and MEANINGS[s][m - 1] != MEANINGS[surah][n - 1]:
                out.append(cand)
    return out


def place(correct_item, wrong_items, slot: int):
    options = list(wrong_items)
    slot %= len(options) + 1
    options.insert(slot, correct_item)
    return options, slot


def surah_meaning_lesson(surah: int, pool: list[int]):
    en, bn_ = SURAH_NAMES[surah]
    ayahs = unique_ayahs(surah)
    items = []
    # 1. Meanings in the order of the surah.
    if 3 <= len(MEANINGS[surah]) <= 10:
        items.append(order(Q(f'Put the meanings of Surah {en} in order', f'সূরা {bn_}-এর অর্থগুলো ক্রমানুসারে সাজান'), MEANINGS[surah],
                           Q(f'The ayahs of Surah {en}, one after another.', f'সূরা {bn_}-এর আয়াতগুলো পরপর।'), f'Quran {surah}'))
    # 2. Match ayah to meaning, in groups of up to four.
    groups = [ayahs] if len(ayahs) <= 4 else [ayahs[:(len(ayahs) + 1) // 2], ayahs[(len(ayahs) + 1) // 2:]]
    for g in groups:
        if len(g) >= 2:
            items.append(match(Q('Match each ayah to its meaning', 'প্রতিটি আয়াতের অর্থ মেলান'),
                               [(AR(ayah(surah, n)), MEANINGS[surah][n - 1]) for n in g],
                               ayah_ref(surah), f'Quran {surah}:{g[0]}–{g[-1]}'))
    # 3. What does this ayah mean? (up to three ayahs, spread over the surah)
    picks = [ayahs[i] for i in sorted({0, len(ayahs) // 2, len(ayahs) - 1})]
    for k, n in enumerate(picks):
        wrong = [MEANINGS[s][m - 1] for s, m in wrong_meanings(surah, n, pool)]
        options, slot = place(MEANINGS[surah][n - 1], wrong, surah + n + k)
        items.append(choice(Q(f'What does «{ayah(surah, n)}» mean?', f'«{ayah(surah, n)}» অর্থ কী?'), options, slot, ayah_ref(surah, n), f'Quran {surah}:{n}'))
    # 4. Which ayah means …? (Arabic options)
    n = ayahs[1] if len(ayahs) > 1 else ayahs[0]
    wrong = [AR(ayah(s, m)) for s, m in wrong_meanings(surah, n, pool)]
    options, slot = place(AR(ayah(surah, n)), wrong, surah + 2 * n)
    items.append(choice(Q(f'Which ayah means: "{MEANINGS[surah][n - 1]["en"]}"', f'কোন আয়াতের অর্থ: "{MEANINGS[surah][n - 1]["bn"]}"'), options, slot,
                        ayah_ref(surah, n), f'Quran {surah}:{n}'))
    # 5. True or false (one true, one false).
    t = ayahs[-1]
    items.append(tf(Q(f'«{ayah(surah, t)}» means: "{MEANINGS[surah][t - 1]["en"]}"', f'«{ayah(surah, t)}» অর্থ: "{MEANINGS[surah][t - 1]["bn"]}"'), True,
                    ayah_ref(surah, t), f'Quran {surah}:{t}'))
    f = ayahs[0]
    ws, wm = wrong_meanings(surah, f, pool, 1)[0]
    items.append(tf(Q(f'«{ayah(surah, f)}» means: "{MEANINGS[ws][wm - 1]["en"]}"', f'«{ayah(surah, f)}» অর্থ: "{MEANINGS[ws][wm - 1]["bn"]}"'), False,
                    ayah_ref(surah, f), f'Quran {surah}:{f}'))
    return (f'surah-{surah}', Q(f'Surah {en}: meaning', f'সূরা {bn_}: অর্থ'), 'lesson', items[:10])


def surah_review(surahs: list[int]):
    """Which surah has this meaning? + what does this ayah mean?, across the unit."""
    items = []
    for k, s in enumerate(surahs):
        n = unique_ayahs(s)[-1]
        others = [x for x in surahs + [x for x in SURAH_NAMES if x not in surahs] if x != s][:3]
        options, slot = place(Q(*SURAH_NAMES[s]), [Q(*SURAH_NAMES[o]) for o in others], k + s)
        items.append(choice(Q(f'Which surah has the ayah meaning: "{MEANINGS[s][n - 1]["en"]}"', f'কোন সূরায় এই অর্থের আয়াত আছে: "{MEANINGS[s][n - 1]["bn"]}"'),
                            options, slot, ayah_ref(s, n), f'Quran {s}:{n}'))
    for k, s in enumerate(surahs):
        if len(items) >= 9:
            break
        n = unique_ayahs(s)[0]
        wrong = [MEANINGS[a][b - 1] for a, b in wrong_meanings(s, n, [x for x in surahs if x != s] + [s], 3)]
        options, slot = place(MEANINGS[s][n - 1], wrong, k + 2 * s)
        items.append(choice(Q(f'What does «{ayah(s, n)}» mean?', f'«{ayah(s, n)}» অর্থ কী?'), options, slot, ayah_ref(s, n), f'Quran {s}:{n}'))
    return ('review', Q('Unit review', 'ইউনিট রিভিউ'), 'checkpoint', items)


def surah_unit(key: str, title, description, surahs: list[int]):
    lessons = [surah_meaning_lesson(s, surahs) for s in surahs]
    lessons.append(surah_review(surahs))
    return (key, title, description, None, 'book-open', lessons)


SURAH_UNITS = [
    surah_unit('surah-meanings-1', Q('Meanings: Al-Fatiha & the last three', 'অর্থ: আল-ফাতিহা ও শেষ তিন সূরা'),
               Q('Know what you recite every day: al-Fatiha, al-Ikhlas, al-Falaq and an-Nas.', 'প্রতিদিন যা পড়ি তার অর্থ: ফাতিহা, ইখলাস, ফালাক ও নাস।'), [1, 112, 113, 114]),
    surah_unit('surah-meanings-2', Q('Meanings: Al-‘Asr to Al-Masad', 'অর্থ: আল-আসর থেকে আল-মাসাদ'),
               Q('Al-‘Asr, al-Kawthar, al-Kafirun, an-Nasr and al-Masad.', 'আসর, কাওসার, কাফিরুন, নাসর ও মাসাদ।'), [103, 108, 109, 110, 111]),
    surah_unit('surah-meanings-3', Q('Meanings: Al-Fil, Quraysh, Al-Ma‘un, At-Takathur & Al-Qadr', 'অর্থ: আল-ফিল, কুরাইশ, আল-মাউন, আত-তাকাসুর ও আল-কদর'),
               Q('Five more short surahs often read in salah.', 'নামাজে প্রায়ই পড়া আরও পাঁচটি ছোট সূরা।'), [105, 106, 107, 102, 97]),
]


# ================================================================ the tree
# (existing category slug, section key, section title, description, [units])
SECTIONS = [
    ('salah', 'pray-step-by-step', Q('Learn to pray, step by step', 'নামাজ শিখি: ধাপে ধাপে'),
     Q('Wudu and ghusl, every position of the prayer and what is said in it, and the janazah.', 'অজু ও গোসল, নামাজের প্রতিটি অবস্থা ও তাতে কী পড়া হয়, এবং জানাযা।'), [WUDU, SALAH, JANAZAH]),
    ('ibadah', 'worship-in-practice', Q('Worship in practice', 'হাতে-কলমে ইবাদত'),
     Q('How to fast, pay zakat, perform Hajj and Umrah, and give qurbani.', 'কীভাবে রোজা রাখবেন, যাকাত দেবেন, হজ-উমরাহ করবেন ও কুরবানি দেবেন।'), [FASTING, ZAKAT, HAJJ, QURBANI]),
    ('iman', 'kalima-and-names', Q('The kalima & the names of Allah', 'কালিমা ও আল্লাহর নাম'),
     Q('The words of faith and the meanings of Allah’s beautiful names.', 'ঈমানের বাক্য এবং আল্লাহর সুন্দর নামসমূহের অর্থ।'), [KALIMA, NAMES_UNIT]),
    ('quran', 'short-surah-meanings', Q('Meanings of the short surahs', 'ছোট সূরার অর্থ'),
     Q('Match each ayah of the short surahs to its meaning, so you understand what you recite.', 'ছোট সূরাগুলোর প্রতিটি আয়াতের অর্থ মিলিয়ে শিখুন, যাতে যা পড়েন তা বোঝেন।'), SURAH_UNITS),
]


def items_of(tree):
    for cat, sec, _t, _d, units in tree:
        for unit in units:
            for lesson in unit[5]:
                for item in lesson[3]:
                    yield (cat, sec, unit[0], lesson[0]), item


def i18n_ok(v, allow_empty=False) -> bool:
    if not isinstance(v, dict):
        return False
    if 'ar' in v:
        return set(v) == {'ar'} and bool(v['ar'].strip())
    if set(v) != {'en', 'bn'}:
        return False
    return allow_empty and (v['en'].strip() or v['bn'].strip()) or (v['en'].strip() and v['bn'].strip())


def item_ok(kind: str, d: dict) -> bool:
    """Mirror of private.is_learn_item_ok (migration 079), for the playable types."""
    if kind in ('choice', 'fill'):
        n = len(d.get('options', []))
        if not (2 <= n <= 6 and isinstance(d.get('correct'), int) and 0 <= d['correct'] < n):
            return False
        if not all(isinstance(o, dict) for o in d['options']):
            return False
        if kind == 'fill':
            return ('before' in d or 'after' in d) and all(isinstance(d.get(k, {}), dict) for k in ('before', 'after'))
        return True
    if kind == 'true_false':
        return isinstance(d.get('answer'), bool)
    if kind == 'match':
        p = d.get('pairs', [])
        return 2 <= len(p) <= 6 and all(isinstance(x.get('left'), dict) and isinstance(x.get('right'), dict) for x in p)
    if kind == 'order':
        return 2 <= len(d.get('pieces', [])) <= 10 and all(isinstance(x, dict) for x in d['pieces'])
    return False


def check(tree):
    keys = set()
    for cat, sec, title, desc, units in tree:
        assert i18n_ok(title) and i18n_ok(desc), sec
        for unit_key, u_title, u_desc, _color, _icon, lessons in units:
            assert unit_key not in keys, ('repeated unit', unit_key)
            keys.add(unit_key)
            assert i18n_ok(u_title) and i18n_ok(u_desc), unit_key
            l_keys = [lsn[0] for lsn in lessons]
            assert len(l_keys) == len(set(l_keys)), (unit_key, 'repeated lesson')
            for l_key, l_title, kind, items in lessons:
                assert kind in ('lesson', 'checkpoint') and i18n_ok(l_title), (unit_key, l_key)
                assert 5 <= len(items) <= 10, (unit_key, l_key, len(items))
    for where, (kind, prompt, data, explanation, source) in items_of(tree):
        assert kind in PLAYABLE, (where, kind)
        assert item_ok(kind, data), (where, kind, data)
        assert i18n_ok(prompt) and i18n_ok(explanation), (where, 'prompt/explanation')
        assert source and source.strip(), (where, 'no source')
        values = data.get('options') or data.get('pieces') or [p[s] for p in data.get('pairs', []) for s in ('left', 'right')]
        assert all(i18n_ok(v) for v in values), (where, 'value')
        for k in ('before', 'after'):
            if k in data:
                assert i18n_ok(data[k], allow_empty=True), (where, k)
        if 'options' in data:
            assert len({json.dumps(o, sort_keys=True) for o in data['options']}) == len(data['options']), (where, 'repeated option')
        if kind == 'match':
            for side in ('left', 'right'):
                assert len({json.dumps(p[side], sort_keys=True) for p in data['pairs']}) == len(data['pairs']), (where, 'repeated ' + side)
        if kind == 'order' and not any('ar' in p for p in data['pieces']):
            assert len({json.dumps(p, sort_keys=True) for p in data['pieces']}) == len(data['pieces']) or where[2].startswith('surah-meanings'), (where, 'repeated piece')


def build(tree) -> str:
    units = sum(len(s[4]) for s in tree)
    lessons = sum(len(u[5]) for s in tree for u in s[4])
    items = sum(1 for _ in items_of(tree))
    out = [f"""-- Islamic Studio Academy, batch 2: {len(tree)} sections, {units} units, {lessons} lessons, {items} items (English and Bangla).
-- Generated by islamic_studio_learn_batch2.py; edit that, not this.
-- Run after migrations 079 and 085 and islamic_studio_learn_part*.sql (the sections join the
-- existing categories; if a category is missing, its section is skipped and the units stay
-- without a section, hidden in the app). Safe to run again: fixed ids, ON CONFLICT DO NOTHING.
-- Units go in as '{REVIEW_STATUS}': approve them in batools → Islamic Studio → Content Review.

BEGIN;
"""]
    for cat, sec, title, desc, units_ in tree:
        sec_id = uid('section', f'{cat}:{sec}')
        out.append(f'\n-- ===== {title["en"]} / {title["bn"]} (category: {cat})')
        out.append('INSERT INTO is_learn_sections (id, category_id, title, description, sort_order) '
                   f"SELECT {sql(sec_id)}, c.id, {sql(title)}, {sql(desc)}, {SECTION_SORT} FROM is_learn_categories c WHERE c.id = {sql(category_id(cat))} "
                   'ON CONFLICT (id) DO NOTHING;')
        for u_order, (unit_key, u_title, u_desc, color, icon, lessons_) in enumerate(units_, 1):
            unit_id = uid('unit', unit_key)
            out.append(f'\n-- {u_title["en"]} / {u_title["bn"]}')
            out.append('INSERT INTO is_learn_units (id, title, description, color, icon, review_status, sort_order, section_id) VALUES ('
                       f"{sql(unit_id)}, {sql(u_title)}, {sql(u_desc)}, {sql(color)}, {sql(icon)}, {sql(REVIEW_STATUS)}, {u_order}, "
                       f"(SELECT s.id FROM is_learn_sections s WHERE s.id = {sql(sec_id)})) ON CONFLICT (id) DO NOTHING;")
            for l_order, (l_key, l_title, kind, items_) in enumerate(lessons_, 1):
                lesson_id = uid('lesson', f'{unit_key}:{l_key}')
                out.append('INSERT INTO is_learn_lessons (id, unit_id, title, kind, sort_order) VALUES ('
                           f"{sql(lesson_id)}, {sql(unit_id)}, {sql(l_title)}, {sql(kind)}, {l_order}) ON CONFLICT (id) DO NOTHING;")
                for n, (i_kind, prompt, data, explanation, source) in enumerate(items_, 1):
                    out.append('INSERT INTO is_learn_items (id, lesson_id, type, prompt, data, explanation, source_ref, sort_order) VALUES ('
                               f"{sql(uid('item', f'{unit_key}:{l_key}:{n}'))}, {sql(lesson_id)}, {sql(i_kind)}, {sql(prompt)}, {sql(data)}, "
                               f"{sql(explanation)}, {sql(source)}, {n}) ON CONFLICT (id) DO NOTHING;")
    unit_ids = ', '.join(sql(uid('unit', u[0])) + '::uuid' for s in tree for u in s[4])
    sec_ids = ', '.join(sql(uid('section', f'{s[0]}:{s[1]}')) + '::uuid' for s in tree)
    out.append(f"""
COMMIT;

SELECT 'batch 2 sections' AS what, count(*) FROM is_learn_sections WHERE id IN ({sec_ids})
UNION ALL SELECT 'batch 2 units', count(*) FROM is_learn_units WHERE id IN ({unit_ids})
UNION ALL SELECT 'batch 2 units without a section (category missing?)', count(*) FROM is_learn_units WHERE id IN ({unit_ids}) AND section_id IS NULL
UNION ALL SELECT 'batch 2 lessons', count(*) FROM is_learn_lessons WHERE unit_id IN ({unit_ids})
UNION ALL SELECT 'batch 2 items', count(*) FROM is_learn_items i JOIN is_learn_lessons l ON l.id = i.lesson_id WHERE l.unit_id IN ({unit_ids})
UNION ALL SELECT 'batch 2 units waiting for review', count(*) FROM is_learn_units WHERE id IN ({unit_ids}) AND review_status = '{REVIEW_STATUS}';
""")
    return '\n'.join(out)


if __name__ == '__main__':
    check(SECTIONS)
    OUT.write_text(build(SECTIONS))
    units = sum(len(s[4]) for s in SECTIONS)
    lessons = sum(len(u[5]) for s in SECTIONS for u in s[4])
    items = list(items_of(SECTIONS))
    for cat, sec, title, _d, us in SECTIONS:
        print(f'  {cat} › {title["en"]}: ' + ', '.join(f'{u[1]["en"]} ({len(u[5])} lessons, {sum(len(lsn[3]) for lsn in u[5])} items)' for u in us))
    by_type = {}
    for _w, it in items:
        by_type[it[0]] = by_type.get(it[0], 0) + 1
    print(f'✔ {OUT.name}: {len(SECTIONS)} sections, {units} units, {lessons} lessons, {len(items)} items {by_type} ({OUT.stat().st_size // 1024} KB)')
