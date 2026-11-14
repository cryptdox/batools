#!/usr/bin/env python3
"""
Writes islamic_studio_library.sql: starting content for Books, Audio & Video
and the Blog (migration 081 first).

  * Books: 22 PDFs from IslamHouse.com, linked (not copied). IslamHouse's usage
    policy (github.com/IslamHouse-API, linked from its site footer) allows use
    in apps when the file is unchanged and credited. Every link was checked:
    HTTP 200, application/pdf, and cross-site access allowed (the app fetches
    it). Ranked "A" in islamic-studio-app/store/free-books.md.
  * Audio & Video: islamic_studio_media_seed.json — YouTube ids checked with
    YouTube's oEmbed (embeddable) and IslamHouse MP3s checked with HEAD.
    Nothing here is typed from memory.
  * Blog: 15 long team posts (islamic_studio_blog.py). Quran is referenced by
    surah:ayah and paraphrased, hadith only by well-known references; a scholar
    should still read them. Re-running updates posts not yet approved.

Everything goes in as 'in_review' / draft, so it appears in batools for
approval (Content Review for books and media, Blog → Waiting for review) and
nothing is public until approved. Re-runnable: fixed ids; books and media are never overwritten.

    python3 islamic_studio_library.py
"""
import json
import uuid
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / 'islamic_studio_library.sql'
MEDIA = HERE / 'islamic_studio_media_seed.json'
NS = uuid.UUID('3d2f6c1e-8b4a-4f0e-9c71-5a6b7c8d9e01')

ISLAMHOUSE_LICENSE = ('IslamHouse.com usage policy (github.com/IslamHouse-API): free to use in apps and websites without prior '
                      'permission, if the file is kept unchanged, credited (IslamHouse.com, author, translator, publisher) '
                      'and updated when the source updates it.')


def uid(kind: str, key: str) -> str:
    return str(uuid.uuid5(NS, f'{kind}:{key}'))


def sql(v) -> str:
    if v is None:
        return 'NULL'
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, (dict, list)):
        if isinstance(v, list):
            return 'ARRAY[' + ', '.join(sql(x) for x in v) + ']::text[]' if v else "'{}'::text[]"
        v = json.dumps(v, ensure_ascii=False)
    return "'" + str(v).replace("'", "''") + "'"


