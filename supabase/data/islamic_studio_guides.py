#!/usr/bin/env python3
"""
Writes islamic_studio_guides_part1.sql, _part2.sql, … (run after migration 097,
in any order — each part is small enough for the Supabase SQL editor): the app's Guide,
the 99 Names of Allah and Islamic names, from the JSON files in guides/
(format: guides/FORMAT.md).

Everything goes in as 'in_review': the app shows it only after approval in
batools → Guide & Names (or Content Review for guides). Re-runnable: fixed
ids and natural keys, nothing already there is overwritten.

    python3 islamic_studio_guides.py          # checks the files, then writes the SQL
"""
import json
import sys
import uuid
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC = HERE / 'guides'
OUT = 'islamic_studio_guides_part{}.sql'
PART_BYTES = 400_000  # the SQL editor refuses a query of about 1.5 MB
NS = uuid.UUID('3c0d6a52-8f1e-4b7a-9d2c-5e4f6a7b8c90')
TOPICS = ['taharah', 'salah', 'special_salah', 'kalima', 'sawm', 'zakat', 'hajj', 'umrah', 'qurbani', 'janazah', 'fazilat']
TEXT_FIELDS = {
    'heading': ['text'], 'text': ['text'], 'step': ['title'], 'arabic': [], 'list': [], 'table': [],
    'note': ['text'], 'differ': ['title'], 'ref': ['text'],
}
problems: list[str] = []


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
    return str(uuid.uuid5(NS, f'{kind}:{key}'))


def text_ok(v, where: str, required=True) -> None:
    if v is None and not required:
        return
    if not isinstance(v, dict) or not str(v.get('bn', '')).strip():
        problems.append(f'{where}: needs {{"bn": …}} text')


def check_block(b: dict, where: str) -> None:
    kind = b.get('type')
    if kind not in TEXT_FIELDS:
        problems.append(f'{where}: unknown block type {kind!r}')
        return
    for f in TEXT_FIELDS[kind]:
        text_ok(b.get(f), f'{where}.{f}')
    if kind == 'arabic':
        if not str(b.get('ar', '')).strip():
            problems.append(f'{where}: arabic block without "ar"')
        text_ok(b.get('meaning'), f'{where}.meaning', required=False)
    elif kind == 'list':
        if not b.get('items'):
            problems.append(f'{where}: empty list')
        for j, it in enumerate(b.get('items') or []):
            text_ok(it, f'{where}.items[{j}]')
    elif kind == 'table':
        head = b.get('head') or []
        for j, row in enumerate(b.get('rows') or []):
            if len(row) != len(head):
                problems.append(f'{where}.rows[{j}]: {len(row)} cells for {len(head)} columns')
    elif kind == 'differ':
        if len(b.get('views') or []) < 2:
            problems.append(f'{where}: a differ block needs at least 2 views')
        for j, v in enumerate(b.get('views') or []):
            text_ok(v.get('label'), f'{where}.views[{j}].label')
            text_ok(v.get('text'), f'{where}.views[{j}].text')


def guides() -> list[str]:
    lines, seen = [], set()
    for t_i, topic in enumerate(TOPICS):
        path = SRC / f'{topic}.json'
        if not path.exists():
            print(f'  (no {path.name} yet)')
            continue
        data = json.loads(path.read_text())
        if data.get('topic') != topic:
            problems.append(f'{path.name}: topic is {data.get("topic")!r}, expected {topic!r}')
        for g_i, g in enumerate(data.get('guides', [])):
            slug = g.get('slug', '')
            where = f'{path.name}:{slug or g_i}'
            if slug in seen:
                problems.append(f'{where}: duplicate slug')
            seen.add(slug)
            text_ok(g.get('title'), f'{where}.title')
            if g.get('level', 'basic') not in ('basic', 'detail'):
                problems.append(f'{where}: level must be basic or detail')
            for b_i, b in enumerate(g.get('blocks', [])):
                check_block(b, f'{where}.blocks[{b_i}]')
            lines.append(
                'INSERT INTO is_guides (id, topic_id, slug, title, summary, level, blocks, review_status, sort_order) '
                f"SELECT {sql(uid('guide', slug))}, id, {sql(slug)}, {sql(g['title'])}, {sql(g.get('summary') or {})}, "
                f"{sql(g.get('level', 'basic'))}, {sql(g.get('blocks', []))}, 'in_review', {(g_i + 1) * 10} "
                f"FROM is_guide_topics WHERE slug = {sql(topic)} ON CONFLICT (slug) DO NOTHING;")
        print(f'  {path.name}: {len(data.get("guides", []))} guides')
    return lines


