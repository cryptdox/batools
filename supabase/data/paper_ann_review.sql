-- Everything for one paper, in one go:
--   "Artificial Neural Networks from Classical Models to Foundation Models:
--    A Systematic Review and Bibliometric Analysis" (under review)
-- Run in the Supabase SQL editor (needs migrations up to 073). Safe to re-run.
--
-- Facts are from the submitted manuscript (Manuscript_updated_by_abir, October
-- 2026). Kept as they are: title, authors and status. The abstract is replaced
-- with the submitted one (English and Bangla). The case study and challenges
-- added earlier by data part 4 are replaced with fuller ones, but only rows
-- nobody has edited since.

BEGIN;

------------------------------------------------------------------------------
-- 1. The paper: abstract, key findings, contribution, methods, keywords
------------------------------------------------------------------------------
UPDATE pf_publications SET
  title_bn = 'ক্লাসিক্যাল মডেল থেকে ফাউন্ডেশন মডেল পর্যন্ত কৃত্রিম নিউরাল নেটওয়ার্ক: একটি পদ্ধতিগত পর্যালোচনা ও বিবলিওমেট্রিক বিশ্লেষণ',
  abstract_en = $t$<p>Artificial Neural Networks (ANNs) have evolved from single threshold units into the deep, attention-based and foundation-model architectures underpinning contemporary Artificial Intelligence. Existing reviews typically cover either classical models or a single modern family, rarely report a reproducible selection protocol and seldom compare architectures quantitatively. We address these gaps with a PRISMA 2020-guided systematic review and a bibliometric analysis. Records were retrieved from OpenAlex and cross-checked in IEEE Xplore and SpringerLink; after citation-based stratification, screening and quality assessment, 396 studies were included in the qualitative synthesis and 1,118,496 records in the bibliometric analysis.</p><p>Seven research questions guide the synthesis, covering architectural evolution, taxonomy, comparative performance and cost, applications, evaluation, challenges and emerging directions. We propose an integrated taxonomy organizing ANNs by architecture, learning paradigm, optimization, application and deployment that retains the classical algorithm families. Classical models are summarized concisely, with step-by-step algorithms in an appendix; modern architectures (CNNs, recurrent networks, autoencoders, GANs, diffusion models, graph neural networks, Transformers, spiking networks, neural operators and state-space models) are compared on performance, interpretability, computational cost, scalability, data requirements, robustness and deployment suitability.</p><p>Open challenges, including explainability, distribution shift, data scarcity, energy consumption, bias, privacy, adversarial vulnerability and hallucination, are analysed against published evidence and the limitations of current solutions. The review closes with a conceptual framework spanning data, learning, architecture, evaluation, deployment and continuous adaptation, and a prioritized research agenda.</p>$t$,
  abstract_bn = $t$<p>কৃত্রিম নিউরাল নেটওয়ার্ক (ANN) একক থ্রেশহোল্ড ইউনিট থেকে আজকের কৃত্রিম বুদ্ধিমত্তার ভিত্তি গভীর, অ্যাটেনশন-ভিত্তিক ও ফাউন্ডেশন-মডেল আর্কিটেকচারে বিকশিত হয়েছে। বিদ্যমান পর্যালোচনাগুলো সাধারণত হয় ক্লাসিক্যাল মডেল, নয় একটি আধুনিক পরিবার নিয়ে কাজ করে, পুনরুৎপাদনযোগ্য নির্বাচন পদ্ধতি খুব কমই জানায় এবং আর্কিটেকচারগুলোর সংখ্যাগত তুলনা কম করে। PRISMA 2020-নির্দেশিত পদ্ধতিগত পর্যালোচনা ও বিবলিওমেট্রিক বিশ্লেষণে আমরা এই ঘাটতিগুলো পূরণ করেছি: OpenAlex থেকে রেকর্ড সংগ্রহ করে IEEE Xplore ও SpringerLink-এ যাচাই, এবং স্ক্রিনিং ও মান-মূল্যায়নের পর ৩৯৬টি গবেষণা গুণগত সংশ্লেষণে ও ১১,১৮,৪৯৬টি রেকর্ড বিবলিওমেট্রিক বিশ্লেষণে অন্তর্ভুক্ত।</p><p>সাতটি গবেষণা প্রশ্ন সংশ্লেষণকে পরিচালনা করে: আর্কিটেকচারের বিবর্তন, শ্রেণিবিন্যাস, তুলনামূলক কার্যকারিতা ও খরচ, প্রয়োগ, মূল্যায়ন, চ্যালেঞ্জ ও উদীয়মান দিক। আমরা আর্কিটেকচার, লার্নিং প্যারাডাইম, অপ্টিমাইজেশন, প্রয়োগ ও ডিপ্লয়মেন্ট — এই পাঁচ মাত্রায় একটি সমন্বিত শ্রেণিবিন্যাস প্রস্তাব করেছি, যা ক্লাসিক্যাল অ্যালগরিদম পরিবারগুলোও ধরে রাখে, এবং CNN থেকে Transformer, ডিফিউশন, গ্রাফ, স্পাইকিং, নিউরাল অপারেটর ও স্টেট-স্পেস মডেল পর্যন্ত আধুনিক পরিবারগুলোর তুলনা করেছি।</p><p>ব্যাখ্যাযোগ্যতা, ডিস্ট্রিবিউশন শিফট, ডেটার স্বল্পতা, শক্তি খরচ, পক্ষপাত, গোপনীয়তা, প্রতিপক্ষ আক্রমণ ও হ্যালুসিনেশনের মতো উন্মুক্ত চ্যালেঞ্জ প্রকাশিত প্রমাণের আলোকে বিশ্লেষণ করা হয়েছে। পর্যালোচনাটি একটি ধারণাগত কাঠামো ও অগ্রাধিকারভিত্তিক গবেষণা কর্মসূচি দিয়ে শেষ হয়েছে।</p>$t$,
  highlights_en = ARRAY[
    'A PRISMA 2020-guided search of OpenAlex (cross-checked in IEEE Xplore and SpringerLink): 351,481 candidate records, 545 screened, 410 full texts assessed, 396 studies included.',
    'A bibliometric analysis of 1,118,496 records (1990–2025): 85.0% of the ANN literature appeared from 2017 onwards, with themes shifting to CNNs, transfer learning, graph networks and attention.',
    'Seven eras from the McCulloch–Pitts neuron to foundation models; each transition was gated by training methods, data and hardware, and traded built-in assumptions for scale.',
    'A five-dimension taxonomy (architecture, learning paradigm, optimization, application, deployment) that keeps the classical algorithm families beside the modern ones.',
    'No architecture family wins on every criterion: Transformers and foundation models lead at scale but cost the most; good design can cut parameters about fivefold and FLOPs about tenfold at equal accuracy.',
    'Healthcare is the most frequent domain (27.5%); computational cost is reported by fewer than half of the studies (43.9%) and energy use by only 3.5%.'
  ],
  highlights_bn = ARRAY[
    'PRISMA 2020-নির্দেশিত OpenAlex অনুসন্ধান (IEEE Xplore ও SpringerLink-এ যাচাই): ৩,৫১,৪৮১টি সম্ভাব্য রেকর্ড, ৫৪৫টি স্ক্রিনিং, ৪১০টি পূর্ণ পাঠ মূল্যায়ন, ৩৯৬টি গবেষণা অন্তর্ভুক্ত।',
    '১১,১৮,৪৯৬টি রেকর্ডের (১৯৯০–২০২৫) বিবলিওমেট্রিক বিশ্লেষণ: ANN গবেষণার ৮৫.০% ২০১৭ সাল থেকে প্রকাশিত, বিষয় সরে গেছে CNN, ট্রান্সফার লার্নিং, গ্রাফ নেটওয়ার্ক ও অ্যাটেনশনের দিকে।',
    'McCulloch–Pitts নিউরন থেকে ফাউন্ডেশন মডেল পর্যন্ত সাতটি যুগ; প্রতিটি পরিবর্তন নির্ভর করেছে প্রশিক্ষণ পদ্ধতি, ডেটা ও হার্ডওয়্যারের ওপর।',
    'পাঁচ মাত্রার শ্রেণিবিন্যাস (আর্কিটেকচার, লার্নিং প্যারাডাইম, অপ্টিমাইজেশন, প্রয়োগ, ডিপ্লয়মেন্ট), যেখানে আধুনিকের পাশে ক্লাসিক্যাল অ্যালগরিদম পরিবারও রয়েছে।',
    'কোনো আর্কিটেকচার পরিবার সব মানদণ্ডে সেরা নয়: Transformer ও ফাউন্ডেশন মডেল বড় পরিসরে এগিয়ে কিন্তু সবচেয়ে ব্যয়বহুল; ভালো নকশায় সমান নির্ভুলতায় প্যারামিটার প্রায় পাঁচ গুণ ও FLOPs প্রায় দশ গুণ কমে।',
    'স্বাস্থ্যসেবা সবচেয়ে বেশি দেখা প্রয়োগক্ষেত্র (২৭.৫%); গণনার খরচ জানায় অর্ধেকেরও কম গবেষণা (৪৩.৯%) এবং শক্তি ব্যবহার মাত্র ৩.৫%।'
  ],
  contributions_en = ARRAY[
    'Worked on the revision that turned the manuscript into a systematic review: the review protocol, research questions and two-tier search design.',
    'Ran the OpenAlex search and the citation-based selection, screened records and full texts, and prepared the PRISMA 2020 flow.',
    'Carried out the bibliometric analysis of over a million records (publication trends, keyword networks, thematic map and evolution).',
    'Built the comparative tables (landmark studies, efficiency, challenges) and verified every reference against its source.',
    'Prepared the response to the reviewers.'
  ],
  contributions_bn = ARRAY[
    'পাণ্ডুলিপিকে পদ্ধতিগত পর্যালোচনায় রূপ দেওয়ার সংশোধনে কাজ: পর্যালোচনা প্রটোকল, গবেষণা প্রশ্ন ও দুই স্তরের অনুসন্ধান নকশা।',
    'OpenAlex অনুসন্ধান ও সাইটেশন-ভিত্তিক নির্বাচন, রেকর্ড ও পূর্ণ পাঠ স্ক্রিনিং, এবং PRISMA 2020 প্রবাহ প্রস্তুত।',
    'দশ লাখেরও বেশি রেকর্ডের বিবলিওমেট্রিক বিশ্লেষণ (প্রকাশনার প্রবণতা, কীওয়ার্ড নেটওয়ার্ক, থিম্যাটিক ম্যাপ ও বিবর্তন)।',
    'তুলনামূলক সারণি (যুগান্তকারী গবেষণা, দক্ষতা, চ্যালেঞ্জ) তৈরি এবং প্রতিটি রেফারেন্স মূল উৎসের সাথে যাচাই।',
    'রিভিউয়ারদের জবাব প্রস্তুত।'
  ],
  methods = ARRAY['PRISMA 2020', 'Systematic Review', 'Bibliometric Analysis', 'OpenAlex API', 'IEEE Xplore', 'SpringerLink', 'Keyword Co-occurrence Network', 'Thematic Map', 'Python'],
  keywords = ARRAY['Artificial Neural Networks', 'Deep Learning', 'Systematic Review', 'Bibliometric Analysis', 'Taxonomy', 'Transformers', 'Foundation Models', 'Explainable AI', 'Computational Efficiency'],
  show_highlights = true, show_contributions = true, show_methods = true,
  show_case_study = true, show_challenges = true,
  updated_at = now()
