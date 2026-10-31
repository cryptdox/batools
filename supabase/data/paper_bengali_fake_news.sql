-- Everything for one paper, in one go:
--   "Combating deep-fake news in Bengali: detection and prevention of
--    manipulated social media's content using machine learning"
--   (International Journal of Advanced Computer Research 16(76), 2026,
--    doi:10.19101/IJACR.2025.1570025)
-- Run in the Supabase SQL editor (needs migrations up to 073). Safe to re-run.
--
-- Facts are from the published paper. Kept as they are: title, authors, venue,
-- DOI, links, abstract and BibTeX. The case study and challenges added earlier
-- by data part 4 are replaced with fuller ones, but only rows nobody has edited
-- since (edited rows stay, and a new one with the same heading is not added).

BEGIN;

------------------------------------------------------------------------------
-- 1. The paper: key findings, contribution, methods, keywords, switches
------------------------------------------------------------------------------
UPDATE pf_publications SET
  highlights_en = ARRAY[
    'Fine-tuned Bangla BERT: 94.49% accuracy, 89.03% F1, 90.28% recall, 98.36% ROC-AUC, 96.51% PR-AUC and 85.35% Cohen''s kappa.',
    'Classical baselines on TF-IDF: Logistic Regression 91.38%, Gradient Boosting 90.61%, Random Forest 90.23% and Decision Tree 86.62% accuracy.',
    'Bangla BERT catches far more fake news: 90.28% recall against 63–73% for the classical models, which lean toward calling articles authentic.',
    'Classical models are stable under 5-fold cross-validation (Logistic Regression mean accuracy 0.905, variance 0.0001).',
    'The trade-off measured: Logistic Regression trains in 0.37 s on a CPU, Bangla BERT in about 14 minutes with ~1.9 GB of GPU memory.',
    'LIME explanations show which Bangla words push a prediction toward real or fake.'
  ],
  highlights_bn = ARRAY[
    'ফাইন-টিউন করা বাংলা BERT: ৯৪.৪৯% accuracy, ৮৯.০৩% F1, ৯০.২৮% recall, ৯৮.৩৬% ROC-AUC, ৯৬.৫১% PR-AUC ও ৮৫.৩৫% Cohen-এর kappa।',
    'TF-IDF-ভিত্তিক ক্লাসিক্যাল মডেল: লজিস্টিক রিগ্রেশন ৯১.৩৮%, গ্রেডিয়েন্ট বুস্টিং ৯০.৬১%, র‍্যান্ডম ফরেস্ট ৯০.২৩% ও ডিসিশন ট্রি ৮৬.৬২% accuracy।',
    'বাংলা BERT অনেক বেশি ভুয়া খবর ধরে: ৯০.২৮% recall, যেখানে ক্লাসিক্যাল মডেলগুলোর ৬৩–৭৩%, যারা খবরকে সত্য বলার দিকে ঝোঁকে।',
    '৫-ফোল্ড ক্রস-ভ্যালিডেশনে ক্লাসিক্যাল মডেলগুলো স্থিতিশীল (লজিস্টিক রিগ্রেশনের গড় accuracy ০.৯০৫, ভ্যারিয়েন্স ০.০০০১)।',
    'পরিমাপ করা ভারসাম্য: লজিস্টিক রিগ্রেশন CPU-তে ০.৩৭ সেকেন্ডে, বাংলা BERT প্রায় ১৪ মিনিটে ও ~১.৯ GB GPU মেমরিতে প্রশিক্ষিত।',
    'LIME ব্যাখ্যা দেখায় কোন বাংলা শব্দ পূর্বাভাসকে সত্য বা ভুয়ার দিকে ঠেলে দেয়।'
  ],
  contributions_en = ARRAY[
    'Prepared the Bangla text: cleaning, removing punctuation, stop words and numbers, TF-IDF features for the classical models and WordPiece tokens for BERT.',
    'Built and compared Logistic Regression, Decision Tree, Random Forest and Gradient Boosting with 5-fold cross-validation and class-imbalance handling.',
    'Fine-tuned Bangla BERT (AdamW, learning rate 2e-5, batch 8, 3 epochs) and measured accuracy, F1, recall, ROC-AUC, PR-AUC and Cohen''s kappa.',
    'Measured training time and memory for every model and explained predictions with LIME.',
    'Released the model on Hugging Face with an 8-bit ONNX copy (658 MB → 165 MB) that runs in a browser demo.'
  ],
  contributions_bn = ARRAY[
    'বাংলা টেক্সট প্রস্তুত করা: পরিষ্কার, যতিচিহ্ন, স্টপ ওয়ার্ড ও সংখ্যা বাদ, ক্লাসিক্যাল মডেলের জন্য TF-IDF ও BERT-এর জন্য WordPiece টোকেন।',
    '৫-ফোল্ড ক্রস-ভ্যালিডেশন ও শ্রেণি-ভারসাম্য সামলে লজিস্টিক রিগ্রেশন, ডিসিশন ট্রি, র‍্যান্ডম ফরেস্ট ও গ্রেডিয়েন্ট বুস্টিং তৈরি ও তুলনা।',
    'বাংলা BERT ফাইন-টিউন (AdamW, লার্নিং রেট 2e-5, ব্যাচ ৮, ৩ ইপক) এবং accuracy, F1, recall, ROC-AUC, PR-AUC ও Cohen-এর kappa পরিমাপ।',
    'প্রতিটি মডেলের প্রশিক্ষণ সময় ও মেমরি পরিমাপ এবং LIME দিয়ে পূর্বাভাসের ব্যাখ্যা।',
    'ব্রাউজার ডেমোতে চলা ৮-বিট ONNX কপিসহ (৬৫৮ MB → ১৬৫ MB) মডেলটি Hugging Face-এ প্রকাশ।'
  ],
  methods = ARRAY['Python', 'PyTorch', 'Transformers', 'Bangla BERT', 'WordPiece', 'TF-IDF', 'scikit-learn', 'Logistic Regression', 'Decision Tree', 'Random Forest', 'Gradient Boosting', 'Cross-Validation', 'LIME', 'ONNX'],
  keywords = ARRAY['Bangla Fake News', 'Deep Fake News', 'Fake News Detection', 'Bangla BERT', 'Transformers', 'Low-Resource NLP', 'Explainable AI', 'Machine Learning', 'Misinformation', 'Bangladesh'],
  show_highlights = true, show_contributions = true, show_methods = true,
  show_case_study = true, show_challenges = true,
  updated_at = now()
