#!/usr/bin/env python3
"""
Writes islamic_studio_phase2.sql: starting content for Islamic Studio phase 2
(run after migration 077 and islamic_studio_content.sql):
  - Quran Audio reciters (EveryAyah.com, per-ayah MP3)
  - Hadith Library: the chapter list of the six books (from hadith-api's
    info.json) and their Arabic / Bangla / English packs (text fetched by the
    app, one chapter at a time)
  - Quizzes (60 questions) and a launch challenge
  - Zakat settings with guidance; Worship Tracker habits
  - switches the six phase-2 features on

Reviewed content (hadith packs, quizzes, zakat guidance) goes in as
'in_review': the app shows it only after approval in batools → Content Review.
Re-runnable: fixed ids / natural keys, nothing existing is overwritten.

    python3 islamic_studio_phase2.py   # downloads hadith-api's info.json (~10 MB) once
"""
import json
import urllib.request
import uuid
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / 'islamic_studio_phase2.sql'
NS = uuid.UUID('6f1c1b8e-6c2a-4d4e-9a57-1d2c3b4a5e60')
HADITH_API = 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1'
BOOKS = ['bukhari', 'muslim', 'abudawud', 'tirmidhi', 'nasai', 'ibnmajah']


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


def tr(en: str, bn: str) -> dict:
    return {'en': en, 'bn': bn}


def uid(kind: str, key: str) -> str:
    return str(uuid.uuid5(NS, f'{kind}:{key}'))


# --- Reciters (EveryAyah folder, name, style) ---------------------------------
RECITERS = [
    ('Alafasy_128kbps', tr('Mishary Rashid Alafasy', 'মিশারি রাশিদ আল-আফাসি'), 'murattal', True),
    ('Abdul_Basit_Murattal_192kbps', tr('Abdul Basit Abdus-Samad', 'আবদুল বাসিত আবদুস সামাদ'), 'murattal', False),
    ('Husary_128kbps', tr('Mahmoud Khalil Al-Husary', 'মাহমুদ খলিল আল-হুসারি'), 'murattal', False),
    ('Minshawy_Murattal_128kbps', tr('Mohamed Siddiq Al-Minshawi', 'মুহাম্মাদ সিদ্দিক আল-মিনশাবি'), 'murattal', False),
    ('Abdurrahmaan_As-Sudais_192kbps', tr('Abdur-Rahman As-Sudais', 'আবদুর রহমান আস-সুদাইস'), 'murattal', False),
    ('Saood_ash-Shuraym_128kbps', tr('Saud Ash-Shuraim', 'সাউদ আশ-শুরাইম'), 'murattal', False),
    ('MaherAlMuaiqly128kbps', tr('Maher Al-Muaiqly', 'মাহের আল-মুয়াইকলি'), 'murattal', False),
    ('Ghamadi_40kbps', tr('Saad Al-Ghamdi (low data)', 'সাদ আল-গামদি (কম ডেটা)'), 'murattal', False),
]

