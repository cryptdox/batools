#!/usr/bin/env python3
"""
Islamic Studio books, batch 2: 30 more free PDFs from IslamHouse.com (24 Bangla,
6 English), linked (not copied). Writes islamic_studio_books_batch2.sql; run
after migration 081 and islamic_studio_library.sql (which adds the 'quran'
category; it is added here too, in case).

  * Source and licence: IslamHouse.com. Its usage policy (github.com/IslamHouse-API,
    linked from its site footer) allows use in apps when the file is kept
    unchanged and credited (IslamHouse.com, author, translator, publisher).
  * Every link was checked on 2026-11-24: `curl -sIL` on the PDF gave HTTP 200,
    content-type application/pdf, a content-length equal to SIZE below and an
    access-control-allow-origin header (the app fetches it cross-site); and the
    same PDF link appears on the book's IslamHouse page.
  * None of these is in islamic_studio_library.py (checked by page id and PDF).
    Three English books are editions of Bangla books in this batch (Ibn Baz on
    prayer, Pillars of Iman, the short seerah); one Bangla kids book is the
    Bangla edition of an English book already in the library.
  * Titles: Bangla titles as on IslamHouse; English titles are renderings
    (English books keep IslamHouse's title). Some author names are shown only
    in Arabic on IslamHouse; those Bangla/English spellings are ours (NOTE says
    so). A reviewer should check credits before approving.

Everything goes in as 'in_review' (batools → Content Review), nothing is
public until approved. Fixed ids (uuid5 of "book:batch2:<key>"), ON CONFLICT
DO NOTHING, so re-running never overwrites.

    python3 islamic_studio_books_batch2.py
"""
import json
import uuid
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / 'islamic_studio_books_batch2.sql'
# Same namespace as islamic_studio_library.py.
NS = uuid.UUID('3d2f6c1e-8b4a-4f0e-9c71-5a6b7c8d9e01')
CHECKED = '2026-11-24'

ISLAMHOUSE_LICENSE = ('IslamHouse.com usage policy (github.com/IslamHouse-API): free to use in apps and websites without prior '
                      'permission, if the file is kept unchanged, credited (IslamHouse.com, author, translator, publisher) '
                      'and updated when the source updates it.')


def uid(kind: str, key: str) -> str:
    return str(uuid.uuid5(NS, f'{kind}:batch2:{key}'))


def sql(v) -> str:
    if v is None:
        return 'NULL'
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, dict):
        v = json.dumps(v, ensure_ascii=False)
    return "'" + str(v).replace("'", "''") + "'"