WHERE user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60'
  AND title_en ILIKE 'Artificial Neural Networks from Classical Models to Foundation Models%';

------------------------------------------------------------------------------
-- 2. Case study (unedited earlier rows make way for the fuller story)
------------------------------------------------------------------------------
DELETE FROM pf_case_study_sections s
USING pf_publications p
WHERE s.publication_id = p.id AND s.updated_at = s.created_at
  AND p.user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60'
  AND p.title_en ILIKE 'Artificial Neural Networks from Classical Models to Foundation Models%'
  AND s.heading_en IN ('Problem', 'Approach', 'Results')
  AND s.created_at < now() - interval '1 minute';

INSERT INTO pf_case_study_sections (user_id, publication_id, heading_en, heading_bn, body_en, body_bn, sort_order)
SELECT p.user_id, p.id, v.heading_en, v.heading_bn, v.body_en, v.body_bn, v.ord
FROM pf_publications p
JOIN (VALUES
  (1, 'Problem', 'সমস্যা',
   '<p>Existing reviews of neural networks cover either classical models or a single modern family, <strong>rarely say how their literature was chosen</strong> and seldom compare architectures side by side beyond accuracy. Researchers and practitioners lack a reproducible, up-to-date account of how ANNs evolved, how they compare on cost and trust, and which problems remain open.</p>',
   '<p>নিউরাল নেটওয়ার্কের বিদ্যমান পর্যালোচনাগুলো হয় ক্লাসিক্যাল মডেল, নয় একটি আধুনিক পরিবার নিয়ে, <strong>সাহিত্য কীভাবে বাছাই হয়েছে তা খুব কমই জানায়</strong> এবং নির্ভুলতার বাইরে আর্কিটেকচারগুলোর পাশাপাশি তুলনা কম করে। ANN কীভাবে বিকশিত হলো, খরচ ও আস্থায় কীভাবে তুলনীয় এবং কোন সমস্যা অমীমাংসিত — তার পুনরুৎপাদনযোগ্য, হালনাগাদ বিবরণ নেই।</p>'),
  (2, 'Research questions', 'গবেষণা প্রশ্ন',
   '<p>Seven questions, fixed before the search: <strong>evolution</strong> (how architectures developed), <strong>taxonomy</strong> (how to organize them), <strong>comparison</strong> (performance, cost, interpretability), <strong>applications</strong>, <strong>evaluation</strong> (datasets and metrics), <strong>challenges</strong> and <strong>emerging directions</strong>. Each is answered in its own section and summarized in one table.</p>',
   '<p>অনুসন্ধানের আগেই নির্ধারিত সাতটি প্রশ্ন: <strong>বিবর্তন</strong>, <strong>শ্রেণিবিন্যাস</strong>, <strong>তুলনা</strong> (কার্যকারিতা, খরচ, ব্যাখ্যাযোগ্যতা), <strong>প্রয়োগ</strong>, <strong>মূল্যায়ন</strong> (ডেটাসেট ও মেট্রিক), <strong>চ্যালেঞ্জ</strong> ও <strong>উদীয়মান দিক</strong>। প্রতিটির উত্তর নিজস্ব অংশে এবং একটি সারণিতে সারসংক্ষেপ।</p>'),
  (3, 'Approach', 'পদ্ধতি',
   '<p>A <strong>PRISMA 2020-guided systematic review</strong> over OpenAlex (Scopus and Web of Science were not available), with the same query run in IEEE Xplore and SpringerLink to check coverage, last searched on 19 October 2026. A <strong>two-tier design</strong> keeps it reproducible: Tier 1 (1,118,496 records, 1990–2025) feeds the bibliometric analysis; Tier 2 selects the most cited studies of each year (with a relaxed threshold for recent years and a separate stratum for reviews) for screening, quality assessment and data extraction.</p>',
   '<p>OpenAlex-এ <strong>PRISMA 2020-নির্দেশিত পদ্ধতিগত পর্যালোচনা</strong> (Scopus ও Web of Science পাওয়া যায়নি), কভারেজ যাচাইয়ে IEEE Xplore ও SpringerLink-এ একই অনুসন্ধান; শেষ অনুসন্ধান ১৯ অক্টোবর ২০২৬। <strong>দুই স্তরের নকশা</strong> এটিকে পুনরুৎপাদনযোগ্য রাখে: স্তর ১ (১১,১৮,৪৯৬টি রেকর্ড, ১৯৯০–২০২৫) বিবলিওমেট্রিক বিশ্লেষণে; স্তর ২ প্রতি বছরের সর্বাধিক উদ্ধৃত গবেষণা বাছাই করে স্ক্রিনিং, মান-মূল্যায়ন ও তথ্য সংগ্রহে।</p>'),
  (4, 'Results', 'ফলাফল',
   '<p><strong>396 studies</strong> included and <strong>1,118,496 records</strong> analysed bibliometrically, with 85.0% of the literature published since 2017. The review traces <strong>seven eras</strong> of ANN evolution, proposes a <strong>five-dimension taxonomy</strong>, compares modern families in 22 comparative tables, and maps <strong>ten open challenges</strong> to a prioritized research agenda and a life-cycle conceptual framework.</p>',
   '<p><strong>৩৯৬টি গবেষণা</strong> অন্তর্ভুক্ত এবং <strong>১১,১৮,৪৯৬টি রেকর্ড</strong> বিবলিওমেট্রিকভাবে বিশ্লেষিত, যার ৮৫.০% ২০১৭ সাল থেকে প্রকাশিত। পর্যালোচনাটি ANN বিবর্তনের <strong>সাতটি যুগ</strong> চিহ্নিত করে, <strong>পাঁচ মাত্রার শ্রেণিবিন্যাস</strong> প্রস্তাব করে, ২২টি তুলনামূলক সারণিতে আধুনিক পরিবারগুলোর তুলনা করে এবং <strong>দশটি উন্মুক্ত চ্যালেঞ্জকে</strong> অগ্রাধিকারভিত্তিক গবেষণা কর্মসূচি ও জীবনচক্র কাঠামোর সাথে যুক্ত করে।</p>'),
  (5, 'What the evidence says', 'প্রমাণ যা বলে',
   '<ul><li><p><strong>No family dominates:</strong> Transformers and foundation models lead at scale but are the most costly, data-hungry and opaque; CNNs and recurrent networks stay efficient with moderate data; classical and spiking networks suit transparent or very low-energy settings.</p></li><li><p><strong>Design beats brute force:</strong> parameters can drop about fivefold and FLOPs about tenfold at equal accuracy (EfficientNet-B0 vs ResNet-50).</p></li><li><p><strong>Reporting gaps:</strong> healthcare is the most frequent domain (27.5%), but cost is reported by 43.9% of studies and energy by 3.5%, which limits fair comparison.</p></li></ul>',
   '<ul><li><p><strong>কোনো পরিবার একচ্ছত্র নয়:</strong> Transformer ও ফাউন্ডেশন মডেল বড় পরিসরে এগিয়ে কিন্তু সবচেয়ে ব্যয়বহুল, ডেটা-নির্ভর ও অস্বচ্ছ; মাঝারি ডেটায় CNN ও রিকারেন্ট নেটওয়ার্ক দক্ষ; স্বচ্ছতা বা খুব কম শক্তির প্রয়োজনে ক্লাসিক্যাল ও স্পাইকিং নেটওয়ার্ক।</p></li><li><p><strong>নকশাই আসল:</strong> সমান নির্ভুলতায় প্যারামিটার প্রায় পাঁচ গুণ ও FLOPs প্রায় দশ গুণ কমানো যায় (EfficientNet-B0 বনাম ResNet-50)।</p></li><li><p><strong>রিপোর্টিংয়ের ঘাটতি:</strong> স্বাস্থ্যসেবা সবচেয়ে বেশি দেখা ক্ষেত্র (২৭.৫%), কিন্তু খরচ জানায় ৪৩.৯% ও শক্তি মাত্র ৩.৫% গবেষণা, যা ন্যায্য তুলনা সীমিত করে।</p></li></ul>'),
  (6, 'Open challenges & agenda', 'উন্মুক্ত চ্যালেঞ্জ ও কর্মসূচি',
   '<p>Ten challenges in three coupled groups: <strong>reliability</strong> (distribution shift, adversarial vulnerability, poor calibration, hallucination), <strong>resources</strong> (data scarcity, energy and compute, continual learning) and <strong>societal acceptability</strong> (explainability, bias, privacy). Their solutions trade off against one another and are partly immature. The agenda prioritizes faithful explanation, robustness under shift, standardized efficiency reporting, reproducible evidence and grounded foundation models.</p>',
   '<p>তিনটি পরস্পর-সংযুক্ত দলে দশটি চ্যালেঞ্জ: <strong>নির্ভরযোগ্যতা</strong> (ডিস্ট্রিবিউশন শিফট, প্রতিপক্ষ আক্রমণ, দুর্বল ক্যালিব্রেশন, হ্যালুসিনেশন), <strong>সম্পদ</strong> (ডেটার স্বল্পতা, শক্তি ও গণনা, ক্রমাগত শিক্ষা) এবং <strong>সামাজিক গ্রহণযোগ্যতা</strong> (ব্যাখ্যাযোগ্যতা, পক্ষপাত, গোপনীয়তা)। কর্মসূচি অগ্রাধিকার দেয় বিশ্বস্ত ব্যাখ্যা, শিফটে দৃঢ়তা, মানসম্মত দক্ষতা রিপোর্টিং, পুনরুৎপাদনযোগ্য প্রমাণ ও ভিত্তিশীল ফাউন্ডেশন মডেলকে।</p>'),
  (7, 'Limitations', 'সীমাবদ্ধতা',
   '<ul><li><p>English-language work indexed in OpenAlex only; IEEE Xplore and SpringerLink checked coverage, but other work may be missing.</p></li><li><p>Citation thresholds favour influential studies and may under-represent recent or niche work.</p></li><li><p>119 of 529 full texts (22.5%), mostly from Elsevier journals, could not be retrieved.</p></li><li><p>Screening and extraction by a single reviewer, so no inter-rater agreement; cross-architecture comparisons come from different datasets and show tendencies, not controlled tests.</p></li></ul>',
   '<ul><li><p>শুধু OpenAlex-এ সূচিভুক্ত ইংরেজি গবেষণা; IEEE Xplore ও SpringerLink-এ কভারেজ যাচাই হলেও অন্য গবেষণা বাদ পড়তে পারে।</p></li><li><p>সাইটেশন-সীমা প্রভাবশালী গবেষণাকে প্রাধান্য দেয়, সাম্প্রতিক বা বিশেষায়িত কাজ কম আসতে পারে।</p></li><li><p>৫২৯টি পূর্ণ পাঠের ১১৯টি (২২.৫%), বেশিরভাগ Elsevier জার্নালের, পাওয়া যায়নি।</p></li><li><p>একজন রিভিউয়ারের স্ক্রিনিং ও তথ্য সংগ্রহ, তাই আন্তঃমূল্যায়নকারী মতৈক্য নেই; আর্কিটেকচার তুলনা ভিন্ন ডেটাসেটের ফলাফলভিত্তিক, তাই প্রবণতা দেখায়, নিয়ন্ত্রিত পরীক্ষা নয়।</p></li></ul>')
) AS v(ord, heading_en, heading_bn, body_en, body_bn) ON true
WHERE p.user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60'
  AND p.title_en ILIKE 'Artificial Neural Networks from Classical Models to Foundation Models%'
  AND NOT EXISTS (
    SELECT 1 FROM pf_case_study_sections s WHERE s.publication_id = p.id AND s.heading_en = v.heading_en
  );