# --- Quizzes: (slug, title, topic, difficulty, seconds, [(question, [answers], correct index, explanation, source)]) ---
Q = tr
QUIZZES = [
    ('quran-basics', Q('Quran basics', 'কুরআনের মৌলিক তথ্য'), 'quran', 'easy', None, [
        (Q('How many surahs are in the Quran?', 'কুরআনে কয়টি সূরা আছে?'), [Q('110', '১১০'), Q('114', '১১৪'), Q('120', '১২০'), Q('99', '৯৯')], 1,
         Q('The Quran has 114 surahs, from al-Fatiha to an-Nas.', 'কুরআনে ১১৪টি সূরা আছে, আল-ফাতিহা থেকে আন-নাস পর্যন্ত।'), None),
        (Q('Which surah comes first in the Quran?', 'কুরআনের প্রথম সূরা কোনটি?'), [Q('Al-Baqarah', 'আল-বাকারা'), Q('Al-Ikhlas', 'আল-ইখলাস'), Q('Al-Fatiha', 'আল-ফাতিহা'), Q('An-Nas', 'আন-নাস')], 2,
         Q('Al-Fatiha, "the Opening", is the first surah and is recited in every rak‘ah.', 'আল-ফাতিহা প্রথম সূরা, যা প্রতি রাকাতে পড়া হয়।'), 'Quran 1'),
        (Q('Which is the longest surah?', 'সবচেয়ে বড় সূরা কোনটি?'), [Q('Al-Baqarah', 'আল-বাকারা'), Q('Al Imran', 'আলে ইমরান'), Q('An-Nisa', 'আন-নিসা'), Q('Yasin', 'ইয়াসিন')], 0,
         Q('Al-Baqarah has 286 ayahs.', 'আল-বাকারায় ২৮৬টি আয়াত আছে।'), 'Quran 2'),
        (Q('Which of these surahs has the fewest words?', 'নিচের কোন সূরায় সবচেয়ে কম শব্দ?'), [Q('Al-Fatiha', 'আল-ফাতিহা'), Q('Al-Kawthar', 'আল-কাওসার'), Q('Al-Ikhlas', 'আল-ইখলাস'), Q('Al-Mulk', 'আল-মুলক')], 1,
         Q('Al-Kawthar (108) has three short ayahs, about ten words.', 'আল-কাওসারে (১০৮) তিনটি ছোট আয়াত, প্রায় দশটি শব্দ।'), 'Quran 108'),
        (Q('In which month did the revelation of the Quran begin?', 'কোন মাসে কুরআন নাজিল শুরু হয়?'), [Q('Rajab', 'রজব'), Q('Sha‘ban', 'শাবান'), Q('Ramadan', 'রমজান'), Q('Muharram', 'মহররম')], 2,
         Q('"The month of Ramadan, in which the Quran was revealed…"', '"রমজান মাস, যে মাসে কুরআন নাজিল হয়েছে…"'), 'Quran 2:185'),
        (Q('Which surah does not begin with Bismillah?', 'কোন সূরা বিসমিল্লাহ দিয়ে শুরু হয় না?'), [Q('At-Tawbah', 'আত-তাওবা'), Q('Al-Anfal', 'আল-আনফাল'), Q('Al-Kahf', 'আল-কাহফ'), Q('Yunus', 'ইউনুস')], 0,
         Q('At-Tawbah (9) is the only surah without Bismillah at its start.', 'আত-তাওবা (৯) একমাত্র সূরা যার শুরুতে বিসমিল্লাহ নেই।'), 'Quran 9'),
        (Q('The first words revealed came from which surah?', 'প্রথম নাজিলকৃত আয়াত কোন সূরার?'), [Q('Al-Fatiha', 'আল-ফাতিহা'), Q('Al-Muddaththir', 'আল-মুদ্দাসসির'), Q('Al-‘Alaq', 'আল-আলাক'), Q('Al-Qadr', 'আল-কদর')], 2,
         Q('"Read in the name of your Lord who created" (al-‘Alaq 96:1–5) was revealed first, in the cave of Hira.', '"পড়ুন আপনার রবের নামে যিনি সৃষ্টি করেছেন" (আল-আলাক ৯৬:১–৫) প্রথম নাজিল হয়, হেরা গুহায়।'), 'Sahih al-Bukhari 3'),
        (Q('Into how many juz (para) is the Quran divided?', 'কুরআন কয়টি পারায় বিভক্ত?'), [Q('20', '২০'), Q('30', '৩০'), Q('40', '৪০'), Q('60', '৬০')], 1,
         Q('There are 30 juz, which is why many read one juz a day in Ramadan.', '৩০ পারা, তাই অনেকে রমজানে প্রতিদিন এক পারা পড়েন।'), None),
        (Q('Which angel brought the revelation to the Prophet ﷺ?', 'কোন ফেরেশতা নবী ﷺ-এর কাছে ওহি নিয়ে আসতেন?'), [Q('Mika‘il', 'মিকাইল'), Q('Jibril', 'জিবরাইল'), Q('Israfil', 'ইসরাফিল'), Q('Malik', 'মালিক')], 1,
         Q('Jibril brought the Quran down to the heart of the Prophet ﷺ.', 'জিবরাইল (আ.) কুরআন নবী ﷺ-এর অন্তরে নাজিল করেছেন।'), 'Quran 2:97'),
        (Q('Ayat al-Kursi is in which surah?', 'আয়াতুল কুরসি কোন সূরায়?'), [Q('Al-Baqarah', 'আল-বাকারা'), Q('Al Imran', 'আলে ইমরান'), Q('Al-Ma’idah', 'আল-মায়িদা'), Q('Yasin', 'ইয়াসিন')], 0,
         Q('Ayat al-Kursi is ayah 255 of al-Baqarah.', 'আয়াতুল কুরসি সূরা বাকারার ২৫৫ নম্বর আয়াত।'), 'Quran 2:255'),
    ]),
    ('prophets', Q('Prophets of Allah', 'আল্লাহর নবী-রাসুলগণ'), 'prophets', 'easy', None, [
        (Q('Who was the first prophet?', 'প্রথম নবী কে?'), [Q('Nuh', 'নুহ'), Q('Adam', 'আদম'), Q('Ibrahim', 'ইবরাহিম'), Q('Idris', 'ইদরিস')], 1,
         Q('Adam (peace be upon him) was the first human and the first prophet.', 'আদম (আ.) প্রথম মানুষ ও প্রথম নবী।'), None),
        (Q('Which prophet raised the foundations of the Ka‘bah with his son?', 'কোন নবী ছেলের সাথে কাবার ভিত্তি তুলেছিলেন?'), [Q('Ibrahim', 'ইবরাহিম'), Q('Musa', 'মুসা'), Q('Dawud', 'দাউদ'), Q('Sulayman', 'সুলাইমান')], 0,
         Q('Ibrahim and Isma‘il raised the foundations of the House.', 'ইবরাহিম ও ইসমাইল (আ.) কাবার ভিত্তি তুলেছিলেন।'), 'Quran 2:127'),
        (Q('Which prophet was swallowed by a great fish?', 'কোন নবীকে বড় মাছ গিলে ফেলেছিল?'), [Q('Yusuf', 'ইউসুফ'), Q('Ayyub', 'আইয়ুব'), Q('Yunus', 'ইউনুস'), Q('Ilyas', 'ইলিয়াস')], 2,
         Q('Yunus called out from the darkness: "There is no god but You…"', 'ইউনুস (আ.) অন্ধকার থেকে ডেকেছিলেন: "আপনি ছাড়া কোনো উপাস্য নেই…"'), 'Quran 37:139–144; 21:87'),
        (Q('Allah spoke directly to which prophet?', 'আল্লাহ কোন নবীর সাথে সরাসরি কথা বলেছেন?'), [Q('Musa', 'মুসা'), Q('Isa', 'ঈসা'), Q('Harun', 'হারুন'), Q('Shu‘ayb', 'শুআইব')], 0,
         Q('"And Allah spoke to Musa directly."', '"আর আল্লাহ মুসার সাথে সরাসরি কথা বলেছেন।"'), 'Quran 4:164'),
        (Q('Which prophet built the Ark?', 'কোন নবী নৌকা (কিশতি) তৈরি করেছিলেন?'), [Q('Hud', 'হুদ'), Q('Salih', 'সালিহ'), Q('Nuh', 'নুহ'), Q('Lut', 'লুত')], 2,
         Q('Nuh built the Ark by Allah’s command before the flood.', 'প্লাবনের আগে আল্লাহর আদেশে নুহ (আ.) নৌকা তৈরি করেন।'), 'Quran 11:37'),
        (Q('Which prophet was given the Zabur (Psalms)?', 'কোন নবীকে যাবুর দেওয়া হয়েছিল?'), [Q('Dawud', 'দাউদ'), Q('Musa', 'মুসা'), Q('Isa', 'ঈসা'), Q('Zakariyya', 'যাকারিয়া')], 0,
         Q('"…and to Dawud We gave the Zabur."', '"…আর দাউদকে আমি যাবুর দিয়েছি।"'), 'Quran 4:163'),
        (Q('Who is the final prophet?', 'শেষ নবী কে?'), [Q('Isa', 'ঈসা'), Q('Muhammad ﷺ', 'মুহাম্মাদ ﷺ'), Q('Yahya', 'ইয়াহইয়া'), Q('Ibrahim', 'ইবরাহিম')], 1,
         Q('Muhammad ﷺ is the Messenger of Allah and the Seal of the Prophets.', 'মুহাম্মাদ ﷺ আল্লাহর রাসুল ও শেষ নবী।'), 'Quran 33:40'),
        (Q('Who was the mother of Prophet Isa?', 'ঈসা (আ.)-এর মা কে ছিলেন?'), [Q('Asiya', 'আসিয়া'), Q('Hajar', 'হাজেরা'), Q('Maryam', 'মারইয়াম'), Q('Sarah', 'সারা')], 2,
         Q('Maryam, honoured with a surah named after her (Quran 19).', 'মারইয়াম (আ.), তাঁর নামে একটি সূরা আছে (সূরা ১৯)।'), 'Quran 19'),
        (Q('Which prophet is known for his patience through long illness?', 'দীর্ঘ অসুস্থতায় ধৈর্যের জন্য কোন নবী প্রসিদ্ধ?'), [Q('Ayyub', 'আইয়ুব'), Q('Yaqub', 'ইয়াকুব'), Q('Musa', 'মুসা'), Q('Hud', 'হুদ')], 0,
         Q('"Indeed We found him patient; an excellent servant."', '"নিশ্চয়ই আমি তাকে ধৈর্যশীল পেয়েছি; কত উত্তম বান্দা!"'), 'Quran 38:44'),
        (Q('Which prophet dreamt of eleven stars, the sun and the moon?', 'কোন নবী এগারোটি তারা, সূর্য ও চাঁদের স্বপ্ন দেখেছিলেন?'), [Q('Yusuf', 'ইউসুফ'), Q('Sulayman', 'সুলাইমান'), Q('Ismail', 'ইসমাইল'), Q('Yunus', 'ইউনুস')], 0,
         Q('Yusuf told his father of the dream as a boy.', 'শৈশবে ইউসুফ (আ.) বাবাকে এই স্বপ্নের কথা বলেছিলেন।'), 'Quran 12:4'),
    ]),
    ('pillars-and-salah', Q('Pillars of Islam & Salah', 'ইসলামের স্তম্ভ ও নামাজ'), 'pillars', 'easy', None, [
        (Q('How many pillars of Islam are there?', 'ইসলামের স্তম্ভ কয়টি?'), [Q('3', '৩'), Q('4', '৪'), Q('5', '৫'), Q('6', '৬')], 2,
         Q('Islam is built on five: the shahadah, salah, zakat, Hajj and fasting Ramadan.', 'ইসলাম পাঁচটির ওপর প্রতিষ্ঠিত: শাহাদাহ, নামাজ, যাকাত, হজ ও রমজানের রোজা।'), 'Sahih al-Bukhari 8'),
        (Q('What is the first pillar?', 'প্রথম স্তম্ভ কোনটি?'), [Q('Salah', 'নামাজ'), Q('The shahadah', 'শাহাদাহ (কালেমা)'), Q('Zakat', 'যাকাত'), Q('Hajj', 'হজ')], 1,
         Q('Bearing witness that there is no god but Allah and that Muhammad is His Messenger.', 'সাক্ষ্য দেওয়া যে আল্লাহ ছাড়া কোনো উপাস্য নেই এবং মুহাম্মাদ ﷺ তাঁর রাসুল।'), 'Sahih al-Bukhari 8'),
        (Q('How many obligatory prayers are there each day?', 'প্রতিদিন কয় ওয়াক্ত নামাজ ফরজ?'), [Q('3', '৩'), Q('5', '৫'), Q('7', '৭'), Q('2', '২')], 1,
         Q('Fajr, Dhuhr, Asr, Maghrib and Isha.', 'ফজর, যোহর, আসর, মাগরিব ও ইশা।'), 'Sahih al-Bukhari 349'),
        (Q('How many fard rak‘ahs does Fajr have?', 'ফজরের ফরজ কত রাকাত?'), [Q('2', '২'), Q('3', '৩'), Q('4', '৪'), Q('1', '১')], 0,
         Q('Fajr has two fard rak‘ahs.', 'ফজরের ফরজ দুই রাকাত।'), None),
        (Q('How many fard rak‘ahs does Maghrib have?', 'মাগরিবের ফরজ কত রাকাত?'), [Q('2', '২'), Q('3', '৩'), Q('4', '৪'), Q('5', '৫')], 1,
         Q('Maghrib is the only fard prayer with three rak‘ahs.', 'মাগরিবই একমাত্র ফরজ নামাজ যা তিন রাকাত।'), None),
        (Q('What share of savings is given as zakat each lunar year?', 'প্রতি চান্দ্র বছরে সঞ্চয়ের কত অংশ যাকাত দিতে হয়?'), [Q('1%', '১%'), Q('2.5%', '২.৫%'), Q('5%', '৫%'), Q('10%', '১০%')], 1,
         Q('One fortieth (2.5%) of money and trade goods above the nisab.', 'নিসাবের ওপরে থাকা টাকা ও ব্যবসায়িক পণ্যের চল্লিশ ভাগের এক ভাগ (২.৫%)।'), None),
        (Q('Fasting is obligatory in which month?', 'কোন মাসে রোজা ফরজ?'), [Q('Sha‘ban', 'শাবান'), Q('Ramadan', 'রমজান'), Q('Shawwal', 'শাওয়াল'), Q('Dhul Hijjah', 'জিলহজ')], 1,
         Q('"O you who believe, fasting is prescribed for you…"', '"হে মুমিনগণ, তোমাদের ওপর রোজা ফরজ করা হয়েছে…"'), 'Quran 2:183–185'),
        (Q('For someone able, how often is Hajj obligatory?', 'সামর্থ্যবানের জন্য হজ কতবার ফরজ?'), [Q('Every year', 'প্রতি বছর'), Q('Once in a lifetime', 'জীবনে একবার'), Q('Every five years', 'প্রতি পাঁচ বছরে'), Q('Three times', 'তিনবার')], 1,
         Q('The Prophet ﷺ said that had he said "every year", it would have become obligatory; it is once.', 'নবী ﷺ বলেছেন, "প্রতি বছর" বললে তা ফরজ হয়ে যেত; হজ জীবনে একবার ফরজ।'), 'Sahih Muslim 1337'),
        (Q('Muslims face which direction in prayer?', 'নামাজে মুসলমানরা কোন দিকে মুখ করেন?'), [Q('Jerusalem', 'জেরুজালেম'), Q('The Ka‘bah in Makkah', 'মক্কার কাবা'), Q('Madinah', 'মদিনা'), Q('East', 'পূর্ব দিক')], 1,
         Q('"So turn your face towards al-Masjid al-Haram."', '"সুতরাং আপনার মুখ মসজিদুল হারামের দিকে ফেরান।"'), 'Quran 2:144'),
        (Q('Which prayer replaces Dhuhr on Friday?', 'শুক্রবার যোহরের পরিবর্তে কোন নামাজ?'), [Q('Jumu‘ah', 'জুমা'), Q('Eid', 'ঈদ'), Q('Duha', 'দুহা'), Q('Tahajjud', 'তাহাজ্জুদ')], 0,
         Q('The Friday prayer, with its khutbah.', 'খুতবাসহ জুমার নামাজ।'), 'Quran 62:9'),
    ]),
    ('seerah', Q('Life of the Prophet ﷺ', 'নবীজির ﷺ জীবনী'), 'seerah', 'medium', 600, [
        (Q('In which city was the Prophet ﷺ born?', 'নবী ﷺ কোন শহরে জন্মগ্রহণ করেন?'), [Q('Madinah', 'মদিনা'), Q('Makkah', 'মক্কা'), Q('Ta’if', 'তায়েফ'), Q('Jerusalem', 'জেরুজালেম')], 1,
         Q('He ﷺ was born in Makkah.', 'তিনি ﷺ মক্কায় জন্মগ্রহণ করেন।'), None),
        (Q('He ﷺ was born in the "Year of the…"?', 'তিনি ﷺ জন্মগ্রহণ করেন কোন "বছরে"?'), [Q('Flood', 'প্লাবনের'), Q('Elephant', 'হাতির'), Q('Famine', 'দুর্ভিক্ষের'), Q('Treaty', 'চুক্তির')], 1,
         Q('The year Abraha’s army with elephants came to destroy the Ka‘bah (see surah al-Fil).', 'যে বছর আবরাহার হস্তীবাহিনী কাবা ধ্বংস করতে এসেছিল (সূরা আল-ফিল)।'), 'Quran 105'),
        (Q('What was the name of his mother?', 'তাঁর মায়ের নাম কী ছিল?'), [Q('Halimah', 'হালিমা'), Q('Aminah', 'আমিনা'), Q('Khadijah', 'খাদিজা'), Q('Fatimah', 'ফাতিমা')], 1,
         Q('Aminah bint Wahb.', 'আমিনা বিনতে ওয়াহাব।'), None),
        (Q('Who was his first wife?', 'তাঁর প্রথম স্ত্রী কে ছিলেন?'), [Q('‘A’ishah', 'আয়েশা'), Q('Khadijah', 'খাদিজা'), Q('Hafsah', 'হাফসা'), Q('Sawdah', 'সাওদা')], 1,
         Q('Khadijah bint Khuwaylid, the first to believe in him.', 'খাদিজা বিনতে খুয়াইলিদ, যিনি সবার আগে তাঁর প্রতি ঈমান আনেন।'), 'Sahih al-Bukhari 3'),
        (Q('Where did the first revelation come to him?', 'প্রথম ওহি কোথায় এসেছিল?'), [Q('Cave of Thawr', 'সাওর গুহা'), Q('Cave of Hira', 'হেরা গুহা'), Q('Mount Uhud', 'উহুদ পাহাড়'), Q('The Ka‘bah', 'কাবা')], 1,
         Q('He ﷺ used to worship in the cave of Hira, where Jibril came to him.', 'তিনি ﷺ হেরা গুহায় ইবাদত করতেন; সেখানেই জিবরাইল আসেন।'), 'Sahih al-Bukhari 3'),
        (Q('To which city did the Prophet ﷺ make Hijrah?', 'নবী ﷺ কোন শহরে হিজরত করেন?'), [Q('Ta’if', 'তায়েফ'), Q('Madinah', 'মদিনা'), Q('Abyssinia', 'হাবশা'), Q('Damascus', 'দামেস্ক')], 1,
         Q('Yathrib, which became al-Madinah.', 'ইয়াসরিব, যা পরে মদিনা নামে পরিচিত হয়।'), None),
        (Q('Who was with him in the cave during the Hijrah?', 'হিজরতের সময় গুহায় তাঁর সাথে কে ছিলেন?'), [Q('‘Umar', 'উমর'), Q('‘Ali', 'আলী'), Q('Abu Bakr', 'আবু বকর'), Q('‘Uthman', 'উসমান')], 2,
         Q('"…the second of two, when they were in the cave…"', '"…দুজনের দ্বিতীয়জন, যখন তারা গুহায় ছিলেন…"'), 'Quran 9:40'),
        (Q('What was the first major battle of Islam?', 'ইসলামের প্রথম বড় যুদ্ধ কোনটি?'), [Q('Uhud', 'উহুদ'), Q('Badr', 'বদর'), Q('The Trench', 'খন্দক'), Q('Hunayn', 'হুনাইন')], 1,
         Q('Badr, in Ramadan of 2 AH.', 'বদর, হিজরি দ্বিতীয় সনের রমজানে।'), 'Quran 3:123'),
        (Q('In which year after the Hijrah was Makkah conquered?', 'হিজরতের কত বছর পর মক্কা বিজয় হয়?'), [Q('2 AH', 'হিজরি ২'), Q('5 AH', 'হিজরি ৫'), Q('8 AH', 'হিজরি ৮'), Q('10 AH', 'হিজরি ১০')], 2,
         Q('Makkah was opened in Ramadan, 8 AH.', 'হিজরি ৮ সনের রমজানে মক্কা বিজয় হয়।'), None),
        (Q('Where is the Prophet ﷺ buried?', 'নবী ﷺ কোথায় সমাহিত?'), [Q('Makkah', 'মক্কা'), Q('Madinah', 'মদিনা'), Q('Jerusalem', 'জেরুজালেম'), Q('Ta’if', 'তায়েফ')], 1,
         Q('In Madinah, in what is now part of his masjid.', 'মদিনায়, যা এখন তাঁর মসজিদের অংশ।'), None),
    ]),
    ('ramadan', Q('Ramadan', 'রমজান'), 'ramadan', 'easy', None, [
        (Q('Laylat al-Qadr is better than how many months?', 'লাইলাতুল কদর কত মাসের চেয়ে উত্তম?'), [Q('100', '১০০'), Q('1,000', '১,০০০'), Q('70', '৭০'), Q('12', '১২')], 1,
         Q('"The Night of Decree is better than a thousand months."', '"কদরের রাত হাজার মাসের চেয়ে উত্তম।"'), 'Quran 97:3'),
        (Q('What is the pre-dawn meal before fasting called?', 'রোজার আগে ভোররাতের খাবারকে কী বলে?'), [Q('Iftar', 'ইফতার'), Q('Suhur (Sehri)', 'সেহরি'), Q('Walimah', 'ওয়ালিমা'), Q('‘Aqiqah', 'আকিকা')], 1,
         Q('"Take suhur, for in suhur there is blessing."', '"সেহরি খাও, কারণ সেহরিতে বরকত আছে।"'), 'Sahih al-Bukhari 1923'),
        (Q('When should Zakat al-Fitr be given?', 'সদকাতুল ফিতর কখন দিতে হয়?'), [Q('After Eid prayer', 'ঈদের নামাজের পর'), Q('Before the Eid prayer', 'ঈদের নামাজের আগে'), Q('In Muharram', 'মহররমে'), Q('Any time in the year', 'বছরের যেকোনো সময়')], 1,
         Q('The Prophet ﷺ ordered it to be given before people go out to the prayer.', 'নবী ﷺ নামাজে বের হওয়ার আগেই তা আদায়ের নির্দেশ দিয়েছেন।'), 'Sahih al-Bukhari 1503'),
        (Q('What is the night prayer of Ramadan commonly called?', 'রমজানের রাতের বিশেষ নামাজকে কী বলে?'), [Q('Tarawih', 'তারাবিহ'), Q('Duha', 'দুহা'), Q('Ishraq', 'ইশরাক'), Q('Istikharah', 'ইস্তিখারা')], 0,
         Q('Tarawih: whoever stands in Ramadan with faith and hoping for reward is forgiven his past sins.', 'তারাবিহ: ঈমান ও সওয়াবের আশায় রমজানে রাত জেগে নামাজ পড়লে আগের গুনাহ মাফ হয়।'), 'Sahih al-Bukhari 37'),
        (Q('Which surah is about Laylat al-Qadr?', 'কোন সূরা লাইলাতুল কদর সম্পর্কে?'), [Q('Al-Qadr', 'আল-কদর'), Q('Al-Fajr', 'আল-ফাজর'), Q('Al-Layl', 'আল-লাইল'), Q('Ad-Duha', 'আদ-দুহা')], 0,
         Q('Surah al-Qadr (97).', 'সূরা আল-কদর (৯৭)।'), 'Quran 97'),
        (Q('What is the Eid at the end of Ramadan called?', 'রমজানের শেষে যে ঈদ, তার নাম কী?'), [Q('Eid al-Adha', 'ঈদুল আযহা'), Q('Eid al-Fitr', 'ঈদুল ফিতর'), Q('Mawlid', 'মিলাদ'), Q('Ashura', 'আশুরা')], 1,
         Q('Eid al-Fitr, on 1 Shawwal.', 'ঈদুল ফিতর, ১ শাওয়াল।'), None),
        (Q('In which nights should Laylat al-Qadr be sought?', 'লাইলাতুল কদর কোন রাতগুলোতে খুঁজতে বলা হয়েছে?'), [Q('The first ten nights', 'প্রথম দশ রাত'), Q('The odd nights of the last ten', 'শেষ দশকের বেজোড় রাত'), Q('Only the 15th night', 'শুধু ১৫তম রাত'), Q('Any night of the year', 'বছরের যেকোনো রাত')], 1,
         Q('"Seek it in the odd nights of the last ten of Ramadan."', '"রমজানের শেষ দশকের বেজোড় রাতগুলোতে তা খোঁজো।"'), 'Sahih al-Bukhari 2017'),
        (Q('With what did the Prophet ﷺ prefer to break his fast?', 'নবী ﷺ কী দিয়ে ইফতার করতে পছন্দ করতেন?'), [Q('Fresh or dry dates', 'তাজা বা শুকনো খেজুর'), Q('Milk', 'দুধ'), Q('Bread', 'রুটি'), Q('Honey', 'মধু')], 0,
         Q('Fresh dates, else dry dates, else a few sips of water.', 'তাজা খেজুর, না থাকলে শুকনো খেজুর, তাও না থাকলে কয়েক চুমুক পানি।'), 'Sunan Abi Dawud 2356'),
        (Q('Six voluntary fasts after Ramadan are kept in which month?', 'রমজানের পর ছয়টি নফল রোজা কোন মাসে?'), [Q('Shawwal', 'শাওয়াল'), Q('Muharram', 'মহররম'), Q('Rajab', 'রজব'), Q('Dhul Qa‘dah', 'জিলকদ')], 0,
         Q('Ramadan followed by six of Shawwal is like fasting the whole year.', 'রমজানের পর শাওয়ালের ছয় রোজা সারা বছর রোজা রাখার মতো।'), 'Sahih Muslim 1164'),
        (Q('Which ayah says "Fasting is prescribed for you"?', 'কোন আয়াতে বলা হয়েছে "তোমাদের ওপর রোজা ফরজ করা হয়েছে"?'), [Q('2:183', '২:১৮৩'), Q('3:97', '৩:৯৭'), Q('9:60', '৯:৬০'), Q('97:1', '৯৭:১')], 0,
         Q('Al-Baqarah 2:183, "…so that you may attain taqwa."', 'আল-বাকারা ২:১৮৩, "…যাতে তোমরা তাকওয়া অর্জন করতে পারো।"'), 'Quran 2:183'),
    ]),
    ('islamic-history', Q('Islamic history', 'ইসলামের ইতিহাস'), 'history', 'medium', 600, [
        (Q('Who was the first caliph after the Prophet ﷺ?', 'নবী ﷺ-এর পর প্রথম খলিফা কে?'), [Q('‘Umar', 'উমর'), Q('Abu Bakr', 'আবু বকর'), Q('‘Uthman', 'উসমান'), Q('‘Ali', 'আলী')], 1,
         Q('Abu Bakr as-Siddiq.', 'আবু বকর সিদ্দিক (রা.)।'), None),
        (Q('Who was the second caliph?', 'দ্বিতীয় খলিফা কে?'), [Q('‘Umar ibn al-Khattab', 'উমর ইবনুল খাত্তাব'), Q('‘Ali', 'আলী'), Q('Mu‘awiyah', 'মুয়াবিয়া'), Q('‘Uthman', 'উসমান')], 0,
         Q('‘Umar ibn al-Khattab.', 'উমর ইবনুল খাত্তাব (রা.)।'), None),
        (Q('The Islamic (Hijri) calendar counts its years from which event?', 'হিজরি সন কোন ঘটনা থেকে গণনা শুরু হয়?'), [Q('The Prophet’s birth', 'নবীজির জন্ম'), Q('The first revelation', 'প্রথম ওহি'), Q('The Hijrah to Madinah', 'মদিনায় হিজরত'), Q('The conquest of Makkah', 'মক্কা বিজয়')], 2,
         Q('Year 1 AH is the year of the Hijrah.', 'হিজরতের বছরই হিজরি ১ সন।'), None),
        (Q('Before the Ka‘bah, Muslims prayed towards…?', 'কাবার আগে মুসলমানরা কোন দিকে নামাজ পড়তেন?'), [Q('Bayt al-Maqdis (Jerusalem)', 'বায়তুল মাকদিস (জেরুজালেম)'), Q('Madinah', 'মদিনা'), Q('Ta’if', 'তায়েফ'), Q('Yemen', 'ইয়েমেন')], 0,
         Q('The qiblah was changed from Bayt al-Maqdis to the Ka‘bah.', 'কিবলা বায়তুল মাকদিস থেকে কাবার দিকে পরিবর্তন করা হয়।'), 'Quran 2:142–144; Sahih al-Bukhari 40'),
        (Q('Which caliph sent standard copies of the Quran to the major cities?', 'কোন খলিফা কুরআনের প্রমিত কপি প্রধান শহরগুলোতে পাঠিয়েছিলেন?'), [Q('Abu Bakr', 'আবু বকর'), Q('‘Uthman', 'উসমান'), Q('‘Umar', 'উমর'), Q('‘Ali', 'আলী')], 1,
         Q('‘Uthman had copies made and sent to each region.', 'উসমান (রা.) কপি তৈরি করে প্রতিটি অঞ্চলে পাঠান।'), 'Sahih al-Bukhari 4987'),
        (Q('Masjid al-Aqsa is in which city?', 'মসজিদুল আকসা কোন শহরে?'), [Q('Damascus', 'দামেস্ক'), Q('Jerusalem', 'জেরুজালেম'), Q('Cairo', 'কায়রো'), Q('Baghdad', 'বাগদাদ')], 1,
         Q('Al-Aqsa is in Jerusalem (al-Quds).', 'আল-আকসা জেরুজালেমে (আল-কুদস)।'), 'Quran 17:1'),
        (Q('What is the night journey from Makkah to Jerusalem and the ascent called?', 'মক্কা থেকে জেরুজালেম রাতের সফর ও ঊর্ধ্বগমনকে কী বলে?'), [Q('Hijrah', 'হিজরত'), Q('Isra and Mi‘raj', 'ইসরা ও মিরাজ'), Q('Badr', 'বদর'), Q('Hudaybiyyah', 'হুদাইবিয়া')], 1,
         Q('"Glory be to Him who took His servant by night…"', '"পবিত্র তিনি, যিনি তাঁর বান্দাকে রাতে ভ্রমণ করিয়েছেন…"'), 'Quran 17:1'),
        (Q('The well of Zamzam is in…?', 'যমযম কূপ কোথায়?'), [Q('Madinah', 'মদিনা'), Q('Makkah', 'মক্কা'), Q('Jerusalem', 'জেরুজালেম'), Q('Ta’if', 'তায়েফ')], 1,
         Q('Zamzam is inside al-Masjid al-Haram in Makkah.', 'যমযম মক্কার মসজিদুল হারামের ভেতরে।'), None),
        (Q('Hajj takes place in which Hijri month?', 'কোন হিজরি মাসে হজ হয়?'), [Q('Ramadan', 'রমজান'), Q('Muharram', 'মহররম'), Q('Dhul Hijjah', 'জিলহজ'), Q('Rajab', 'রজব')], 2,
         Q('The days of Hajj are 8–13 Dhul Hijjah.', 'হজের দিন ৮–১৩ জিলহজ।'), None),
        (Q('Who compiled the hadith book "Sahih al-Bukhari"?', '"সহিহ বুখারি" কে সংকলন করেন?'), [Q('Imam Muslim', 'ইমাম মুসলিম'), Q('Imam al-Bukhari', 'ইমাম বুখারি'), Q('Imam Malik', 'ইমাম মালিক'), Q('Imam Ahmad', 'ইমাম আহমাদ')], 1,
         Q('Muhammad ibn Isma‘il al-Bukhari.', 'মুহাম্মাদ ইবনে ইসমাইল আল-বুখারি।'), None),
    ]),
]