# (key, category slug, language, title en, title bn, author en, author bn,
#  translator en, translator bn, IslamHouse page, PDF, SIZE bytes, NOTE)
BOOKS = [
    ('salat-nabi-ibn-baz-bn', 'salah', 'bn', "The Prophet's (ﷺ) Manner of Prayer", 'নবী صلى الله عليه وسلم-এর সালাত আদায়ের পদ্ধতি', 'Abdul Aziz bin Abdullah bin Baz', 'আব্দুল আযীয ইবন আবদুল্লাহ ইবন বায', None, None, 'https://islamhouse.com/bn/books/2842324/', 'https://d1.islamhouse.com/data/bn/ih_books/single/risala_bn-kaifiyah_solat_nabi-2.1.pdf', 1389607,
     'Message of the Two Holy Mosques (risala.prh.gov.sa) edition; translator not listed. English edition of the same work is also in this batch (prophets-prayer-ibn-baz-en).'),
    ('salater-gurutto-fojilot-bn', 'salah', 'bn', 'Importance and Virtues of Salah', 'সালাতের গুরুত্ব ও ফযীলত', 'Abdullah bin Saad Al-Falih', 'আব্দুল্লাহ বিন সাআদ আল ফালেহ', 'Muhammad Abdur Rob Affan', 'মুহাম্মাদ আব্দুর রব আফফান', 'https://islamhouse.com/bn/books/2809711/', 'https://d1.islamhouse.com/data/bn/ih_books/single2/bn_salater_gurutto_o_fojilot.pdf', 964961,
     'Edited by Abu Bakr Muhammad Zakaria; Islamic Propagation Office, Rabwah.'),
    ('siyam-o-ramadan-bn', 'salah', 'bn', 'Fasting and Ramadan: Lessons, Significance and Rulings', 'সিয়াম ও রমজান: শিক্ষা-তাৎপর্য-মাসায়েল', 'Abdullah Shahid Abdur Rahman', 'আব্দুল্লাহ শহীদ আব্দুর রহমান', None, None, 'https://islamhouse.com/bn/books/320075/', 'https://d1.islamhouse.com/data/bn/ih_books/single/bn_darsu_ramadaan.pdf', 4711196,
     'Fasting. Edited by Muhammad Shamsul Haque Siddique.'),
    ('hajj-umrah-ziyarat-guide-bn', 'salah', 'bn', 'Guide to Hajj, Umrah and Ziyarah', 'হজ, উমরা ও যিয়ারত গাইড', 'Muhammad Shamsul Haque Siddique', 'মুহাম্মদ শামসুল হক সিদ্দিক', None, None, 'https://islamhouse.com/bn/books/60366/', 'https://d1.islamhouse.com/data/bn/ih_books/single/bn_hajj_guide.pdf', 1017933,
     "Hajj/Umrah. Original Bangla work; edited by Nu'man ibn Abul Bashar."),
    ('umrah-korar-niyom-bn', 'salah', 'bn', 'How to Perform Umrah in Light of the Quran and Sunnah', 'কুরআন ও সুন্নাহর আলোকে উমরাহ করার নিয়ম', 'Abu Bakr Muhammad Zakaria', 'আবু বকর মুহাম্মাদ যাকারিয়া', None, None, 'https://islamhouse.com/bn/books/364810/', 'https://d1.islamhouse.com/data/bn/ih_books/single2/bn_Quran_sunnar_aloke_Umrah.pdf', 258506,
     'Umrah. Short booklet.'),
    ('zakat-o-khairat-bn', 'salah', 'bn', 'Zakat and Charity', 'যাকাত ও খয়রাত', 'Abdul Hamid Faizi', 'আব্দুল হামীদ ফাইযী', None, None, 'https://islamhouse.com/bn/books/398685/', 'https://d1.islamhouse.com/data/bn/ih_books/single/bn_zakat_o_khairat.pdf', 568761,
     'Zakat. Original Bangla work.'),
    ('zakat-bidhaner-sarsongkhep-bn', 'salah', 'bn', 'Summary of the Rulings of Zakat', 'যাকাত বিধানের সারসংক্ষেপ', None, None, 'Sanaullah Nazir Ahmad', 'সানাউল্লাহ নজির আহমদ', 'https://islamhouse.com/bn/books/2806147/', 'https://d1.islamhouse.com/data/bn/ih_books/single2/bn_zakat_bidhaner_sarsongkep.pdf', 1396867,
     'Zakat. Author not listed on IslamHouse; edited by Abu Bakr Muhammad Zakaria; Islamic Propagation Office, Rabwah.'),
    ('sohoj-tawhid-proshnottor-bn', 'aqeedah', 'bn', 'Easy Tawhid Lessons in Questions and Answers', 'প্রশ্নোত্তরে সহজ তাওহীদ শিক্ষা', 'A group of scholars', 'একদল বিজ্ঞ আলেম', 'Abdul Alim bin Kawsar', 'আব্দুল আলীম বিন কাওসার', 'https://islamhouse.com/bn/books/410093/', 'https://d1.islamhouse.com/data/bn/ih_books/single/bn_proshnottore_sohoj_tawhid_sikkhah.pdf', 4752202,
     'Q&A format; edited by Abu Bakr Muhammad Zakaria.'),
    ('sohoj-aqeedah-bn', 'aqeedah', 'bn', 'Simple Aqeedah in Light of the Quran and Hadith', 'কুরআন ও হাদীসের আলোকে সহজ আকীদা', 'Ahmad ibn Abdur Rahman Al-Qadi', 'আহমাদ ইবন আব্দুর রহমান আল-কাযী', 'Zakerullah Abul Khayer', 'জাকের উল্লাহ আবুল খায়ের', 'https://islamhouse.com/bn/books/2806328/', 'https://d1.islamhouse.com/data/bn/ih_books/single2/bn_el3akeda_elmoeasara.pdf', 2263189,
     'IslamHouse lists several contributors (Abu Bakr Muhammad Zakaria, Muhammad Murtaza ibn Ayesh Muhammad) under authors.'),
    ('imaner-stombho-bn', 'aqeedah', 'bn', 'Pillars of Iman', 'ঈমানের স্তম্ভসমূহ', 'Deanship of Scientific Research, Islamic University of Madinah', 'ইলমী গবেষণা ডীনশীপ, ইসলামী বিশ্ববিদ্যালয়, মদিনা মুনাওয়ারা', 'Muhammad Ibrahim Abdul Halim', 'মুহাম্মাদ ইবরাহীম আব্দুল হালীম', 'https://islamhouse.com/bn/books/283/', 'https://d1.islamhouse.com/data/bn/ih_books/single2/bn_Iman_er_Rokonsomuho.pdf', 2109454,
     'Edited by Abu Bakr Muhammad Zakaria. English edition also in this batch (pillars-of-eemaan-en).'),
    ('nobi-jiboni-bn', 'seerah', 'bn', 'Biography of the Prophet', 'নবী জীবনী', 'Abu Bakr Muhammad Zakaria', 'আবু বকর মুহাম্মাদ যাকারিয়া', None, None, 'https://islamhouse.com/bn/books/344662/', 'https://d1.islamhouse.com/data/bn/ih_books/single/bn_Nobi_jiboni.pdf', 1038736,
     'Short seerah.'),
    ('bishwanobir-songkhipto-jiboni-bn', 'seerah', 'bn', 'A Brief Biography of the Prophet (ﷺ)', 'বিশ্বনবীর সংক্ষিপ্ত জীবনী', 'Khalid bin Hamid Al-Hazimi', 'খালিদ ইবন হামিদ আল-হাযিমী', None, None, 'https://islamhouse.com/bn/books/2843448/', 'https://d1.islamhouse.com/data/bn/ih_books/single/bn-al-mugaz.pdf', 2800613,
     'Author name shown in Arabic on IslamHouse (خالد بن حامد الحازمي); translator not listed. English edition also in this batch (prophet-muhammad-life-brief-en).'),
    ('doya-o-bhalobasar-bishwanobi-bn', 'seerah', 'bn', 'The Unique Prophet of Mercy and Love', 'দয়া ও ভালোবাসার অনন্য বিশ্বনবী', "Sa'id ibn Ali ibn Wahf Al-Qahtani", 'সা‘ঈদ ইবন আলী ইবন ওয়াহাফ আল-ক্বাহত্বানী', None, None, 'https://islamhouse.com/bn/books/154751/', 'https://d1.islamhouse.com/data/bn/ih_books/bn_nabi_alomi.pdf', 818357,
     "Translation of 'Rahmatan lil-Alamin'; IslamHouse lists Abdullah Shahid Abdur Rahman as co-author/editor (likely the translator)."),
    ('sohih-hadith-qudsi-bn', 'hadith', 'bn', 'Authentic Hadith Qudsi', 'সহিহ হাদিসে কুদসি', 'Mustafa Al-Adawi', 'মুস্তাফা আল-আদাওয়ী', 'Sanaullah Nazir Ahmad', 'সানাউল্লাহ নজির আহমদ', 'https://islamhouse.com/bn/books/385563/', 'https://d1.islamhouse.com/data/bn/ih_books/single2/bn_Sohih_hadith_e_qudsi.pdf', 2082941,
     'Edited by Abu Bakr Muhammad Zakaria.'),
    ('quran-bishoyok-40-hadith-bn', 'hadith', 'bn', 'Forty Hadith about the Quran', 'কুরআন বিষয়ক চল্লিশ হাদীস', 'Ahmad bin Abdur-Razzaq Al-Anqari', 'আহমাদ ইবন আব্দুর রাযযাক আল-‘আনকারী', None, None, 'https://islamhouse.com/bn/books/2835973/', 'https://d1.islamhouse.com/data/bn/ih_books/single/bn-alarba3un-alqurania.pdf', 537487,
     'Author name shown in Arabic on IslamHouse (أحمد بن عبد الرزاق العنقري); translator not listed.'),
    ('sohih-dua-o-zikr-bn', 'duas', 'bn', 'Authentic Duas and Dhikr', 'সহীহ দুআ ও যিকর', 'Abdul Hamid Faizi', 'আব্দুল হামীদ ফাইযী', None, None, 'https://islamhouse.com/bn/books/436753/', 'https://d1.islamhouse.com/data/bn/ih_books/single2/bn_sohih_dua_o_zikr.pdf', 888666,
     "Different work from 'বিশুদ্ধ দুআ ও যিকির' (2836719) already in library."),
    ('sokal-sondhar-zikir-bn', 'duas', 'bn', 'Morning and Evening Adhkar', 'সকাল-সন্ধার জিকিরসমূহ', 'Abu Bakr Muhammad Zakaria, Iqbal Hossain Masum', 'আবু বকর মুহাম্মাদ যাকারিয়া, ইকবাল হোছাইন মাছুম', None, None, 'https://islamhouse.com/bn/books/232425/', 'https://d1.islamhouse.com/data/bn/ih_books/single2/bn_Sokal_sondhar_jikirsomuho.pdf', 680270,
     'Short booklet; Islamic Propagation Office, Rabwah.'),
    ('namajer-dua-o-zikr-bn', 'duas', 'bn', 'Duas and Dhikr of the Prayer', 'নামাযের দু‘আ ও যিকর', None, None, 'Muhammad Abdur Rob Affan', 'মুহাম্মাদ আব্দুর রব আফফান', 'https://islamhouse.com/bn/books/460997/', 'https://d1.islamhouse.com/data/bn/ih_books/single2/bn_namaj-er_dua_o_zikr.pdf', 388601,
     'Author not listed on IslamHouse; edited by Abu Bakr Muhammad Zakaria. Fits duas or salah.'),
    ('adorsho-bibaho-dampotto-bn', 'family', 'bn', 'The Ideal Marriage and Married Life', 'আদর্শ বিবাহ ও দাম্পত্য', 'Abdul Hamid Faizi', 'আব্দুল হামীদ ফাইযী', None, None, 'https://islamhouse.com/bn/books/395879/', 'https://d1.islamhouse.com/data/bn/ih_books/single/bn_adorsho_bibaho_o_dampotto.pdf', 844442,
     'Marriage. Original Bangla work.'),
    ('adorsho-muslim-poribar-bn', 'family', 'bn', 'The Ideal Muslim Family', 'আদর্শ মুসলিম পরিবার', 'Zakerullah Abul Khayer', 'জাকের উল্লাহ আবুল খায়ের', None, None, 'https://islamhouse.com/bn/books/2809287/', 'https://d1.islamhouse.com/data/bn/ih_books/single2/bn_Adorso_Muslim_poribar.pdf', 1009469,
     'Edited by Mohammad Manzure Elahi.'),
    ('shishuder-lalon-palon-bn', 'family', 'bn', 'Raising Children: Duties of Parents and Children', 'শিশুদের লালন-পালন : মাতা-পিতার দায়িত্ব ও সন্তানের করণীয়', 'Muhammad ibn Jamil Zino', 'মুহাম্মদ ইবন জামীল যাইনূ', 'Zakerullah Abul Khayer', 'জাকের উল্লাহ আবুল খায়ের', 'https://islamhouse.com/bn/books/338955/', 'https://d1.islamhouse.com/data/bn/ih_books/single/bn_shishuder_lalon_palon_dayitto_o_koronio.pdf', 3172866,
     'Parenting. Edited by Md. Abdul Qader.'),
    ('sonamonider-jana-dorkar-bn', 'kids', 'bn', 'What Muslim Children Must Know', 'মুসলিম সোনামণিদের জন্য যা জানা অত্যাবশ্যক', 'Rowad Translation Center', 'রোওয়াদ অনুবাদ কেন্দ্র', 'Rowad Translation Center', 'রোওয়াদ অনুবাদ কেন্দ্র', 'https://islamhouse.com/bn/books/2835991/', 'https://d1.islamhouse.com/data/bn/ih_books/single/bn-22-2835991-ma-la-yasa3-atfal-almuslimin-jahluh-ppp.pdf', 3319263,
     "Arabic original 'Ma la yasa'u atfal al-muslimin jahluh' by the Association for Islamic Content Service in Languages; IslamHouse lists 'Rowad Translation Center' in Latin script. NOTE: its English edition (en 2834695) is already in the library; this is the Bangla edition."),
    ('prathomik-islam-shikkha-bn', 'kids', 'bn', 'Basic Islamic Education', 'প্রাথমিক ইসলাম শিক্ষা', 'Chowdhury Abul Kalam Azad', 'চৌধুরী আবুল কালাম আজাদ', None, None, 'https://islamhouse.com/bn/books/144369/', 'https://d1.islamhouse.com/data/bn/ih_books/single2/bn-manahej-awaliah.pdf', 649331,
     "Beginner-level Islamic curriculum (suitable for children/new learners); edited by Nu'man ibn Abul Bashar."),
    ('quran-shikkhar-sohoj-poddhoti-bn', 'quran', 'bn', 'An Easy Method of Learning the Quran for Children and Adults', 'শিশু ও বয়স্কদের কুরআন শিক্ষার সহজ পদ্ধতি', None, None, None, None, 'https://islamhouse.com/bn/books/2828614/', 'https://d1.islamhouse.com/data/bn/ih_books/single2/bn-t3leem-alqran-atfal-wa-alkbaar.pdf', 599419,
     'Quran reading primer; no author listed on IslamHouse. Could also go under kids. Different from the Madani Qaida (2837714) already in library.'),
    ('prophets-prayer-ibn-baz-en', 'salah', 'en', "The Prophet's Manner of Prayer (May Allah's peace and blessings be upon him)", 'নবী ﷺ-এর সালাত আদায়ের পদ্ধতি (ইংরেজি)', 'Abdul Aziz bin Abdullah bin Baz', 'আব্দুল আযীয ইবন আবদুল্লাহ ইবন বায', None, None, 'https://islamhouse.com/en/books/2842319/', 'https://d1.islamhouse.com/data/en/ih_books/single/risala_en-kaifiyah_solat-2.1.pdf', 1283374,
     'Message of the Two Holy Mosques (risala.prh.gov.sa) edition; English of the Bangla item salat-nabi-ibn-baz-bn.'),
    ('rulings-on-fasting-en', 'salah', 'en', 'Some Rulings on Fasting', 'সিয়ামের কতিপয় বিধি-বিধান (ইংরেজি)', 'Scientific Committee, General Presidency for Religious Affairs at the Two Holy Mosques', 'মসজিদুল হারাম ও মসজিদে নববীর ধর্মবিষয়ক প্রেসিডেন্সির ইলমী কমিটি', None, None, 'https://islamhouse.com/en/books/2842592/', 'https://d1.islamhouse.com/data/en/ih_books/single/risala_en_minahkam_assiyam.pdf', 1385635,
     'Fasting. Author shown in Arabic on IslamHouse (اللجنة العلمية برئاسة الشؤون الدينية بالمسجد الحرام والمسجد النبوي); risala.prh.gov.sa edition.'),
    ('book-of-zakat-en', 'salah', 'en', 'The Book of Zakat', 'যাকাতের মাসায়েল (ইংরেজি)', 'Muhammad Iqbal Kelani', 'মুহাম্মদ ইকবাল কিলানী', None, None, 'https://islamhouse.com/en/books/2779527/', 'https://d1.islamhouse.com/data/en/ih_books/single2/en_the_Book_of_Zakaat.pdf', 3371088,
     'Zakat. Publisher Darussalam; reviewed by Osama Emara.'),
    ('pillars-of-eemaan-en', 'aqeedah', 'en', 'Pillars of Eemaan', 'ঈমানের স্তম্ভসমূহ (ইংরেজি)', 'Deanship of Scientific Research, Islamic University of Madinah', 'ইলমী গবেষণা ডীনশীপ, ইসলামী বিশ্ববিদ্যালয়, মদিনা মুনাওয়ারা', 'AbdulRafea Adewale Imam', 'আব্দুর রাফি আদেওয়ালে ইমাম', 'https://islamhouse.com/en/books/453080/', 'https://d1.islamhouse.com/data/en/ih_books/single2/en_arkan_el_eman.pdf', 854389,
     'English of the Bangla item imaner-stombho-bn.'),
    ('prophet-muhammad-life-brief-en', 'seerah', 'en', "Prophet Muhammad's Life (A Brief Account)", 'বিশ্বনবীর সংক্ষিপ্ত জীবনী (ইংরেজি)', 'Khalid bin Hamid Al-Hazimi', 'খালিদ ইবন হামিদ আল-হাযিমী', None, None, 'https://islamhouse.com/en/books/2841174/', 'https://d1.islamhouse.com/data/en/ih_books/single/en-prophet-muhammad-s-life-pdf.pdf', 7776011,
     "IslamHouse's own title has a typo ('Berief'), corrected here. Author shown in Arabic on IslamHouse (خالد بن حامد الحازمي). English edition of bishwanobir-songkhipto-jiboni-bn."),
    ('excellence-of-supplication-en', 'duas', 'en', 'Excellence of Supplication, its Etiquette and Preferred Times', 'দু‘আর ফযীলত, আদব ও দু‘আর মুস্তাহাব সময় (ইংরেজি)', 'General Presidency of the Haram and Nabawi Mosques Affairs (gph.gov.sa)', 'মসজিদুল হারাম ও মসজিদে নববী বিষয়ক জেনারেল প্রেসিডেন্সি (gph.gov.sa)', 'Rowad Translation Center', 'রোওয়াদ অনুবাদ কেন্দ্র', 'https://islamhouse.com/en/books/2837270/', 'https://d1.islamhouse.com/data/en/ih_books/single/en-aldu3aa.pdf', 126771,
     'Short booklet.'),
]