------------------------------------------------------------------------------
-- 3. Challenges & solutions (unedited earlier rows make way, too)
------------------------------------------------------------------------------
DELETE FROM pf_challenges c
USING pf_publications p
WHERE c.publication_id = p.id AND c.updated_at = c.created_at
  AND p.user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60'
  AND p.title_en ILIKE 'Artificial Neural Networks from Classical Models to Foundation Models%'
  AND c.sort_order IN (1, 2)
  AND c.created_at < now() - interval '1 minute';

INSERT INTO pf_challenges (user_id, publication_id, challenge_en, challenge_bn, solution_en, solution_bn, result_en, result_bn, sort_order)
SELECT p.user_id, p.id, v.c_en, v.c_bn, v.s_en, v.s_bn, v.r_en, v.r_bn, v.ord
FROM pf_publications p
JOIN (VALUES
  (1,
   '<p>The first version was a descriptive survey without a reproducible method, which reviewers rightly flagged as its main weakness.</p>',
   '<p>প্রথম সংস্করণ ছিল পুনরুৎপাদনযোগ্য পদ্ধতিহীন বর্ণনামূলক জরিপ, যা রিভিউয়াররা ঠিকভাবেই প্রধান দুর্বলতা হিসেবে চিহ্নিত করেছিলেন।</p>',
   '<p>Rebuilt it as a PRISMA 2020-guided systematic review: a protocol and research questions fixed before the search, exact search strings, inclusion and exclusion criteria, quality assessment and a documented flow diagram.</p>',
   '<p>PRISMA 2020-নির্দেশিত পদ্ধতিগত পর্যালোচনা হিসেবে নতুন করে তৈরি: অনুসন্ধানের আগে নির্ধারিত প্রটোকল ও গবেষণা প্রশ্ন, নির্দিষ্ট অনুসন্ধান-স্ট্রিং, অন্তর্ভুক্তি ও বাদের মানদণ্ড, মান-মূল্যায়ন এবং নথিভুক্ত প্রবাহচিত্র।</p>',
   '<p>A review whose every number can be traced and repeated.</p>',
   '<p>এমন পর্যালোচনা, যার প্রতিটি সংখ্যা খুঁজে পাওয়া ও পুনরায় করা যায়।</p>'),
  (2,
   '<p>Hundreds of thousands of candidate papers: far too many to screen by hand.</p>',
   '<p>লক্ষাধিক সম্ভাব্য গবেষণাপত্র: হাতে স্ক্রিনিংয়ের জন্য অনেক বেশি।</p>',
   '<p>A two-tier design: the full set (over a million records) for the bibliometric analysis, and the most cited studies of each year, with a relaxed threshold for recent years and a stratum for reviews, for the qualitative review.</p>',
   '<p>দুই স্তরের নকশা: বিবলিওমেট্রিক বিশ্লেষণে পুরো সেট (দশ লাখেরও বেশি রেকর্ড), আর গুণগত পর্যালোচনায় প্রতি বছরের সর্বাধিক উদ্ধৃত গবেষণা, সাম্প্রতিক বছরে শিথিল সীমা ও পর্যালোচনার জন্য আলাদা স্তরসহ।</p>',
   '<p>545 records screened, 410 assessed in full, 396 included.</p>',
   '<p>৫৪৫টি রেকর্ড স্ক্রিনিং, ৪১০টি পূর্ণ মূল্যায়ন, ৩৯৬টি অন্তর্ভুক্ত।</p>'),
  (3,
   '<p>Scopus and Web of Science, the usual review databases, were not available through the institution.</p>',
   '<p>পর্যালোচনার প্রচলিত ডেটাবেস Scopus ও Web of Science প্রতিষ্ঠানের মাধ্যমে পাওয়া যায়নি।</p>',
   '<p>Used OpenAlex, an open index of over 250 million works with a reproducible API, and ran the same query in IEEE Xplore and SpringerLink to check coverage.</p>',
   '<p>OpenAlex ব্যবহার — ২৫ কোটিরও বেশি গবেষণার উন্মুক্ত সূচক, পুনরুৎপাদনযোগ্য API-সহ — এবং কভারেজ যাচাইয়ে IEEE Xplore ও SpringerLink-এ একই অনুসন্ধান।</p>',
   '<p>The 150 most cited IEEE Xplore records of each year were all indexed in OpenAlex.</p>',
   '<p>প্রতি বছরের সর্বাধিক উদ্ধৃত ১৫০টি IEEE Xplore রেকর্ডের সবই OpenAlex-এ সূচিভুক্ত পাওয়া গেছে।</p>'),
  (4,
   '<p>Textbook-style explanations of each classical algorithm made the review long and descriptive.</p>',
   '<p>প্রতিটি ক্লাসিক্যাল অ্যালগরিদমের পাঠ্যবই-ধাঁচের ব্যাখ্যা পর্যালোচনাকে দীর্ঘ ও বর্ণনামূলক করেছিল।</p>',
   '<p>Condensed the classical sections by about 45%, moved step-by-step algorithms and formulations to appendices, and replaced per-model pros and cons with one comparative table.</p>',
   '<p>ক্লাসিক্যাল অংশ প্রায় ৪৫% সংক্ষিপ্ত, ধাপে ধাপে অ্যালগরিদম ও সূত্র পরিশিষ্টে, এবং মডেলভিত্তিক সুবিধা-অসুবিধার বদলে একটি তুলনামূলক সারণি।</p>',
   '<p>The main text now asks what the evidence shows rather than restating algorithms.</p>',
   '<p>মূল লেখা এখন অ্যালগরিদম পুনরাবৃত্তি না করে প্রমাণ কী বলে তা দেখায়।</p>'),
  (5,
   '<p>Reviewers asked for verified references and reproducible bibliometric numbers.</p>',
   '<p>রিভিউয়াররা যাচাইকৃত রেফারেন্স ও পুনরুৎপাদনযোগ্য বিবলিওমেট্রিক সংখ্যা চেয়েছিলেন।</p>',
   '<p>Checked every reference against its source and computed the bibliometric indicators directly from the OpenAlex data, with the search log and screening decisions kept as supplementary material.</p>',
   '<p>প্রতিটি রেফারেন্স মূল উৎসের সাথে যাচাই, OpenAlex ডেটা থেকে সরাসরি বিবলিওমেট্রিক সূচক গণনা, এবং অনুসন্ধান-লগ ও স্ক্রিনিং সিদ্ধান্ত সম্পূরক উপাদান হিসেবে সংরক্ষণ।</p>',
   '<p>A fully verified reference list and traceable bibliometric results.</p>',
   '<p>সম্পূর্ণ যাচাইকৃত রেফারেন্স তালিকা ও খুঁজে পাওয়া যায় এমন বিবলিওমেট্রিক ফলাফল।</p>')
) AS v(ord, c_en, c_bn, s_en, s_bn, r_en, r_bn) ON true
WHERE p.user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60'
  AND p.title_en ILIKE 'Artificial Neural Networks from Classical Models to Foundation Models%'
  AND NOT EXISTS (
    SELECT 1 FROM pf_challenges c WHERE c.publication_id = p.id AND c.sort_order = v.ord
  );

COMMIT;