HABITS = [
    ('salah5', tr('Five daily prayers', 'পাঁচ ওয়াক্ত নামাজ'), tr('Tick each prayer when prayed.', 'প্রতি ওয়াক্ত নামাজ পড়ে টিক দিন।'), 'salah', tr('prayers', 'ওয়াক্ত'), 5, 'daily', True, 'clock', 1),
    ('quran_pages', tr('Read Quran', 'কুরআন তিলাওয়াত'), {}, 'quran', tr('pages', 'পৃষ্ঠা'), 2, 'daily', True, 'book-open', 2),
    ('morning_adhkar', tr('Morning adhkar', 'সকালের যিকির'), {}, 'dhikr', tr('time', 'বার'), 1, 'daily', True, 'sparkles', 3),
    ('evening_adhkar', tr('Evening adhkar', 'সন্ধ্যার যিকির'), {}, 'dhikr', tr('time', 'বার'), 1, 'daily', True, 'moon', 4),
    ('witr', tr('Witr prayer', 'বিতর নামাজ'), {}, 'other', tr('time', 'বার'), 1, 'daily', True, 'moon', 5),
    ('istighfar', tr('Istighfar', 'ইস্তিগফার'), tr('Astaghfirullah', 'আস্তাগফিরুল্লাহ'), 'dhikr', tr('times', 'বার'), 100, 'daily', False, 'sparkles', 6),
    ('salawat', tr('Salawat on the Prophet ﷺ', 'নবীজির ﷺ ওপর দরুদ'), {}, 'dhikr', tr('times', 'বার'), 10, 'daily', False, 'sparkles', 7),
    ('duha', tr('Duha prayer', 'দুহা নামাজ'), {}, 'other', tr('time', 'বার'), 1, 'daily', False, 'clock', 8),
    ('tahajjud', tr('Tahajjud', 'তাহাজ্জুদ'), {}, 'other', tr('time', 'বার'), 1, 'daily', False, 'moon', 9),
    ('learning', tr('Islamic learning', 'ইসলামি জ্ঞানার্জন'), {}, 'learning', tr('minutes', 'মিনিট'), 10, 'daily', False, 'graduation-cap', 10),
    ('fast_mon_thu', tr('Monday & Thursday fasts', 'সোম ও বৃহস্পতিবারের রোজা'), {}, 'fasting', tr('fasts', 'রোজা'), 2, 'weekly', False, 'moon', 11),
    ('charity', tr('Charity', 'দান-সদকা'), {}, 'charity', tr('times', 'বার'), 1, 'weekly', False, 'hand-heart', 12),
]

