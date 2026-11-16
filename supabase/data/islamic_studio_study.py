#!/usr/bin/env python3
"""
Writes islamic_studio_study_links.sql: study resources (migration 087) for the
Academy's sections and for quizzes — books, audio talks, videos and blog posts
already in the database (their ids as seeded; checked live on 16 Nov 2026).

A link is inserted only when both its section / quiz and its resource exist,
so the file is safe on any database. Re-runnable: nothing is duplicated.

    python3 islamic_studio_study.py
"""
import uuid
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / 'islamic_studio_study_links.sql'
NS = uuid.UUID('6f1c1b8e-6c2a-4d4e-9a57-1d2c3b4a5e60')

# Resources: short names → (type, id).
R = {
    # Books
    'brief-outline': ('book', '7a48dcc8-63f6-5762-82df-cfee6d8b6df5'),
    'hisn-al-muslim': ('book', '5cdc969a-860a-5b8e-98a7-be0c29355621'),
    'daily-traditions': ('book', '9deb0123-4fd2-5e6a-b2b7-4a4b4a06e7f2'),
    'authentic-duas': ('book', '311608ca-9c0f-5ba0-91a1-d4d15b672182'),
    'happy-life': ('book', '87544f6c-4677-5b02-a24b-0edaa41f0800'),
    'islamic-character': ('book', 'b554b78a-9518-58da-943b-1a17be393491'),
    'forty-nawawi': ('book', '12c028c1-6e45-5fff-b693-a870cab6cf00'),
    'riyadus-1': ('book', 'cc15ad01-397e-59dd-a097-0f0bcf900102'),
    'riyadus-2': ('book', '8c903fa2-b3eb-50a0-be9a-496ac7929114'),
    'children-must-know': ('book', '6716038c-91c1-5ec6-b40a-0a47134970ed'),
    'play-and-learn': ('book', 'cf79e6cb-2238-5c72-8a16-1b24ec0daa74'),
    'hadith-little-ones': ('book', '804f52ec-8869-5fb4-a35d-e1cdda861e4d'),
    'child-iman': ('book', '7aaf470e-bc47-5130-ba0c-019826472bd8'),
    'madani-qaida': ('book', 'de0f60b4-51f5-593c-9c76-7b635f132397'),
    'tafsir-last-tenth': ('book', '259b9905-340c-57b9-98c1-efb36c7b2595'),
    'ramadan-30': ('book', '8b5ab50d-0f7f-57c0-8f31-79c0bcabdb13'),
    'day-in-house': ('book', '21c93466-f10c-5ff3-9c60-99e6f99c47b5'),
    'the-seerah': ('book', '2623dcec-0ce9-5fa1-876e-7067c7308da4'),
    'concise-biography': ('book', '800a3855-449a-525f-8928-cc65985e18a4'),
    # Audio talks
    'a-salah': ('media', '0f1c1ba8-c02e-5098-86d2-16d1c3a52f4e'),
    'a-fajr-asr': ('media', '9e4823fe-32f1-5579-9f84-147f0a264bf1'),
    'a-ramadan': ('media', 'd4f5476f-a5f9-5ebb-a506-1d9af41a8a54'),
    'a-fasting': ('media', '4c9d3a0c-67ef-5a9b-b582-24c6196b6b89'),
    'a-qadr': ('media', 'f605f776-ebc5-594a-a8e0-693a1f82c04e'),
    'a-dua': ('media', 'd86d8e05-6d72-5bde-98e8-e58f89a29659'),
    'a-character': ('media', 'd2258a31-201a-573d-b91a-84c474fa5ea4'),
    'a-parents': ('media', '49209599-f4df-5970-abec-e3a6e3159ed7'),
    'a-neighbours': ('media', 'cf1549bd-cb17-5eb1-aa80-35edd748fb02'),
    'a-last-days': ('media', '09f8959f-a3ef-51ae-8b46-a04a749d022b'),
    'a-excellence-prayer': ('media', '51c2955d-d35d-54fd-bf92-38282f8fdd71'),
    'a-manners': ('media', 'acff5bad-0776-55c3-a23e-7cb4eba95274'),
    'a-life-mission': ('media', '0ab87cbb-6a0c-59b6-854e-c11f36694c93'),
    # Videos
    'v-quran-gods-word': ('media', 'acbe74c9-bc10-549a-8a21-e68c185174c5'),
    'v-seerah-1': ('media', '01b8eb0e-62ca-5511-8145-cd2970a40857'),
    'v-knowing-allah': ('media', 'db0bf576-2368-5cb9-bade-9f1f1371b05e'),
    'v-salah-focus': ('media', 'fc92b2a0-fbc2-50d0-8bfa-83f73e799d90'),
    'v-adhan-sunnah': ('media', '79d2d12a-b706-52fc-9b16-386b6c755afb'),
    'v-tafsir-ikhlas': ('media', '9437a80a-f6ea-5a0c-9bb4-0ce3d1a8d111'),
    'v-tafsir-kahf': ('media', '7b25aa0f-b402-5c31-990c-5dea826f9104'),
    'v-tafsir-fatiha': ('media', '8cc0291a-bdf3-578e-9b4e-370ff8166365'),
    'v-tafsir-mulk': ('media', 'b4b7ec7a-491f-5cb1-b880-73e239cf0fbc'),
    'v-tafsir-muzzammil': ('media', '15ea2689-2e72-54e8-90de-f94a91565800'),
    'v-life-after-death': ('media', 'fde1364f-fac5-5817-b3fe-8d7b05595ee9'),
    'v-salah-waz': ('media', '963b9258-ccd3-5830-ab10-b8579f6a62b8'),
    'v-alhamdulillah-kids': ('media', '320627f7-9109-5a83-ac67-787024e56b69'),
    # Blog posts
    'b-fajr': ('blog', 'a6ffec74-5dbb-5e84-a25b-f9ad56e84ab0'),
    'b-dhikr': ('blog', '796b56f5-4f7c-5b26-93b4-54272e468541'),
    'b-dua': ('blog', '5849ef20-29b9-553d-b605-f2bde7b6054c'),
    'b-intentions': ('blog', '0ed4ee3e-881f-502d-a5fb-490ff48c0863'),
    'b-character': ('blog', '968a4c21-865d-5a60-9769-5c647d4ae00d'),
    'b-quran-daily': ('blog', '6090d9da-2692-5161-b773-704a979e5785'),
    'b-knowledge': ('blog', '4f7c838e-c2c5-5e38-aa6d-b8e795a5cf90'),
    'b-sadaqah': ('blog', '521e91c0-1e01-58f9-95ee-b007025cb140'),
    'b-parents': ('blog', 'a38fe472-e48b-50f6-98df-0a9c4c4292e7'),
    'b-ramadan': ('blog', '7ad2f8cf-fc4a-5619-887f-162b6321ce65'),
    'b-neighbours': ('blog', '63e723d4-6152-55fd-8d91-227bdd0fda8b'),
}