def allah_names() -> list[str]:
    path = SRC / 'allah_names.json'
    if not path.exists():
        print(f'  (no {path.name} yet)')
        return []
    names = json.loads(path.read_text())
    if sorted(n.get('n') for n in names) != list(range(1, 100)):
        problems.append(f'{path.name}: n must be exactly 1..99')
    lines = []
    for n in names:
        where = f'{path.name}:{n.get("n")}'
        text_ok(n.get('pron'), f'{where}.pron')
        text_ok(n.get('meaning'), f'{where}.meaning')
        lines.append(
            'INSERT INTO is_allah_names (id, n, ar, pron, meaning, note, ref, review_status) VALUES ('
            f"{sql(uid('allah', str(n['n'])))}, {n['n']}, {sql(n['ar'])}, {sql(n['pron'])}, {sql(n['meaning'])}, "
            f"{sql(n.get('note') or {})}, {sql(n.get('ref') or {})}, 'in_review') ON CONFLICT (n) DO NOTHING;")
    print(f'  {path.name}: {len(names)} names')
    return lines


def islamic_names() -> list[str]:
    path = SRC / 'islamic_names.json'
    if not path.exists():
        print(f'  (no {path.name} yet)')
        return []
    names = json.loads(path.read_text())
    lines, seen = [], set()
    for i, n in enumerate(names):
        key = (str(n.get('en', '')).strip().lower(), n.get('gender'))
        where = f'{path.name}:{n.get("en")}'
        if n.get('gender') not in ('boy', 'girl'):
            problems.append(f'{where}: gender must be boy or girl')
        if key in seen:
            problems.append(f'{where}: duplicate ({key[1]})')
        seen.add(key)
        text_ok(n.get('meaning'), f'{where}.meaning')
        lines.append(
            'INSERT INTO is_islamic_names (id, gender, bn, en, ar, meaning, note, review_status, sort_order) VALUES ('
            f"{sql(uid('name', f'{key[1]}:{key[0]}'))}, {sql(n['gender'])}, {sql(n['bn'])}, {sql(n['en'])}, {sql(n.get('ar'))}, "
            f"{sql(n['meaning'])}, {sql(n.get('note') or {})}, 'in_review', {i}) ON CONFLICT (en, gender) DO NOTHING;")
    boys = sum(1 for n in names if n.get('gender') == 'boy')
    print(f'  {path.name}: {boys} boys, {len(names) - boys} girls')
    return lines


def main() -> None:
    body = guides() + allah_names() + islamic_names()
    if problems:
        print(f'\n{len(problems)} problem(s):')
        for p in problems:
            print('  -', p)
        sys.exit(1)
    parts, size = [[]], 0
    for line in body:
        n = len(line.encode())
        if parts[-1] and size + n > PART_BYTES:
            parts.append([])
            size = 0
        parts[-1].append(line)
        size += n
    for old in HERE.glob('islamic_studio_guides*.sql'):
        old.unlink()
    for i, lines in enumerate(parts, 1):
        (HERE / OUT.format(i)).write_text(
            '-- Generated by islamic_studio_guides.py — do not edit by hand.\n'
            f'-- Guide, 99 Names of Allah and Islamic names (migration 097), all in review. Part {i} of {len(parts)}.\n'
            'BEGIN;\n' + '\n'.join(lines) + '\nCOMMIT;\n')
        print(f'wrote {OUT.format(i)}: {len(lines)} rows')

if __name__ == '__main__':
    main()