ZAKAT_GUIDANCE = tr(
    """Zakat is 2.5% of zakatable wealth that has stayed at or above the nisab for one full lunar year.

Counts: cash, bank balances, gold and silver, goods held for sale (at today’s selling value), money owed to you that you expect to receive, and shares or investments held for trade.
Does not count: your home, car, furniture, clothes and tools you use for work.
Deduct debts that are due now.

Scholars differ on gold and silver jewellery worn regularly (the Hanafi school counts it), and on whether to use the gold or the silver nisab; the silver nisab is lower and so benefits more of the poor. When unsure, ask a scholar you trust.""",
    """যাকাতযোগ্য সম্পদ পূর্ণ এক চান্দ্র বছর নিসাব বা তার বেশি থাকলে তার ২.৫% যাকাত দিতে হয়।

যা হিসাবে আসবে: নগদ টাকা, ব্যাংকে জমা, স্বর্ণ ও রুপা, বিক্রির জন্য রাখা পণ্য (আজকের বিক্রয়মূল্যে), পাওনা টাকা যা পাওয়ার আশা আছে, এবং ব্যবসার উদ্দেশ্যে রাখা শেয়ার বা বিনিয়োগ।
যা আসবে না: বসবাসের বাড়ি, গাড়ি, আসবাব, পোশাক ও কাজের যন্ত্রপাতি।
এখনই পরিশোধযোগ্য ঋণ বাদ দিন।

নিয়মিত পরিধেয় স্বর্ণ-রুপার গয়না (হানাফি মাজহাবে তা হিসাবে আসে) এবং স্বর্ণ না রুপার নিসাব ধরা হবে, তা নিয়ে আলেমদের মতভেদ আছে; রুপার নিসাব কম, তাই এতে বেশি গরিব উপকৃত হয়। সন্দেহ হলে আস্থাভাজন আলেমের পরামর্শ নিন।""")

