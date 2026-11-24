# Islamic Studio: Guide, 99 Names and Islamic Names content format

Content files for migration 097. `islamic_studio_guides.py` turns them into SQL; everything is seeded with
`review_status = 'pending'`, so nothing shows in the app until it is approved in batools.

## Rules for every file

- **Language:** every text field is `{"bn": "...", "en": "..."}`. Bangla is the main language: natural, simple
  Bangladeshi Bangla, not machine-like. English is shorter but complete.
- **Fiqh approach: neutral and evidence-based.** State what is agreed. Where scholars differ (madhhabs), do not
  pick a side: use a `differ` block that shows each view with its evidence. Hanafi practice (most of
  Bangladesh) is always one of the views shown.
- **Arabic:** full harakat (tashkeel) on every Arabic text. Quran text exactly as in the Mushaf.
- **Bangla pronunciation (`pron.bn`):** the usual Bangladeshi transliteration style (as in common dua books).
- **Sources:** cite only references you are sure of: Quran as `সূরা বাকারা ২:১৮৩` / `Al-Baqarah 2:183`;
  hadith as `সহিহ বুখারি ৬৩১` / `Sahih al-Bukhari 631` (book + number, standard numbering as on sunnah.com).
  If you are not certain of a number, give only the book name and set `"check": true` on that block.
  Never invent a hadith or a reference. Avoid fabricated (মাওজু) or very weak narrations for fazilat; if a
  well-known fazilat is weak, either skip it or say so in a `note`.
- **Niyyah:** say clearly that niyyah is the intention in the heart and saying it aloud is not required; you may show a
  commonly used Bangla phrasing as an example, labelled as such.
- Valid JSON (UTF-8), no comments, no trailing commas.

## Guide files: `guides/<topic>.json`

Topics (fixed slugs): `taharah` (ওযু, গোসল, তায়াম্মুম), `salah` (নামাজ), `special_salah` (বিশেষ নামাজ),
`kalima` (কালিমা ও ঈমান), `sawm` (রোজা), `zakat` (যাকাত ও সদকা), `hajj` (হজ), `umrah` (উমরাহ),
`qurbani` (কুরবানি ও আকিকা), `janazah` (মৃত্যু ও জানাযা), `fazilat` (ফজিলত).

```json
{
  "topic": "salah",
  "guides": [
    {
      "slug": "salah-step-by-step",
      "title": {"bn": "...", "en": "..."},
      "summary": {"bn": "one or two sentences", "en": "..."},
      "level": "basic",
      "blocks": [ ... ]
    }
  ]
}
```

`slug`: lowercase-hyphen, unique across all files. `level`: `basic` | `detail`. A guide is one screen a
reader finishes in 2–10 minutes; split big subjects into several guides (in reading order).

### Blocks

| type | fields | use |
|---|---|---|
| `heading` | `text` | a sub-heading inside a guide |
| `text` | `text` | a paragraph |
| `step` | `title`, `text` | a numbered step (numbers are added by the app, in order) |
| `arabic` | `ar`, `pron`, `meaning`, optional `label`, optional `ref` | Arabic text (dua, ayah, tasbih) with Bangla/English pronunciation and meaning |
| `list` | `items` (array of `{bn,en}`) | bullet list |
| `table` | `head` (array of `{bn,en}`), `rows` (array of arrays of `{bn,en}`) | e.g. rakat per prayer |
| `note` | `tone` (`info` \| `warn` \| `tip`), `text` | a highlighted note |
| `differ` | `title`, `views`: array of `{label, text, evidence}` | a point where scholars differ; each view with its evidence |
| `ref` | `text` | a source line (Quran / hadith reference) |

Any block may carry `"check": true` when a reference needs a scholar's check.

Example:

```json
{"type": "arabic", "label": {"bn": "সানা", "en": "Thana"},
 "ar": "سُبْحَانَكَ اللّٰهُمَّ وَبِحَمْدِكَ ...",
 "pron": {"bn": "সুবহানাকা আল্লাহুম্মা ওয়া বিহামদিকা ...", "en": "Subhanakallahumma wa bihamdika ..."},
 "meaning": {"bn": "...", "en": "..."},
 "ref": {"bn": "সুনান আবু দাউদ ৭৭৬", "en": "Sunan Abi Dawud 776"}}
```

## 99 Names: `allah_names.json`

The commonly listed 99 names (the Tirmidhi list, 3507), in that order:

```json
[{"n": 1, "ar": "الرَّحْمٰنُ", "pron": {"bn": "আর-রহমান", "en": "Ar-Rahman"},
  "meaning": {"bn": "পরম দয়াময়", "en": "The Most Gracious"},
  "note": {"bn": "short explanation, ideally with a Quran ayah where the name occurs", "en": "..."},
  "ref": {"bn": "সূরা ফাতিহা ১:৩", "en": "Al-Fatihah 1:3"}}]
```

## Islamic names: `islamic_names.json`

```json
[{"bn": "আবদুল্লাহ", "en": "Abdullah", "ar": "عَبْدُ اللّٰه", "gender": "boy",
  "meaning": {"bn": "আল্লাহর বান্দা", "en": "Servant of Allah"},
  "note": {"bn": "optional: e.g. name of a Sahabi", "en": "..."}}]
```

`gender`: `boy` | `girl`. Only names with good meanings; never names that imply servitude to other than Allah
(e.g. আবদুন নবী, গোলাম রসুল) or bad meanings. `en` is the usual English spelling. Unique by (`en`, `gender`).