def credits(author_en, author_bn, tr_en, tr_bn) -> dict:
    """The author field: author, then the translator if IslamHouse names one."""
    en = '; '.join(x for x in (author_en, f'tr. {tr_en}' if tr_en else None) if x)
    bn = '; '.join(x for x in (author_bn, f'অনুবাদ: {tr_bn}' if tr_bn else None) if x)
    return {k: v for k, v in (('en', en), ('bn', bn)) if v}


def build() -> str:
    out = ["""-- Islamic Studio books, batch 2: 30 PDFs linked from IslamHouse.com (links
-- checked """ + CHECKED + """: HTTP 200, application/pdf, CORS). Generated by
-- islamic_studio_books_batch2.py. Run after migration 081 and
-- islamic_studio_library.sql. Safe to run again (fixed ids, ON CONFLICT DO NOTHING).
-- Everything waits for review in batools → Content Review.

BEGIN;

INSERT INTO is_book_categories (slug, name, sort_order) VALUES ('quran', '{"en":"Quran & tafsir","bn":"কুরআন ও তাফসির"}', 5)
ON CONFLICT (slug) DO NOTHING;
"""]
    keys = set()
    for order, (key, cat, lang, t_en, t_bn, a_en, a_bn, tr_en, tr_bn, page, pdf, size, note) in enumerate(BOOKS, 101):
        assert key not in keys and cat in {'aqeedah', 'salah', 'seerah', 'hadith', 'duas', 'family', 'kids', 'quran'}, key
        assert pdf.startswith('https://') and lang in ('bn', 'en'), key
        keys.add(key)
        out.append(
            'INSERT INTO is_books (id, category_id, title, author, description, language, file_url, size_bytes, license, source_url, review_status, sort_order) VALUES ('
            f"{sql(uid('book', key))}, (SELECT id FROM is_book_categories WHERE slug = {sql(cat)}), {sql({'en': t_en, 'bn': t_bn})}, "
            f"{sql(credits(a_en, a_bn, tr_en, tr_bn))}, {sql({'en': 'From IslamHouse.com.', 'bn': 'IslamHouse.com থেকে।'})}, {sql(lang)}, {sql(pdf)}, {size}, "
            f"{sql(ISLAMHOUSE_LICENSE)}, {sql(page)}, 'in_review', {order}) ON CONFLICT (id) DO NOTHING;")

    out.append("""
COMMIT;

SELECT 'books' AS what, count(*) FROM is_books
UNION ALL SELECT 'books waiting for review', count(*) FROM is_books WHERE review_status = 'in_review';
""")
    return '\n'.join(out)


if __name__ == '__main__':
    OUT.write_text(build())
    print(f'✔ {OUT.name}: {len(BOOKS)} books '
          f'({sum(b[2] == "bn" for b in BOOKS)} Bangla, {sum(b[2] == "en" for b in BOOKS)} English)')