FEATURES = ['quran_audio', 'hadith', 'zakat', 'ramadan', 'habits', 'quiz']
HADITH_LICENSE = 'hadith-api by fawazahmed0 (Unlicense), served by jsDelivr. Check the translation’s rights before approving.'
PACK_LANGS = [('ara', 'ar', 'Arabic', 'আরবি'), ('ben', 'bn', 'Bangla', 'বাংলা'), ('eng', 'en', 'English', 'ইংরেজি')]


def build(info: dict) -> str:
    out = ["""-- Islamic Studio phase 2 starting content. Generated by islamic_studio_phase2.py; edit that, not this.
-- Run in the Supabase SQL editor after 077_is_phase2.sql and islamic_studio_content.sql.
-- Safe to run again: nothing existing is overwritten or deleted.
-- Hadith packs, quizzes and the zakat guidance go in as 'in_review': approve them
-- in batools → Islamic Studio → Content Review before the app shows them.

BEGIN;
"""]
    out.append('-- Quran Audio reciters (EveryAyah.com, one MP3 per ayah)')
    for i, (folder, name, style, default) in enumerate(RECITERS, 1):
        out.append(
            'INSERT INTO is_reciters (id, name, style, audio_url_template, license, is_default, sort_order) VALUES ('
            f"{sql(uid('reciter', folder))}, {sql(name)}, {sql(style)}, {sql(f'https://everyayah.com/data/{folder}/' + '{surah3}{ayah3}.mp3')}, "
            f"{sql('Streamed from EveryAyah.com; check its terms before release.')}, {sql(default)}, {i}) ON CONFLICT (id) DO NOTHING;")

    out.append('\n-- Hadith books: chapters (from hadith-api info.json)')
    for book in BOOKS:
        meta = info[book]['metadata']
        details = meta['section_details']
        rows = []
        for number, name in sorted(meta['sections'].items(), key=lambda kv: int(kv[0])):
            d = details.get(number, {})
            first, last = d.get('hadithnumber_first', 0), d.get('hadithnumber_last', 0)
            if int(number) == 0 or not name.strip() or not first or last < first:
                continue
            rows.append(f"({int(number)}, {sql({'en': name.strip()})}, {int(first)}, {int(last)})")
        out.append(
            'INSERT INTO is_hadith_sections (collection_id, number, name, hadith_first, hadith_last) '
            f"SELECT c.id, v.number, v.name::jsonb, v.first, v.last FROM is_hadith_collections c, (VALUES\n  " + ',\n  '.join(rows)
            + f"\n) AS v(number, name, first, last) WHERE c.slug = {sql(book)} ON CONFLICT DO NOTHING;")
        count = int(meta.get('last_hadithnumber') or 0)
        if count:
            out.append(f"UPDATE is_hadith_collections SET hadith_count = {count} WHERE slug = {sql(book)} AND hadith_count IS NULL;")

    out.append('\n-- Hadith packs: Arabic, Bangla and English per book (the app fetches one chapter at a time)')
    for i, book in enumerate(BOOKS):
        name = info[book]['metadata']['name']
        for j, (code, lang, en, bn) in enumerate(PACK_LANGS):
            edition = f'{code}-{book}'
            out.append(
                'INSERT INTO is_content_packs (id, kind, slug, language, name, author, source_url, license, file_url, api_edition, hadith_collection_id, is_default, review_status, sort_order) '
                f"SELECT {sql(uid('pack', edition))}, 'hadith', {sql('hadith-' + edition)}, {sql(lang)}, {sql(tr(f'{name} — {en}', f'{name} — {bn}'))}, NULL, "
                f"{sql('https://github.com/fawazahmed0/hadith-api')}, {sql(HADITH_LICENSE)}, {sql(HADITH_API + '/editions')}, {sql(edition)}, c.id, {sql(lang != 'ar')}, 'in_review', {i * 10 + j + 1} "
                f"FROM is_hadith_collections c WHERE c.slug = {sql(book)} ON CONFLICT DO NOTHING;")

    out.append('\n-- Quizzes')
    quiz_ids = []
    for order, (slug, title, topic, level, seconds, questions) in enumerate(QUIZZES, 1):
        qid = uid('quiz', slug)
        quiz_ids.append(qid)
        out.append(
            'INSERT INTO is_quizzes (id, title, topic, difficulty, time_limit_seconds, points_per_question, review_status, sort_order) VALUES ('
            f"{sql(qid)}, {sql(title)}, {sql(topic)}, {sql(level)}, {sql(seconds)}, 10, 'in_review', {order}) ON CONFLICT (id) DO NOTHING;")
        for n, (question, answers, correct, explanation, source) in enumerate(questions, 1):
            question_id = uid('question', f'{slug}:{n}')
            out.append(
                'INSERT INTO is_quiz_questions (id, quiz_id, question, explanation, source_ref, sort_order) VALUES ('
                f"{sql(question_id)}, {sql(qid)}, {sql(question)}, {sql(explanation)}, {sql(source)}, {n}) ON CONFLICT (id) DO NOTHING;")
            for k, answer in enumerate(answers):
                out.append(
                    'INSERT INTO is_quiz_options (id, question_id, text, is_correct, sort_order) VALUES ('
                    f"{sql(uid('option', f'{slug}:{n}:{k}'))}, {sql(question_id)}, {sql(answer)}, {sql(k == correct)}, {k + 1}) ON CONFLICT (id) DO NOTHING;")

    out.append('\n-- Launch challenge: all six quizzes, for 30 days from when this runs')
    out.append(
        'INSERT INTO is_challenges (id, title, description, quiz_ids, starts_at, ends_at) VALUES ('
        f"{sql(uid('challenge', 'launch'))}, {sql(tr('Islamic Studio launch challenge', 'ইসলামিক স্টুডিও উদ্বোধনী চ্যালেঞ্জ'))}, "
        f"{sql(tr('Play all six quizzes; your best score on each counts.', 'ছয়টি কুইজই খেলুন; প্রতিটিতে আপনার সেরা স্কোর গণনা হবে।'))}, "
        f"ARRAY[{', '.join(sql(q) + '::uuid' for q in quiz_ids)}], now(), now() + interval '30 days') ON CONFLICT (id) DO NOTHING;")

    out.append('\n-- Zakat settings and guidance')
    out.append(
        "INSERT INTO is_zakat_settings (id, rate_percent, gold_nisab_grams, silver_nisab_grams, default_nisab_basis, guidance, review_status) "
        f"VALUES (true, 2.5, 87.48, 612.36, 'silver', {sql(ZAKAT_GUIDANCE)}, 'in_review') ON CONFLICT (id) DO NOTHING;")

    out.append('\n-- Worship Tracker habits')
    for key, name, desc, kind, unit, target, freq, default, icon, order in HABITS:
        out.append(
            'INSERT INTO is_habit_templates (key, name, description, kind, unit, default_target, frequency, is_default, icon, sort_order) VALUES ('
            f"{sql(key)}, {sql(name)}, {sql(desc)}, {sql(kind)}, {sql(unit)}, {target}, {sql(freq)}, {sql(default)}, {sql(icon)}, {order}) ON CONFLICT (key) DO NOTHING;")

    out.append('\n-- Turn the six phase-2 features on (they show empty until their content is approved)')
    out.append(f"UPDATE is_features SET status = 'active' WHERE key IN ({', '.join(sql(f) for f in FEATURES)}) AND status = 'hidden' AND min_version_code IS NOT NULL;")

    out.append("""
COMMIT;

SELECT 'reciters' AS what, count(*) FROM is_reciters
UNION ALL SELECT 'hadith chapters', count(*) FROM is_hadith_sections
UNION ALL SELECT 'hadith packs in review', count(*) FROM is_content_packs WHERE kind = 'hadith' AND review_status = 'in_review'
UNION ALL SELECT 'quizzes in review', count(*) FROM is_quizzes WHERE review_status = 'in_review'
UNION ALL SELECT 'quiz questions', count(*) FROM is_quiz_questions
UNION ALL SELECT 'habits', count(*) FROM is_habit_templates
UNION ALL SELECT 'features on', count(*) FROM is_features WHERE status = 'active';
""")
    return '\n'.join(out)


if __name__ == '__main__':
    with urllib.request.urlopen(f'{HADITH_API}/info.json', timeout=120) as res:
        info = json.load(res)
    OUT.write_text(build(info))
    print(f'✔ {OUT.name}: {len(RECITERS)} reciters, {len(BOOKS)} hadith books, {sum(len(q[5]) for q in QUIZZES)} quiz questions, {len(HABITS)} habits')
