#!/usr/bin/env python3
"""
Writes SQL that stores a Quran translation in our own database
(is_translation_ayahs, migration 078), so the app no longer fetches it from an
outside server. Large translations are split into parts the Supabase SQL
editor can take: islamic_studio_translation_<slug>[_partN].sql, run in order.

Only translations we may keep go here:
  en-pickthall  Pickthall, The Meaning of the Glorious Koran (1930). Public
                domain: the translator died in 1936. Text via api.alquran.cloud (Tanzil).
  bn-zakaria    Abu Bakr Zakaria, King Fahd Glorious Quran Printing Complex, via
                QuranEnc.com. Republishing is allowed with no change, addition or
                deletion (so the translator's footnotes are kept too), credit to the
                publisher and QuranEnc.com, the version number, and updating when a
                new version comes out (re-run this script and the SQL).

Packs go in as 'in_review': approve them in batools → Content Review.
Re-runnable: fixed pack ids; ayahs already stored are left alone.

    python3 islamic_studio_translation.py                 # all
    python3 islamic_studio_translation.py bn-zakaria      # one
"""
import json
import sys
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

HERE = Path(__file__).resolve().parent
NS = uuid.UUID('6f1c1b8e-6c2a-4d4e-9a57-1d2c3b4a5e60')
PART_BYTES = 1_500_000

TRANSLATIONS = {
    'en-pickthall': {
        'source': ('alquran', 'en.pickthall'),
        'language': 'en',
        'name': {'en': 'English — Pickthall', 'bn': 'ইংরেজি — পিকথল'},
        'author': 'Mohammed Marmaduke Pickthall',
        'source_url': 'https://tanzil.net/trans/',
        'license': 'Public domain: M. M. Pickthall, The Meaning of the Glorious Koran (1930); the translator died in 1936.',
        'default': True,
        'sort': 1,
    },
    'bn-zakaria': {
        'source': ('quranenc', 'bengali_zakaria'),
        'version_label': '1.4.4',
        'language': 'bn',
        'name': {'en': 'Bangla — Abu Bakr Zakaria (King Fahd Complex)', 'bn': 'বাংলা — আবু বকর যাকারিয়া (বাদশাহ ফাহাদ কমপ্লেক্স)'},
        'author': 'Abu Bakr Muhammad Zakaria',
        'source_url': 'https://quranenc.com/en/browse/bengali_zakaria',
        'license': 'King Fahd Glorious Quran Printing Complex, via QuranEnc.com, version 1.4.4. Republished unchanged with its footnotes, '
                   'as QuranEnc.com permits (credit the publisher and QuranEnc.com, give the version, keep it updated, no inappropriate ads).',
        'default': True,
        'sort': 1,
    },
}


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


def fetch_json(url: str, tries: int = 3):
    # QuranEnc refuses Python's default user agent; say who we are.
    req = urllib.request.Request(url, headers={'User-Agent': 'IslamicStudio-batools/1.0 (+https://cryptdox.com)'})
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=180) as res:
                return json.load(res)
        except urllib.error.URLError:
            if attempt == tries - 1:
                raise
            time.sleep(3 * (attempt + 1))


def load_rows(source: tuple[str, str]) -> list[tuple[int, int, str, str | None]]:
    kind, key = source
    if kind == 'alquran':
        surahs = fetch_json(f'https://api.alquran.cloud/v1/quran/{key}')['data']['surahs']
        return [(s['number'], a['numberInSurah'], a['text'].strip(), None) for s in surahs for a in s['ayahs']]
    rows = []
    for surah in range(1, 115):
        for a in fetch_json(f'https://quranenc.com/api/v1/translation/sura/{key}/{surah}')['result']:
            rows.append((int(a['sura']), int(a['aya']), a['translation'], a.get('footnotes') or None))
        time.sleep(0.3)
    return rows


def build(slug: str, t: dict, rows: list) -> list[str]:
    pack_id = str(uuid.uuid5(NS, f'translation:{slug}'))
    if len(rows) != 6236 or len({(s, a) for s, a, *_ in rows}) != 6236:
        raise SystemExit(f'{slug}: unexpected text ({len(rows)} ayahs)')
    head = f"""INSERT INTO is_content_packs (id, kind, slug, language, name, author, source_url, license, is_stored, is_default, review_status, sort_order)
VALUES ({sql(pack_id)}, 'quran_translation', {sql(slug)}, {sql(t['language'])}, {sql(t['name'])}, {sql(t['author'])},
        {sql(t['source_url'])}, {sql(t['license'])}, true, {sql(t['default'])}, 'in_review', {t['sort']})
ON CONFLICT (id) DO NOTHING;
"""
    if t['default']:
        head += (f"-- The default {t['language']} translation from now on.\n"
                 f"UPDATE is_content_packs SET is_default = false WHERE kind = 'quran_translation' AND language = {sql(t['language'])} AND id <> {sql(pack_id)};\n")

    # Statements of ~100 ayahs, grouped into parts under PART_BYTES.
    statements = []
    for i in range(0, len(rows), 100):
        values = ',\n  '.join(f"({sql(pack_id)}, {s}, {a}, {sql(text)}, {sql(note)})" for s, a, text, note in rows[i:i + 100])
        statements.append(f"INSERT INTO is_translation_ayahs (pack_id, surah, ayah, text, note) VALUES\n  {values}\nON CONFLICT DO NOTHING;\n")
    parts: list[list[str]] = [[]]
    size = len(head.encode())
    for st in statements:
        n = len(st.encode())
        if parts[-1] and size + n > PART_BYTES:
            parts.append([])
            size = 0
        parts[-1].append(st)
        size += n

    total = len(parts)
    out = []
    for i, body in enumerate(parts, 1):
        label = f' (part {i} of {total})' if total > 1 else ''
        text = f"""-- {t['name']['en']}{label}: the Quran translation stored in our database.
-- Generated by islamic_studio_translation.py; run after 078_is_stored_translations.sql{', parts in order' if total > 1 else ''}.
-- Safe to run again. Approve the pack in batools → Content Review to show it in the app.

BEGIN;
{head if i == 1 else ''}
{''.join(body)}
COMMIT;

SELECT {sql(slug)} AS pack, count(*) AS ayahs_stored, 6236 AS ayahs_total FROM is_translation_ayahs WHERE pack_id = {sql(pack_id)};
"""
        out.append(text)
    return out


if __name__ == '__main__':
    for slug in sys.argv[1:] or list(TRANSLATIONS):
        t = TRANSLATIONS[slug]
        parts = build(slug, t, load_rows(t['source']))
        for old in HERE.glob(f'islamic_studio_translation_{slug}*.sql'):
            old.unlink()
        for i, text in enumerate(parts, 1):
            name = f'islamic_studio_translation_{slug}' + (f'_part{i}' if len(parts) > 1 else '') + '.sql'
            (HERE / name).write_text(text)
            print(f'✔ {name} ({len(text.encode()) // 1024} KB)')