# Academy sections ("<category>:<section>" as in islamic_studio_learn.py).
SECTIONS = {
    'iman:first-steps': ['brief-outline', 'v-knowing-allah', 'b-intentions', 'b-knowledge'],
    'iman:unseen': ['v-knowing-allah', 'v-life-after-death'],
    'salah:learn-to-pray': ['a-salah', 'v-salah-focus', 'v-tafsir-fatiha', 'b-fajr', 'a-excellence-prayer', 'v-salah-waz'],
    'salah:practice': ['a-fajr-asr', 'v-adhan-sunnah', 'a-excellence-prayer'],
    'quran:know': ['v-quran-gods-word', 'b-quran-daily', 'tafsir-last-tenth'],
    'quran:short-surahs': ['tafsir-last-tenth', 'v-tafsir-ikhlas', 'madani-qaida'],
    'quran:stories': ['v-tafsir-kahf', 'v-tafsir-mulk', 'v-tafsir-muzzammil'],
    'prophets:seerah': ['the-seerah', 'concise-biography', 'day-in-house', 'a-life-mission', 'v-seerah-1', 'a-last-days'],
    'ibadah:fasting': ['ramadan-30', 'a-ramadan', 'a-fasting', 'a-qadr', 'b-ramadan'],
    'ibadah:zakat-hajj': ['b-sadaqah'],
    'akhlaq:manners': ['islamic-character', 'a-character', 'a-manners', 'a-parents', 'a-neighbours', 'b-character', 'b-parents', 'b-neighbours', 'happy-life'],
    'akhlaq:words': ['hisn-al-muslim', 'authentic-duas', 'daily-traditions', 'a-dua', 'b-dhikr', 'b-dua'],
    'history:early': ['concise-biography', 'v-seerah-1'],
    'history:scholars': ['forty-nawawi', 'riyadus-1', 'riyadus-2'],
    'kids:first': ['children-must-know', 'play-and-learn', 'hadith-little-ones', 'child-iman', 'madani-qaida', 'v-alhamdulillah-kids'],
}