# Books ------------------------------------------------------------------------
# (key, category slug, language, title en, title bn, author en, author bn, page, pdf, bytes)
BOOKS = [
    ('nawawi-40-en', 'hadith', 'en', 'The Forty Nawawi Hadith', 'ইমাম নববীর চল্লিশ হাদীস (ইংরেজি)', 'Imam an-Nawawi', 'ইমাম নববী',
     'https://islamhouse.com/en/books/2837460/', 'https://d1.islamhouse.com/data/en/ih_books/single/en-p-al-arba3un-alnawawiia-abo-zakaria-annawawy-ppp.pdf', 521739),
    ('fortress-en', 'duas', 'en', 'Fortification of the Muslim (Hisn al-Muslim)', 'হিসনুল মুসলিম (ইংরেজি)', "Sa'eed al-Qahtani", 'সাঈদ আল-কাহতানি',
     'https://islamhouse.com/en/books/39062/', 'https://d1.islamhouse.com/data/en/ih_books/single/en-fortress-of-the-muslim.pdf', 12570848),
    ('day-in-house-en', 'seerah', 'en', 'A Day in the House of the Messenger of Allah', 'রাসূল ﷺ-এর গৃহে একদিন (ইংরেজি)', 'Abdul-Malik al-Qasim', 'আব্দুল মালিক আল-কাসিম',
     'https://islamhouse.com/en/books/393349/', 'https://d1.islamhouse.com/data/en/ih_books/single2/en_A_Day_in_the_House_of_the_Messenger_of_Allah.pdf', 3075453),
    ('seerah-osoul-en', 'seerah', 'en', 'The Seerah', 'সিরাত (ইংরেজি)', 'Osoul Center', 'উসুল সেন্টার',
     'https://islamhouse.com/en/books/2833629/', 'https://d1.islamhouse.com/data/en/ih_books/single3/en-the-seerah.pdf', 22677668),
    ('happy-life-en', 'family', 'en', 'Useful Ways of Leading a Happy Life', 'সুখী জীবনের উপায় (ইংরেজি)', "Abdur-Rahman as-Sa'di", 'আব্দুর রহমান আস-সাদি',
     'https://islamhouse.com/en/books/2827770/', 'https://d1.islamhouse.com/data/en/ih_books/single2/en_useful_way_of_leading_happy_life.pdf', 3967887),
    ('daily-traditions-en', 'duas', 'en', 'The Daily Traditions and Supplications of the Prophet', 'নবীজির দৈনন্দিন সুন্নাত ও দোয়া (ইংরেজি)', 'Abdullah al-Furaih', 'আব্দুল্লাহ আল-ফুরাইহ',
     'https://islamhouse.com/en/books/2828233/', 'https://d1.islamhouse.com/data/en/ih_books/single2/en-daily-traditions-and-supplications-of-the-prophet.pdf', 2854517),
    ('children-must-know-en', 'kids', 'en', 'What Muslim Children Must Know', 'মুসলিম শিশুদের যা জানা দরকার (ইংরেজি)', 'Rowad Translation Center', 'রোয়াদ অনুবাদ কেন্দ্র',
     'https://islamhouse.com/en/books/2834695/', 'https://d1.islamhouse.com/data/en/ih_books/single/en-engliz-sartjhdg-erh-gnagc-ppstrp-pp.pdf', 5505422),
    ('brief-outline-en', 'aqeedah', 'en', 'Islam: A Brief Outline', 'ইসলাম: সংক্ষিপ্ত পরিচিতি (ইংরেজি)', 'IslamHouse content team', 'ইসলামহাউস কনটেন্ট টিম',
     'https://islamhouse.com/en/books/2830465/', 'https://d1.islamhouse.com/data/en/ih_books/single3/en-brief-outline-of-islam.pdf', 4170034),
    ('concise-biography-en', 'seerah', 'en', 'A Concise Biography of the Prophet and His Special Traits', 'প্রিয়নবী ﷺ-এর সংক্ষিপ্ত জীবনী (ইংরেজি)', 'Sh. Haytham Sarhan', 'শাইখ হাইসাম সারহান',
     'https://islamhouse.com/en/books/2830902/', 'https://d1.islamhouse.com/data/en/ih_books/single3/en-concise-biography.pdf', 687209),
    ('play-learn-en', 'kids', 'en', 'I Play and Learn', 'খেলি আর শিখি (ইংরেজি)', 'Sh. Haytham Sarhan', 'শাইখ হাইসাম সারহান',
     'https://islamhouse.com/en/books/2831760/', 'https://d1.islamhouse.com/data/en/ih_books/single3/en-come-lets-play.pdf', 12918457),
    ('riyadus-salihin-1-bn', 'hadith', 'bn', "Riyadus Salihin, part 1", 'রিয়াদুস সালেহীন — ১ম খণ্ড', 'Imam an-Nawawi', 'ইমাম নববী',
     'https://islamhouse.com/bn/books/427546/', 'https://d1.islamhouse.com/data/bn/ih_books/parts/bn_Riadus_Salehin/bn_01_Riadus_Salehin.pdf', 6351942),
    ('riyadus-salihin-2-bn', 'hadith', 'bn', "Riyadus Salihin, part 2", 'রিয়াদুস সালেহীন — ২য় খণ্ড', 'Imam an-Nawawi', 'ইমাম নববী',
     'https://islamhouse.com/bn/books/427546/', 'https://d1.islamhouse.com/data/bn/ih_books/parts/bn_Riadus_Salehin/bn_02_Riadus_Salehin.pdf', 6144222),
    ('nawawi-40-bn', 'hadith', 'bn', "Nawawi's Forty Hadith", 'আন্-নওয়াবীর চল্লিশ হাদীস', 'Imam an-Nawawi; tr. Nizamuddin Molla', 'ইমাম নববী; অনুবাদ: নিজামুদ্দীন মোল্লা',
     'https://islamhouse.com/bn/books/340528/', 'https://d1.islamhouse.com/data/bn/ih_books/single/bn_an_nawawir_40_hadith.pdf', 2613294),
    ('tafsir-last-tenth-bn', 'quran', 'bn', 'Tafsir of the last tenth of the Quran', 'তাফসীরুল উশরিল আখীর (শেষ দশ পারার তাফসীর)', 'A group of scholars', 'একদল আলেম',
     'https://islamhouse.com/bn/books/172432/', 'https://d1.islamhouse.com/data/bn/ih_books/single2/bn-tafseer-oshr.pdf', 22547484),
    ('day-in-house-bn', 'seerah', 'bn', 'A Day in the House of the Messenger of Allah', 'রাসূল ﷺ-এর গৃহে একদিন', 'Abdul-Malik al-Qasim', 'আব্দুল মালিক আল-কাসিম',
     'https://islamhouse.com/bn/books/438771/', 'https://d1.islamhouse.com/data/bn/ih_books/single2/bn_rasul_grihe_ekdin.pdf', 1796921),
    ('authentic-duas-bn', 'duas', 'bn', 'Authentic duas and dhikr', 'বিশুদ্ধ দুআ ও যিকির', 'Dr. Abdullah al-Furaih', 'ড. আব্দুল্লাহ আল-ফুরাইহ',
     'https://islamhouse.com/bn/books/2836719/', 'https://d1.islamhouse.com/data/bn/ih_books/single2/doa-bn.pdf', 3740090),
    ('ramadan-30-bn', 'salah', 'bn', '30 sessions of Ramadan', 'রমযান মাসের ৩০ আসর', 'Muhammad ibn Salih al-Uthaymeen', 'মুহাম্মাদ ইবন সালিহ আল-উসাইমীন',
     'https://islamhouse.com/bn/books/438417/', 'https://d1.islamhouse.com/data/bn/ih_books/single2/bn_ramzan_masher_30_ashor.pdf', 3160277),
    ('sonamoni-hadith-bn', 'kids', 'bn', 'Hadith lessons for little ones, 1', 'সোনামনিদের হাদীস শিক্ষা আসর — ১', 'Ali Hasan Taiyeb', 'আলী হাসান তৈয়ব',
     'https://islamhouse.com/bn/books/449979/', 'https://d1.islamhouse.com/data/bn/ih_books/single2/bn_sonamoni_der_hadith_sikkhar_asor_1.pdf', 780423),
    ('child-iman-bn', 'kids', 'bn', "Nurturing a child's iman", 'শিশুর ঈমান পরিচর্যা', 'Abdullah ar-Rukf', 'আব্দুল্লাহ আর-রুকফ',
     'https://islamhouse.com/bn/books/2843168/', 'https://d1.islamhouse.com/data/bn/ih_books/single/bn-the-childrens-questions.pdf', 8893803),
    ('akhlaq-bn', 'family', 'bn', 'Principles of Islamic character', 'ইসলামী চরিত্রের মূলনীতি', 'Khalid ibn Hamid al-Hazimi', 'খালিদ ইবন হামিদ আল-হাযিমী',
     'https://islamhouse.com/bn/books/2839064/', 'https://d1.islamhouse.com/data/bn/ih_books/single/bn-ausul-alakhlaq-al-islamiiah-pp.pdf', 12311558),
    ('madani-qaida-bn', 'kids', 'bn', 'Madani Qaida: learning to read the Quran', 'মাদানী কায়দা: নবীনদের ক্বেরাত শিক্ষা', 'Abdul Muhsin al-Qasim', 'আব্দুল মুহসিন আল-কাসিম',
     'https://islamhouse.com/bn/books/2837714/', 'https://d1.islamhouse.com/data/bn/ih_books/single/bn-alqiraaah-bn.pdf', 6274404),
    ('concise-seerah-bn', 'seerah', 'bn', 'A concise biography of the Prophet', 'প্রিয়নবী ﷺ-এর জীবন-চরিত ও চারিত্রিক গুণাবলীর সারসংক্ষেপ', 'Sh. Haytham Sarhan', 'শাইখ হাইসাম সারহান',
     'https://islamhouse.com/bn/books/2830999/', 'https://d1.islamhouse.com/data/bn/ih_books/single2/bn-sirat-alnabi.pdf', 1929546),
]