WHERE user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60'
  AND title_en ILIKE 'Combating deep-fake news in Bengali%';

------------------------------------------------------------------------------
-- 2. Case study (unedited earlier rows make way for the fuller story)
------------------------------------------------------------------------------
DELETE FROM pf_case_study_sections s
USING pf_publications p
WHERE s.publication_id = p.id AND s.updated_at = s.created_at
  AND p.user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60'
  AND p.title_en ILIKE 'Combating deep-fake news in Bengali%'
  AND s.heading_en IN ('Problem', 'Approach', 'Results')
  AND s.created_at < now() - interval '1 minute';

INSERT INTO pf_case_study_sections (user_id, publication_id, heading_en, heading_bn, body_en, body_bn, sort_order)
SELECT p.user_id, p.id, v.heading_en, v.heading_bn, v.body_en, v.body_bn, v.ord
FROM pf_publications p
JOIN (VALUES
  (1, 'Problem', 'সমস্যা',
   '<p>Fake and manipulated news spreads fast on Bangla social media and news portals, eroding public trust. Bengali is spoken by hundreds of millions but is a <strong>low-resource language</strong> for NLP: few annotated datasets, few language-specific models, and detection tools built mostly for English.</p>',
   '<p>বাংলা সোশ্যাল মিডিয়া ও সংবাদ পোর্টালে ভুয়া ও বিকৃত খবর দ্রুত ছড়িয়ে জনআস্থা নষ্ট করে। কোটি কোটি মানুষের ভাষা হলেও NLP-তে বাংলা একটি <strong>স্বল্প-সম্পদের ভাষা</strong>: অল্প চিহ্নিত ডেটাসেট, অল্প ভাষা-নির্দিষ্ট মডেল, আর বেশিরভাগ শনাক্তকরণ টুল ইংরেজির জন্য তৈরি।</p>'),
  (2, 'Data', 'ডেটা',
   '<p>The expert-annotated <strong>BanFakeNews</strong> dataset: 48,678 authentic and 1,299 fake Bangla news articles. To keep the natural imbalance without drowning the fakes, 3,900 authentic articles were sampled, giving about <strong>3 authentic for every fake</strong>. The merged data were split <strong>75% / 25%</strong> for training and testing.</p>',
   '<p>বিশেষজ্ঞ-চিহ্নিত <strong>BanFakeNews</strong> ডেটাসেট: ৪৮,৬৭৮টি সত্য ও ১,২৯৯টি ভুয়া বাংলা সংবাদ। স্বাভাবিক ভারসাম্যহীনতা রেখে ভুয়াগুলো যাতে হারিয়ে না যায়, ৩,৯০০টি সত্য সংবাদ বেছে নেওয়া হয়: প্রায় <strong>প্রতি ভুয়ায় ৩টি সত্য</strong>। মিলিত ডেটা <strong>৭৫% / ২৫%</strong> ট্রেনিং ও টেস্টে ভাগ করা হয়।</p>'),
  (3, 'Approach', 'পদ্ধতি',
   '<p>Text was cleaned (punctuation, stop words and numbers removed). Classical models (<strong>Logistic Regression, Decision Tree, Random Forest, Gradient Boosting</strong>) used TF-IDF features, with 5-fold cross-validation and class-weight adjustment. <strong>Bangla BERT</strong> (sagorsarker/bangla-bert-base) was fine-tuned with its WordPiece tokenizer, AdamW, learning rate 2e-5, batch size 8 for 3 epochs. Every model was scored on accuracy, precision, recall, F1, ROC-AUC, PR-AUC and Cohen''s kappa, and timed for training cost.</p>',
   '<p>টেক্সট পরিষ্কার করা হয় (যতিচিহ্ন, স্টপ ওয়ার্ড ও সংখ্যা বাদ)। ক্লাসিক্যাল মডেল (<strong>লজিস্টিক রিগ্রেশন, ডিসিশন ট্রি, র‍্যান্ডম ফরেস্ট, গ্রেডিয়েন্ট বুস্টিং</strong>) TF-IDF ফিচার, ৫-ফোল্ড ক্রস-ভ্যালিডেশন ও শ্রেণি-ওজন সমন্বয় ব্যবহার করে। <strong>বাংলা BERT</strong> (sagorsarker/bangla-bert-base) এর WordPiece টোকেনাইজার, AdamW, লার্নিং রেট 2e-5, ব্যাচ ৮ ও ৩ ইপকে ফাইন-টিউন করা হয়। প্রতিটি মডেল accuracy, precision, recall, F1, ROC-AUC, PR-AUC ও Cohen-এর kappa-তে মূল্যায়িত এবং প্রশিক্ষণ খরচ পরিমাপ করা হয়।</p>'),
  (4, 'Results', 'ফলাফল',
   '<p><strong>Bangla BERT: 94.49% accuracy, 90.28% recall, 89.03% F1, 98.36% ROC-AUC.</strong> The classical models reach 86.6–91.4% accuracy but only 63–73% recall on fake news: they miss many fakes. BERT''s contextual understanding of Bangla closes that gap, and its performance keeps improving as training data grows.</p>',
   '<p><strong>বাংলা BERT: ৯৪.৪৯% accuracy, ৯০.২৮% recall, ৮৯.০৩% F1, ৯৮.৩৬% ROC-AUC।</strong> ক্লাসিক্যাল মডেলগুলো ৮৬.৬–৯১.৪% accuracy পেলেও ভুয়া খবরে recall মাত্র ৬৩–৭৩%: অনেক ভুয়া ধরা পড়ে না। বাংলার প্রেক্ষাপট বুঝতে পারায় BERT সেই ফাঁক পূরণ করে, এবং প্রশিক্ষণ ডেটা বাড়লে এর ফলাফলও বাড়তে থাকে।</p>'),
  (5, 'Explainability & cost', 'ব্যাখ্যাযোগ্যতা ও খরচ',
   '<p><strong>LIME</strong> highlights the Bangla tokens that push each prediction toward real or fake, for BERT and the classical models alike. The cost is measured too: Logistic Regression trains in 0.37 s and Random Forest in 3.4 s on a CPU, while Bangla BERT takes about <strong>14 minutes and ~1.9 GB of GPU memory</strong>. Classical models suit quick, low-resource setups; BERT buys accuracy with compute.</p>',
   '<p><strong>LIME</strong> দেখায় কোন বাংলা টোকেন প্রতিটি পূর্বাভাসকে সত্য বা ভুয়ার দিকে ঠেলে দেয়, BERT ও ক্লাসিক্যাল মডেল উভয়ের জন্য। খরচও মাপা হয়েছে: CPU-তে লজিস্টিক রিগ্রেশন ০.৩৭ সেকেন্ডে ও র‍্যান্ডম ফরেস্ট ৩.৪ সেকেন্ডে প্রশিক্ষিত, আর বাংলা BERT লাগে প্রায় <strong>১৪ মিনিট ও ~১.৯ GB GPU মেমরি</strong>। দ্রুত, স্বল্প-সম্পদের কাজে ক্লাসিক্যাল মডেল; বেশি গণনার বিনিময়ে নির্ভুলতা দেয় BERT।</p>'),
  (6, 'Practical impact', 'ব্যবহারিক প্রভাব',
   '<p>Because it misses far fewer fakes, the model can sit inside <strong>automated fact-checking pipelines</strong> to help journalists, regulators and platform moderators in Bengali-speaking regions, where verification tools are scarce. It is public on Hugging Face with an in-browser demo.</p>',
   '<p>অনেক কম ভুয়া খবর হাতছাড়া করায় মডেলটি <strong>স্বয়ংক্রিয় ফ্যাক্ট-চেকিং পাইপলাইনে</strong> যুক্ত হয়ে বাংলাভাষী অঞ্চলের সাংবাদিক, নিয়ন্ত্রক ও প্ল্যাটফর্ম মডারেটরদের সাহায্য করতে পারে, যেখানে যাচাই টুল দুর্লভ। এটি ব্রাউজার ডেমোসহ Hugging Face-এ উন্মুক্ত।</p>'),
  (7, 'Limitations & next steps', 'সীমাবদ্ধতা ও পরবর্তী ধাপ',
   '<ul><li><p>The data stay imbalanced, which can still bias learning.</p></li><li><p>Text only: images, video and metadata used in deep fakes are not covered yet.</p></li><li><p>BERT was trained on a single train/validation split because of compute limits.</p></li><li><p>Next: multimodal signals, data augmentation and cross-domain training, lighter distilled transformers for real-time use, and longitudinal, cross-domain evaluation.</p></li></ul>',
   '<ul><li><p>ডেটা এখনো ভারসাম্যহীন, যা শেখায় পক্ষপাত আনতে পারে।</p></li><li><p>শুধু টেক্সট: ডিপফেকে ব্যবহৃত ছবি, ভিডিও ও মেটাডেটা এখনো অন্তর্ভুক্ত নয়।</p></li><li><p>গণনা-সীমার কারণে BERT একটি ট্রেন/ভ্যালিডেশন বিভাজনে প্রশিক্ষিত।</p></li><li><p>পরবর্তী: মাল্টিমোডাল সংকেত, ডেটা অগমেন্টেশন ও ক্রস-ডোমেইন প্রশিক্ষণ, রিয়েল-টাইমের জন্য হালকা ট্রান্সফর্মার, এবং দীর্ঘমেয়াদি ক্রস-ডোমেইন মূল্যায়ন।</p></li></ul>')
) AS v(ord, heading_en, heading_bn, body_en, body_bn) ON true
WHERE p.user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60'
  AND p.title_en ILIKE 'Combating deep-fake news in Bengali%'
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
  AND p.title_en ILIKE 'Combating deep-fake news in Bengali%'
  AND c.sort_order IN (1, 2)
  AND c.created_at < now() - interval '1 minute';