# Quizzes (quiz-bank slugs).
QUIZZES = {
    'quran-basics': ['v-quran-gods-word', 'tafsir-last-tenth'],
    'quran-structure': ['tafsir-last-tenth', 'b-quran-daily'],
    'short-surahs': ['tafsir-last-tenth', 'v-tafsir-ikhlas'],
    'quran-stories': ['v-tafsir-kahf'],
    'names-of-allah': ['v-knowing-allah'],
    'akhirah': ['v-life-after-death'],
    'six-pillars-of-iman': ['brief-outline'],
    'pillars-and-salah': ['a-salah', 'v-salah-focus'],
    'wudu-and-salah': ['a-salah', 'v-salah-waz'],
    'seerah': ['the-seerah', 'a-life-mission'],
    'seerah-2': ['concise-biography', 'a-last-days'],
    'ramadan': ['ramadan-30', 'a-ramadan'],
    'fasting-rules': ['a-fasting', 'b-ramadan'],
    'zakat-and-charity': ['b-sadaqah'],
    'good-manners': ['a-character', 'a-manners'],
    'family-and-character': ['a-parents', 'b-parents'],
    'sunnah-daily-life': ['daily-traditions', 'b-character'],
    'duas-and-dhikr': ['hisn-al-muslim', 'a-dua'],
    'hadith-and-scholars': ['forty-nawawi'],
    'kids-basics': ['children-must-know'],
    'kids-basics-2': ['hadith-little-ones'],
}

TABLE = {'book': 'is_books', 'media': 'is_media_items', 'blog': 'is_blog_posts'}


def section_id(key: str) -> str:
    return str(uuid.uuid5(NS, f'learn-section:{key}'))


def quiz_id(slug: str) -> str:
    return str(uuid.uuid5(NS, f'quiz:{slug}'))


def link(target_type: str, target_id: str, target_table: str, names: list[str]) -> list[str]:
    out = []
    for order, name in enumerate(names, 1):
        kind, rid = R[name]
        out.append(
            'INSERT INTO is_study_links (target_type, target_id, resource_type, resource_id, sort_order) '
            f"SELECT '{target_type}', '{target_id}', '{kind}', '{rid}', {order} "
            f"WHERE EXISTS (SELECT 1 FROM {target_table} WHERE id = '{target_id}') AND EXISTS (SELECT 1 FROM {TABLE[kind]} WHERE id = '{rid}') "
            'ON CONFLICT (target_type, target_id, resource_type, resource_id) DO NOTHING;')
    return out


def build() -> str:
    for names in [*SECTIONS.values(), *QUIZZES.values()]:
        assert len(names) == len(set(names)), names
        for n in names:
            assert n in R, n
    out = ["""-- Islamic Studio study resources for Academy sections and quizzes. Generated by islamic_studio_study.py.
-- Run after migration 087 (and the Academy seed). Safe to run again; links to missing items are skipped.

BEGIN;
"""]
    for key, names in SECTIONS.items():
        out.append(f'\n-- Section {key}')
        out += link('section', section_id(key), 'is_learn_sections', names)
    for slug, names in QUIZZES.items():
        out.append(f'\n-- Quiz {slug}')
        out += link('quiz', quiz_id(slug), 'is_quizzes', names)
    out.append("""
COMMIT;

SELECT target_type, count(*) AS links FROM is_study_links GROUP BY target_type ORDER BY 1;
""")
    return '\n'.join(out)


if __name__ == '__main__':
    OUT.write_text(build())
    n = sum(len(v) for v in SECTIONS.values()) + sum(len(v) for v in QUIZZES.values())
    print(f'✔ {OUT.name}: {n} links for {len(SECTIONS)} sections and {len(QUIZZES)} quizzes')