# Blog: the posts live in islamic_studio_blog.py.
from islamic_studio_blog import POSTS  # noqa: E402


def build() -> str:
    out = ["""-- Islamic Studio starting library: books (linked from IslamHouse), videos and
-- audio talks (checked links) and team blog posts. Generated by
-- islamic_studio_library.py. Run after migration 081. Safe to run again.
-- Everything waits for review in batools: Content Review (books, media) and
-- Blog → Waiting for review.

BEGIN;

INSERT INTO is_book_categories (slug, name, sort_order) VALUES ('quran', '{"en":"Quran & tafsir","bn":"কুরআন ও তাফসির"}', 5)
ON CONFLICT (slug) DO NOTHING;
"""]
    for order, (key, cat, lang, t_en, t_bn, a_en, a_bn, page, pdf, size) in enumerate(BOOKS, 1):
        out.append(
            'INSERT INTO is_books (id, category_id, title, author, description, language, file_url, size_bytes, license, source_url, review_status, sort_order) VALUES ('
            f"{sql(uid('book', key))}, (SELECT id FROM is_book_categories WHERE slug = {sql(cat)}), {sql({'en': t_en, 'bn': t_bn})}, "
            f"{sql({'en': a_en, 'bn': a_bn})}, {sql({'en': 'From IslamHouse.com.', 'bn': 'IslamHouse.com থেকে।'})}, {sql(lang)}, {sql(pdf)}, {size}, "
            f"{sql(ISLAMHOUSE_LICENSE)}, {sql(page)}, 'in_review', {order}) ON CONFLICT (id) DO NOTHING;")

    if MEDIA.exists():
        media = json.loads(MEDIA.read_text())
        out.append('\n-- Videos (YouTube ids checked with oEmbed) and audio talks (IslamHouse MP3s checked with HEAD).')
        for order, v in enumerate(media.get('videos', []), 1):
            out.append(
                'INSERT INTO is_media_items (id, kind, category_id, title, speaker, description, language, youtube_id, duration_seconds, review_status, sort_order) VALUES ('
                f"{sql(uid('video', v['youtube_id']))}, 'video', (SELECT id FROM is_media_categories WHERE slug = {sql(v['category'])}), "
                f"{sql({'en': v['title_en'], 'bn': v['title_bn']})}, {sql({'en': v['speaker'], 'bn': v.get('speaker_bn') or v['speaker']})}, "
                f"{sql({'en': 'YouTube: ' + v['channel'], 'bn': 'ইউটিউব: ' + v['channel']})}, {sql(v['language'])}, {sql(v['youtube_id'])}, "
                f"{sql(v.get('duration_seconds'))}, 'in_review', {order}) ON CONFLICT (id) DO NOTHING;")
        for order, a in enumerate(media.get('audios', []), 1):
            out.append(
                'INSERT INTO is_media_items (id, kind, category_id, title, speaker, description, language, audio_url, duration_seconds, review_status, sort_order) VALUES ('
                f"{sql(uid('audio', a['url']))}, 'audio', (SELECT id FROM is_media_categories WHERE slug = {sql(a['category'])}), "
                f"{sql({'en': a['title_en'], 'bn': a['title_bn']})}, {sql({'en': a['speaker'], 'bn': a.get('speaker_bn') or a['speaker']})}, "
                f"{sql({'en': 'From IslamHouse.com: ' + a['page_url'], 'bn': 'IslamHouse.com থেকে: ' + a['page_url']})}, {sql(a['language'])}, {sql(a['url'])}, "
                f"{sql(a.get('duration_seconds'))}, 'in_review', {order}) ON CONFLICT (id) DO NOTHING;")

    out.append('\n-- Team blog posts, waiting for review.')
    for key, lang, title, summary, body, tags in POSTS:
        out.append(
            'INSERT INTO is_blog_posts (id, source, author_name, language, title, summary, body_html, tags, review_status) VALUES ('
            f"{sql(uid('post', key))}, 'team', 'Islamic Studio', {sql(lang)}, {sql(title)}, {sql(summary)}, {sql(body)}, {sql(tags)}, 'in_review') "
            # A post not yet approved takes the newer text; an approved one is never touched.
            'ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, summary = EXCLUDED.summary, body_html = EXCLUDED.body_html, tags = EXCLUDED.tags '
            "WHERE is_blog_posts.review_status <> 'approved';")

    out.append("""
COMMIT;

SELECT 'books' AS what, count(*) FROM is_books
UNION ALL SELECT 'videos', count(*) FROM is_media_items WHERE kind = 'video'
UNION ALL SELECT 'audio talks', count(*) FROM is_media_items WHERE kind = 'audio'
UNION ALL SELECT 'blog posts', count(*) FROM is_blog_posts
UNION ALL SELECT 'waiting for review', (SELECT count(*) FROM is_books WHERE review_status = 'in_review')
  + (SELECT count(*) FROM is_media_items WHERE review_status = 'in_review') + (SELECT count(*) FROM is_blog_posts WHERE review_status = 'in_review');
""")
    return '\n'.join(out)


if __name__ == '__main__':
    OUT.write_text(build())
    media = json.loads(MEDIA.read_text()) if MEDIA.exists() else {}
    print(f'✔ {OUT.name}: {len(BOOKS)} books, {len(media.get("videos", []))} videos, {len(media.get("audios", []))} audio talks, {len(POSTS)} posts')