INSERT INTO pf_challenges (user_id, publication_id, challenge_en, challenge_bn, solution_en, solution_bn, result_en, result_bn, sort_order)
SELECT p.user_id, p.id, v.c_en, v.c_bn, v.s_en, v.s_bn, v.r_en, v.r_bn, v.ord
FROM pf_publications p
JOIN (VALUES
  (1,
   '<p>Fake news is rare: 1,299 fakes against 48,678 authentic articles. A model can look accurate while missing most fakes.</p>',
   '<p>ভুয়া খবর বিরল: ৪৮,৬৭৮টি সত্যের বিপরীতে ১,২৯৯টি ভুয়া। মডেল নির্ভুল দেখালেও বেশিরভাগ ভুয়া হাতছাড়া করতে পারে।</p>',
   '<p>Sampled 3,900 authentic articles for a 3:1 ratio, used class weights instead of synthetic SMOTE samples, and judged models on recall, F1, PR-AUC and kappa, not accuracy alone.</p>',
   '<p>৩:১ অনুপাতের জন্য ৩,৯০০টি সত্য সংবাদ বেছে নেওয়া, কৃত্রিম SMOTE নমুনার বদলে শ্রেণি-ওজন ব্যবহার, এবং শুধু accuracy নয়, recall, F1, PR-AUC ও kappa-তে মডেল মূল্যায়ন।</p>',
   '<p>The comparison exposed the classical models'' weak recall (63–73%) and showed Bangla BERT''s 90.28%.</p>',
   '<p>তুলনায় ক্লাসিক্যাল মডেলগুলোর দুর্বল recall (৬৩–৭৩%) ধরা পড়ে এবং বাংলা BERT-এর ৯০.২৮% দেখা যায়।</p>'),
  (2,
   '<p>Bangla text is morphologically rich, with dialects and idioms that bag-of-words features miss.</p>',
   '<p>বাংলা টেক্সট রূপতাত্ত্বিকভাবে সমৃদ্ধ, উপভাষা ও বাগধারায় ভরা, যা bag-of-words ফিচার ধরতে পারে না।</p>',
   '<p>Fine-tuned a Bangla-specific BERT whose WordPiece tokenizer handles complex word forms, and compared it with TF-IDF models on the same data.</p>',
   '<p>বাংলা-নির্দিষ্ট BERT ফাইন-টিউন করা, যার WordPiece টোকেনাইজার জটিল শব্দরূপ সামলায়, এবং একই ডেটায় TF-IDF মডেলের সাথে তুলনা।</p>',
   '<p>94.49% accuracy and 98.36% ROC-AUC, ahead of every classical model.</p>',
   '<p>৯৪.৪৯% accuracy ও ৯৮.৩৬% ROC-AUC, প্রতিটি ক্লাসিক্যাল মডেলের চেয়ে এগিয়ে।</p>'),
  (3,
   '<p>Features computed on all the data would let test articles leak into training.</p>',
   '<p>সব ডেটা থেকে ফিচার তৈরি করলে টেস্টের সংবাদ ট্রেনিংয়ে ঢুকে পড়ত।</p>',
   '<p>Fitted TF-IDF and tokenisation on the training split only; the test data were never seen during training.</p>',
   '<p>TF-IDF ও টোকেনাইজেশন শুধু ট্রেনিং অংশে ফিট করা; প্রশিক্ষণের সময় টেস্ট ডেটা কখনো দেখা হয়নি।</p>',
   '<p>Scores that reflect performance on unseen articles.</p>',
   '<p>অদেখা সংবাদে প্রকৃত পারফরম্যান্স প্রতিফলিত করা ফলাফল।</p>'),
  (4,
   '<p>A black-box model is hard for journalists and moderators to trust.</p>',
   '<p>ব্ল্যাক-বক্স মডেলে সাংবাদিক ও মডারেটরদের আস্থা রাখা কঠিন।</p>',
   '<p>Applied LIME to both BERT and the classical models to show which words drive each prediction.</p>',
   '<p>প্রতিটি পূর্বাভাসের পেছনে কোন শব্দ কাজ করে তা দেখাতে BERT ও ক্লাসিক্যাল মডেল উভয়ে LIME প্রয়োগ।</p>',
   '<p>Token-level explanations for every prediction.</p>',
   '<p>প্রতিটি পূর্বাভাসের টোকেন-স্তরের ব্যাখ্যা।</p>'),
  (5,
   '<p>The fine-tuned model is 658 MB, too heavy for a simple public demo.</p>',
   '<p>ফাইন-টিউন করা মডেলটি ৬৫৮ MB, সাধারণ পাবলিক ডেমোর জন্য বেশ ভারী।</p>',
   '<p>Exported an 8-bit ONNX copy that runs in the visitor''s browser.</p>',
   '<p>দর্শকের ব্রাউজারে চলা ৮-বিট ONNX কপি তৈরি।</p>',
   '<p>165 MB, with predictions practically identical to the full model.</p>',
   '<p>১৬৫ MB, পূর্ণ মডেলের প্রায় হুবহু পূর্বাভাস।</p>')
) AS v(ord, c_en, c_bn, s_en, s_bn, r_en, r_bn) ON true
WHERE p.user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60'
  AND p.title_en ILIKE 'Combating deep-fake news in Bengali%'
  AND NOT EXISTS (
    SELECT 1 FROM pf_challenges c WHERE c.publication_id = p.id AND c.sort_order = v.ord
  );

------------------------------------------------------------------------------
-- 4. Its released model: description, results, tags
------------------------------------------------------------------------------
UPDATE pf_research_artifacts a SET
  description_en = 'Fine-tuned Bangla BERT that scores a Bangla news article as fake or authentic, trained on BanFakeNews (1,299 fake and 3,900 authentic articles). Ships with an 8-bit ONNX copy (658 MB → 165 MB) that runs fully in the browser.',
  description_bn = 'BanFakeNews-এ (১,২৯৯টি ভুয়া ও ৩,৯০০টি সত্য সংবাদ) প্রশিক্ষিত ফাইন-টিউন করা বাংলা BERT, যা কোনো বাংলা সংবাদকে ভুয়া বা সত্য হিসেবে স্কোর করে। সম্পূর্ণ ব্রাউজারে চলা ৮-বিট ONNX কপিসহ (৬৫৮ MB → ১৬৫ MB)।',
  metrics = ARRAY['94.49% accuracy', '89.03% F1', '90.28% recall', '98.36% ROC-AUC'],
  tags = ARRAY['Bangla BERT', 'PyTorch', 'Transformers', 'ONNX', 'NLP'],
  publication_id = p.id,
  updated_at = now()
FROM pf_publications p
WHERE a.user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60'
  AND a.model_url = 'https://huggingface.co/abir71/bangla-fake-news-bert'
  AND p.user_id = a.user_id
  AND p.title_en ILIKE 'Combating deep-fake news in Bengali%';

COMMIT;
