-- Everything for the released models & datasets (Research → Models, datasets &
-- code), in one go: description, headline results and tags (English and
-- Bangla), a case study and challenges & solutions for each, switched on.
-- Run in the Supabase SQL editor (needs migrations up to 073). Safe to re-run:
-- case-study sections and challenges are added only where missing.
--
-- Facts are from each model's Hugging Face card (abir71/…); the NASA dataset
-- is described only as far as its Kaggle entry goes.

BEGIN;

------------------------------------------------------------------------------
-- 1. Description, results, tags; case study and challenges switched on
------------------------------------------------------------------------------
UPDATE pf_research_artifacts a SET
  description_en = v.d_en, description_bn = v.d_bn, metrics = v.metrics, tags = v.tags,
  show_case_study = true, show_challenges = true, updated_at = now()
FROM (VALUES
  ('https://huggingface.co/abir71/bangla-fake-news-bert',
   'Fine-tuned Bangla BERT that gives the probability a Bangla news article is fake rather than authentic. Trained on BanFakeNews (1,299 fake, 3,900 authentic). An 8-bit ONNX copy (658 MB → 165 MB) runs fully in the browser demo. It judges writing style, not truth: not a fact-checker.',
   'বাংলা সংবাদ ভুয়া না সত্য তার সম্ভাবনা দেওয়া ফাইন-টিউন করা বাংলা BERT। BanFakeNews-এ (১,২৯৯টি ভুয়া, ৩,৯০০টি সত্য) প্রশিক্ষিত। ৮-বিট ONNX কপি (৬৫৮ MB → ১৬৫ MB) সম্পূর্ণ ব্রাউজার ডেমোতে চলে। এটি লেখার ধরন বিচার করে, সত্য নয়: ফ্যাক্ট-চেকার নয়।',
   ARRAY['94.49% accuracy', '89.03% F1 (fake)', '90.28% recall (fake)', '98.36% ROC-AUC'],
   ARRAY['Bangla BERT', 'PyTorch', 'Transformers', 'ONNX', 'NLP', 'Misinformation']),
  ('https://huggingface.co/abir71/maternal-fetal-risk-models',
   'A random forest and an explainable depth-3 decision tree that place a pregnancy record at low, mid or high risk from 19 clinical measurements, with the hospital dataset from Noakhali (private, on request). Evaluated honestly on the 100 unique patients after finding repeated records. Research use only, not a medical device.',
   '১৯টি ক্লিনিক্যাল পরিমাপ থেকে গর্ভাবস্থার রেকর্ডকে নিম্ন, মাঝারি বা উচ্চ ঝুঁকিতে রাখা র‍্যান্ডম ফরেস্ট ও ব্যাখ্যাযোগ্য ৩-গভীরতার ডিসিশন ট্রি, নোয়াখালীর হাসপাতালের ডেটাসেটসহ (প্রাইভেট, অনুরোধে)। পুনরাবৃত্ত রেকর্ড পাওয়ার পর ১০০ জন অনন্য রোগীর ওপর সৎভাবে মূল্যায়িত। শুধু গবেষণার জন্য, চিকিৎসা যন্ত্র নয়।',
   ARRAY['75.6% accuracy (20× repeated 5-fold CV)', '74.3% macro F1', '94% recall on low risk', '19 clinical features'],
   ARRAY['Scikit-learn', 'Random Forest', 'Decision Tree', 'Healthcare', 'Tabular', 'Bangladesh']),
  ('https://huggingface.co/abir71/bd-weather-forecast-models',
   'XGBoost (temperature, humidity) and SVR (rainfall) models that forecast next month''s values at 24 BMD stations, with season-stratified conformal intervals. Comes with the quality-controlled station panel (1981–2022) on Kaggle and the full, reproducible code on GitHub.',
   '২৪টি স্টেশনে পরের মাসের মান পূর্বাভাস দেওয়া XGBoost (তাপমাত্রা, আর্দ্রতা) ও SVR (বৃষ্টিপাত) মডেল, ঋতুভিত্তিক কনফরমাল ইন্টারভালসহ। Kaggle-এ মান-নিয়ন্ত্রিত স্টেশন প্যানেল (১৯৮১–২০২২) ও GitHub-এ পূর্ণ, পুনরুৎপাদনযোগ্য কোডসহ।',
   ARRAY['Temperature RMSE 0.74 °C (R² 0.963)', 'Rainfall RMSE 132.1 mm', 'Humidity RMSE 4.35% (R² 0.842)', '90% intervals, 0.90–0.94 coverage'],
   ARRAY['XGBoost', 'SVR', 'Time Series', 'Conformal Prediction', 'Weather', 'Bangladesh']),
  ('https://huggingface.co/abir71/bangla-cyberbullying-two-stage',
   'A two-stage classifier for Bangla-script, Romanized and code-mixed comments: it predicts 9 sentiment classes, then bullying / non-bullying / neutral from the text plus those sentiment probabilities. With the 3,150-comment labelled dataset (private, on request). Research use only, not a moderation tool.',
   'বাংলা লিপি, রোমান হরফ ও মিশ্র ভাষার মন্তব্যের জন্য দুই ধাপের ক্লাসিফায়ার: প্রথমে ৯টি অনুভূতি-শ্রেণি, তারপর টেক্সট ও সেই সম্ভাবনা থেকে বুলিং / নন-বুলিং / নিরপেক্ষ। ৩,১৫০টি চিহ্নিত মন্তব্যের ডেটাসেটসহ (প্রাইভেট, অনুরোধে)। শুধু গবেষণার জন্য, মডারেশন টুল নয়।',
   ARRAY['56.3% accuracy (3 classes)', 'Macro F1 0.49 vs 0.24 majority baseline', '3,150 comments', '3 annotators'],
   ARRAY['NLP', 'TF-IDF', 'Logistic Regression', 'Code-mixed text', 'Bangla', 'Cyberbullying']),
  ('https://huggingface.co/abir71/imdb-sentiment-mpnet',
   'English movie-review sentiment: all-mpnet-base-v2 sentence embeddings with a logistic regression on top, the best lightweight configuration of a comparison across 6 classifiers. Evaluated after removing duplicate reviews; a 16-bit copy runs in the browser. The embedded IMDB dataset is on Kaggle.',
   'ইংরেজি সিনেমা-রিভিউয়ের অনুভূতি: all-mpnet-base-v2 সেন্টেন্স এমবেডিংয়ের ওপর লজিস্টিক রিগ্রেশন, ৬টি ক্লাসিফায়ারের তুলনায় সেরা হালকা কনফিগারেশন। পুনরাবৃত্ত রিভিউ বাদ দিয়ে মূল্যায়িত; ১৬-বিট কপি ব্রাউজারে চলে। এমবেড করা IMDB ডেটাসেট Kaggle-এ।',
   ARRAY['91.11% accuracy', '91.22% F1', '96.94% ROC-AUC', '9,917 test reviews'],
   ARRAY['Sentence Transformers', 'MPNet', 'Scikit-learn', 'ONNX', 'NLP', 'Sentiment']),
  ('https://www.kaggle.com/datasets/abirhosenashik/bd-hourly-nasa-weather-report-64-districts-26-year',
   'Hourly NASA weather records for all 64 districts of Bangladesh over 26 years, organised by district for climate and forecasting research. Private, shared on request.',
   'বাংলাদেশের ৬৪টি জেলার ২৬ বছরের ঘণ্টাভিত্তিক NASA আবহাওয়া রেকর্ড, জেলাভিত্তিক সাজানো, জলবায়ু ও পূর্বাভাস গবেষণার জন্য। প্রাইভেট, অনুরোধে শেয়ার।',
   ARRAY['64 districts', '26 years', 'hourly'],
   ARRAY['Weather', 'Time Series', 'Climate', 'NASA', 'Bangladesh'])
) AS v(link, d_en, d_bn, metrics, tags)
WHERE a.user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60'
  AND COALESCE(a.model_url, a.dataset_url) = v.link;

------------------------------------------------------------------------------
-- 2. Case study (added where missing)
------------------------------------------------------------------------------
INSERT INTO pf_case_study_sections (user_id, artifact_id, heading_en, heading_bn, body_en, body_bn, sort_order)
SELECT a.user_id, a.id, v.heading_en, v.heading_bn, v.body_en, v.body_bn, v.ord
FROM pf_research_artifacts a
JOIN (VALUES
  -- Bangla fake news
  ('https://huggingface.co/abir71/bangla-fake-news-bert', 1, 'How it works', 'কীভাবে কাজ করে',
   '<p>Base model <strong>sagorsarker/bangla-bert-base</strong>; a linear layer on the final [CLS] embedding gives two logits (authentic / fake). Fine-tuned for 3 epochs with AdamW (learning rate 2e-5, batch size 8, up to 512 tokens) on BanFakeNews: all 1,299 fake articles and 3,900 authentic ones (about 1 to 3), split 75/25.</p>',
   '<p>মূল মডেল <strong>sagorsarker/bangla-bert-base</strong>; শেষ [CLS] এমবেডিংয়ের ওপর একটি লিনিয়ার স্তর দুটি লজিট দেয় (সত্য / ভুয়া)। BanFakeNews-এ ৩ ইপক AdamW (লার্নিং রেট 2e-5, ব্যাচ ৮, সর্বোচ্চ ৫১২ টোকেন) দিয়ে ফাইন-টিউন: ১,২৯৯টি ভুয়া ও ৩,৯০০টি সত্য সংবাদ (প্রায় ১:৩), ৭৫/২৫ ভাগে।</p>'),
  ('https://huggingface.co/abir71/bangla-fake-news-bert', 2, 'Results', 'ফলাফল',
   '<p>On the held-out test set: <strong>94.49% accuracy, 89.03% F1 and 90.28% recall</strong> on the fake class, and <strong>98.36% ROC-AUC</strong>: far ahead of the classical TF-IDF models in the paper, which miss many fakes.</p>',
   '<p>আলাদা রাখা টেস্ট সেটে: ভুয়া শ্রেণিতে <strong>৯৪.৪৯% accuracy, ৮৯.০৩% F1 ও ৯০.২৮% recall</strong>, এবং <strong>৯৮.৩৬% ROC-AUC</strong>: পেপারের ক্লাসিক্যাল TF-IDF মডেলগুলোর চেয়ে অনেক এগিয়ে, যারা অনেক ভুয়া হাতছাড়া করে।</p>'),
  ('https://huggingface.co/abir71/bangla-fake-news-bert', 3, 'Try it & limits', 'ব্যবহার ও সীমা',
   '<p>Paste a Bangla article into the live demo, or load the full weights with the included code. It judges <strong>writing style, not truth</strong>: do not use it as proof that an article is true or false, and expect weaker results on topics and periods unlike BanFakeNews.</p>',
   '<p>লাইভ ডেমোতে বাংলা সংবাদ বসান, অথবা অন্তর্ভুক্ত কোড দিয়ে পূর্ণ মডেল লোড করুন। এটি <strong>লেখার ধরন বিচার করে, সত্য নয়</strong>: কোনো সংবাদ সত্য বা মিথ্যা প্রমাণে এটি ব্যবহার করবেন না; BanFakeNews থেকে ভিন্ন বিষয় ও সময়ে ফল দুর্বল হতে পারে।</p>'),
  -- Maternal & fetal health
  ('https://huggingface.co/abir71/maternal-fetal-risk-models', 1, 'How it works', 'কীভাবে কাজ করে',
   '<p>Two scikit-learn pipelines, each filling a missing value with the training median before the classifier: a <strong>random forest</strong> (100 trees, at least 3 records per leaf) and a <strong>depth-3 decision tree</strong> whose rules can be read. Inputs are 19 measurements: age, blood pressure, temperature, maternal and fetal heart rate, fetal movement, BMI, blood glucose, HbA1c, hepatitis B, TSH, ALT, uric acid and amniotic fluid.</p>',
   '<p>দুটি scikit-learn পাইপলাইন, প্রতিটি ক্লাসিফায়ারের আগে অনুপস্থিত মান ট্রেনিং মিডিয়ান দিয়ে পূরণ করে: একটি <strong>র‍্যান্ডম ফরেস্ট</strong> (১০০টি ট্রি, প্রতি পাতায় কমপক্ষে ৩টি রেকর্ড) ও একটি <strong>৩-গভীরতার ডিসিশন ট্রি</strong>, যার নিয়ম পড়া যায়। ইনপুট ১৯টি পরিমাপ: বয়স, রক্তচাপ, তাপমাত্রা, মাতৃ ও ভ্রূণের হৃদস্পন্দন, ভ্রূণের নড়াচড়া, BMI, রক্তের গ্লুকোজ, HbA1c, হেপাটাইটিস বি, TSH, ALT, ইউরিক অ্যাসিড ও অ্যামনিওটিক তরল।</p>'),
  ('https://huggingface.co/abir71/maternal-fetal-risk-models', 2, 'Results', 'ফলাফল',
   '<p>On the <strong>100 unique patients</strong> with 20× repeated 5-fold cross-validation: random forest <strong>75.6% ± 8.2 accuracy, 74.3% macro F1</strong> (recall: low 94%, mid 60%, high 69%); decision tree 63.0%. The final models are fitted on all 100 records (low 37, mid 30, high 33).</p>',
   '<p><strong>১০০ জন অনন্য রোগীর</strong> ওপর ২০ বার পুনরাবৃত্ত ৫-ফোল্ড ক্রস-ভ্যালিডেশনে: র‍্যান্ডম ফরেস্ট <strong>৭৫.৬% ± ৮.২ accuracy, ৭৪.৩% macro F1</strong> (recall: নিম্ন ৯৪%, মাঝারি ৬০%, উচ্চ ৬৯%); ডিসিশন ট্রি ৬৩.০%। চূড়ান্ত মডেল সব ১০০টি রেকর্ডে প্রশিক্ষিত (নিম্ন ৩৭, মাঝারি ৩০, উচ্চ ৩৩)।</p>'),
  ('https://huggingface.co/abir71/maternal-fetal-risk-models', 3, 'Try it & limits', 'ব্যবহার ও সীমা',
   '<p>Enter measurements in the live demo or load the pipelines in Python. <strong>Research use only, not a medical device</strong>: trained on 100 patients from one district, it is wrong about one time in four and must never guide diagnosis or treatment. The dataset is private and shared on request.</p>',
   '<p>লাইভ ডেমোতে পরিমাপ দিন বা Python-এ পাইপলাইন লোড করুন। <strong>শুধু গবেষণার জন্য, চিকিৎসা যন্ত্র নয়</strong>: একটি জেলার ১০০ জন রোগীতে প্রশিক্ষিত, প্রতি চারবারে একবার ভুল করে, তাই রোগনির্ণয় বা চিকিৎসায় কখনো ব্যবহার করা যাবে না। ডেটাসেট প্রাইভেট, অনুরোধে শেয়ার করা হয়।</p>'),
  -- Weather
  ('https://huggingface.co/abir71/bd-weather-forecast-models', 1, 'How it works', 'কীভাবে কাজ করে',
   '<p>For a forecast of month <em>t</em>, each model uses only what is known by the end of month <em>t−1</em>: the target''s lags (1, 2, 3, 12) and 3-month mean, last month''s other variables and dew-point depression, the month and station coordinates, the four nearest stations'' last-month values and the station climatology. <strong>XGBoost</strong> forecasts temperature and humidity, <strong>SVR</strong> rainfall; <code>bdweather.py</code> builds every feature from a monthly panel.</p>',
   '<p>মাস <em>t</em>-এর পূর্বাভাসে প্রতিটি মডেল শুধু মাস <em>t−1</em>-এর শেষ পর্যন্ত জানা তথ্য ব্যবহার করে: লক্ষ্যের পূর্ববর্তী মান (১, ২, ৩, ১২) ও ৩ মাসের গড়, আগের মাসের অন্যান্য ভেরিয়েবল ও শিশিরাঙ্কের পার্থক্য, মাস ও স্টেশনের অবস্থান, নিকটতম চারটি স্টেশনের আগের মাসের মান ও স্টেশনের জলবায়ুগত গড়। <strong>XGBoost</strong> তাপমাত্রা ও আর্দ্রতা, <strong>SVR</strong> বৃষ্টিপাত পূর্বাভাস দেয়।</p>'),
  ('https://huggingface.co/abir71/bd-weather-forecast-models', 2, 'Results', 'ফলাফল',
   '<p>Rolling-origin test over 2018–2022 (24 stations × 60 months): temperature <strong>RMSE 0.74 °C (R² 0.963)</strong>, rainfall <strong>132.1 mm</strong>, humidity <strong>4.35% (R² 0.842)</strong>, each better than the station climatology. 90% conformal intervals cover 0.90–0.94 of real values. Two versions: trained to 2017 (as tested) and to 2022 (for new forecasts).</p>',
   '<p>২০১৮–২০২২ সালের রোলিং-অরিজিন টেস্টে (২৪ স্টেশন × ৬০ মাস): তাপমাত্রা <strong>RMSE ০.৭৪ °C (R² ০.৯৬৩)</strong>, বৃষ্টিপাত <strong>১৩২.১ মিমি</strong>, আর্দ্রতা <strong>৪.৩৫% (R² ০.৮৪২)</strong>, প্রতিটিই স্টেশনের জলবায়ুগত গড়ের চেয়ে ভালো। ৯০% কনফরমাল ইন্টারভাল প্রকৃত মানের ০.৯০–০.৯৪ অংশ ধরে। দুটি সংস্করণ: ২০১৭ পর্যন্ত (যেভাবে পরীক্ষিত) ও ২০২২ পর্যন্ত (নতুন পূর্বাভাসের জন্য)।</p>'),
  ('https://huggingface.co/abir71/bd-weather-forecast-models', 3, 'Try it & limits', 'ব্যবহার ও সীমা',
   '<p>Pick a station and month in the live demo, rebuild everything from the GitHub code, or download the quality-controlled panel from Kaggle. Per-station SARIMA is as accurate for rainfall and humidity, and extreme rainfall months are under-predicted, so use the intervals, not just the point forecast.</p>',
   '<p>লাইভ ডেমোতে স্টেশন ও মাস বাছুন, GitHub কোড থেকে সব আবার তৈরি করুন, অথবা Kaggle থেকে মান-নিয়ন্ত্রিত প্যানেল ডাউনলোড করুন। বৃষ্টিপাত ও আর্দ্রতায় স্টেশনভিত্তিক SARIMA সমান নির্ভুল, এবং চরম বৃষ্টির মাস কম অনুমান হয়, তাই শুধু পয়েন্ট পূর্বাভাস নয়, ইন্টারভাল দেখুন।</p>'),
  -- Cyberbullying
  ('https://huggingface.co/abir71/bangla-cyberbullying-two-stage', 1, 'How it works', 'কীভাবে কাজ করে',
   '<p>TF-IDF on word unigrams and bigrams (6,000 terms) and on character 2–4-grams (12,000 terms), which cope with varied Romanized spellings. <strong>Stage 1</strong>, a balanced multinomial logistic regression, predicts 9 sentiment classes; <strong>stage 2</strong> classifies bullying / non-bullying / neutral from the text plus the stage-1 probabilities, trained on out-of-fold predictions so it never sees the annotators'' labels.</p>',
   '<p>শব্দের ইউনিগ্রাম ও বাইগ্রামে (৬,০০০ শব্দ) এবং অক্ষরের ২–৪-গ্রামে (১২,০০০) TF-IDF, যা রোমান হরফের বিভিন্ন বানান সামলায়। <strong>প্রথম ধাপ</strong>, একটি সুষম মাল্টিনোমিয়াল লজিস্টিক রিগ্রেশন, ৯টি অনুভূতি-শ্রেণি পূর্বাভাস দেয়; <strong>দ্বিতীয় ধাপ</strong> টেক্সট ও প্রথম ধাপের সম্ভাবনা থেকে বুলিং / নন-বুলিং / নিরপেক্ষ নির্ধারণ করে, আউট-অফ-ফোল্ড পূর্বাভাসে প্রশিক্ষিত।</p>'),
  ('https://huggingface.co/abir71/bangla-cyberbullying-two-stage', 2, 'Data & results', 'ডেটা ও ফলাফল',
   '<p><strong>3,150 comments</strong> from Bangladeshi YouTube (2,118) and Facebook (1,031) pages, labelled by 3 annotators (bullying 1,720, non-bullying 887, neutral 543). With 3× repeated 5-fold cross-validation: <strong>56.3% accuracy, macro F1 0.49</strong>, against 0.24 for always answering "bullying". Supplying the <em>human</em> sentiment label would lift it to 75.7%: the gap shows how much better sentiment prediction must become.</p>',
   '<p>বাংলাদেশি YouTube (২,১১৮) ও Facebook (১,০৩১) পেজের <strong>৩,১৫০টি মন্তব্য</strong>, ৩ জন চিহ্নিতকারীর লেবেলসহ (বুলিং ১,৭২০, নন-বুলিং ৮৮৭, নিরপেক্ষ ৫৪৩)। ৩ বার পুনরাবৃত্ত ৫-ফোল্ড ক্রস-ভ্যালিডেশনে: <strong>৫৬.৩% accuracy, macro F1 ০.৪৯</strong>, যেখানে সবসময় "বুলিং" বললে ০.২৪। <em>মানুষের</em> অনুভূতি-লেবেল দিলে ৭৫.৭% হয়: এই ফাঁক দেখায় অনুভূতি-পূর্বাভাস কতটা ভালো হতে হবে।</p>'),
  ('https://huggingface.co/abir71/bangla-cyberbullying-two-stage', 3, 'Try it & limits', 'ব্যবহার ও সীমা',
   '<p>Type a Bangla or Romanized comment into the live demo. <strong>Research use only</strong>: it is wrong on more than four comments in ten and must not be used to punish, report or label people. Comments are mostly 2024–2026 politics and celebrity pages, sarcasm is almost never caught, and a bag-of-words model cannot follow context.</p>',
   '<p>লাইভ ডেমোতে বাংলা বা রোমান হরফের মন্তব্য লিখুন। <strong>শুধু গবেষণার জন্য</strong>: প্রতি দশটির চারটিরও বেশি মন্তব্যে ভুল করে, তাই কাউকে শাস্তি, রিপোর্ট বা চিহ্নিত করতে ব্যবহার করা যাবে না। মন্তব্য মূলত ২০২৪–২০২৬ সালের রাজনীতি ও সেলিব্রিটি পেজের, ব্যঙ্গ প্রায় ধরা পড়ে না, এবং bag-of-words মডেল প্রেক্ষাপট বুঝতে পারে না।</p>'),
  -- IMDB sentiment
  ('https://huggingface.co/abir71/imdb-sentiment-mpnet', 1, 'How it works', 'কীভাবে কাজ করে',
   '<p>A review is cleaned (HTML removed, lower-cased), embedded with <strong>all-mpnet-base-v2</strong> (mean pooling, no normalisation, up to 512 tokens) and scored by a <strong>logistic regression</strong> (C = 10) that outputs the probability the review is positive. The study compared bag-of-words, TF-IDF and sentence embeddings across logistic regression, SVM, naive Bayes, random forest, KNN and a neural network; embeddings won.</p>',
   '<p>রিভিউ পরিষ্কার করে (HTML বাদ, ছোট হাতের অক্ষর), <strong>all-mpnet-base-v2</strong> দিয়ে এমবেড করে (মিন পুলিং, নরমালাইজেশন ছাড়া, সর্বোচ্চ ৫১২ টোকেন) একটি <strong>লজিস্টিক রিগ্রেশন</strong> (C = ১০) রিভিউটি ইতিবাচক হওয়ার সম্ভাবনা দেয়। গবেষণায় bag-of-words, TF-IDF ও সেন্টেন্স এমবেডিং ছয়টি ক্লাসিফায়ারে তুলনা করা হয়; এমবেডিং সেরা।</p>'),
  ('https://huggingface.co/abir71/imdb-sentiment-mpnet', 2, 'Results', 'ফলাফল',
   '<p>On IMDB 50K after removing the 419 repeated reviews, split 80/20 (39,664 training, 9,917 test): <strong>91.11% accuracy, 91.22% F1, 96.94% ROC-AUC</strong>. A 256-unit neural network scored about the same; an RBF SVM scored a little higher before de-duplication but keeps tens of thousands of support vectors, so the far smaller logistic regression is published.</p>',
   '<p>IMDB 50K-এ ৪১৯টি পুনরাবৃত্ত রিভিউ বাদ দিয়ে ৮০/২০ ভাগে (৩৯,৬৬৪ ট্রেনিং, ৯,৯১৭ টেস্ট): <strong>৯১.১১% accuracy, ৯১.২২% F1, ৯৬.৯৪% ROC-AUC</strong>। ২৫৬-ইউনিটের নিউরাল নেটওয়ার্ক প্রায় একই; RBF SVM পুনরাবৃত্তি বাদের আগে সামান্য বেশি পেলেও হাজার হাজার সাপোর্ট ভেক্টর রাখে, তাই অনেক ছোট লজিস্টিক রিগ্রেশন প্রকাশিত।</p>'),
  ('https://huggingface.co/abir71/imdb-sentiment-mpnet', 3, 'Try it & limits', 'ব্যবহার ও সীমা',
   '<p>Type a review into the browser demo, or use the embedded dataset on Kaggle to train without re-encoding. English only and two classes: very short texts, tweets and non-movie reviews are less reliable, neutral or mixed reviews land near 50%, and sarcasm is often missed.</p>',
   '<p>ব্রাউজার ডেমোতে রিভিউ লিখুন, অথবা আবার এনকোড না করে প্রশিক্ষণের জন্য Kaggle-এর এমবেড করা ডেটাসেট ব্যবহার করুন। শুধু ইংরেজি ও দুই শ্রেণি: খুব ছোট লেখা, টুইট ও সিনেমা ছাড়া অন্য রিভিউ কম নির্ভরযোগ্য, নিরপেক্ষ বা মিশ্র রিভিউ প্রায় ৫০%-এ থাকে, এবং ব্যঙ্গ প্রায়ই ধরা পড়ে না।</p>'),
  -- NASA hourly weather
  ('https://www.kaggle.com/datasets/abirhosenashik/bd-hourly-nasa-weather-report-64-districts-26-year', 1, 'What it is', 'এটি কী',
   '<p>Hourly NASA weather records for <strong>all 64 districts of Bangladesh over 26 years</strong>, merged into one district-by-district panel. It complements the 24 BMD station records with full national coverage at a finer time scale.</p>',
   '<p><strong>বাংলাদেশের ৬৪টি জেলার ২৬ বছরের</strong> ঘণ্টাভিত্তিক NASA আবহাওয়া রেকর্ড, জেলাভিত্তিক একটি প্যানেলে একত্রিত। এটি BMD-এর ২৪টি স্টেশনের রেকর্ডকে পূর্ণ জাতীয় বিস্তার ও সূক্ষ্মতর সময়-মাত্রায় পরিপূরক করে।</p>'),
  ('https://www.kaggle.com/datasets/abirhosenashik/bd-hourly-nasa-weather-report-64-districts-26-year', 2, 'Uses & access', 'ব্যবহার ও অ্যাক্সেস',
   '<p>Suited to district-level climate analysis, sub-daily and daily forecasting, and filling the gaps between weather stations. The dataset is <strong>private</strong>: send a message with your intended use to request access.</p>',
   '<p>জেলাভিত্তিক জলবায়ু বিশ্লেষণ, দৈনিক ও তার চেয়ে ছোট সময়ের পূর্বাভাস এবং আবহাওয়া স্টেশনগুলোর মাঝের ফাঁক পূরণের উপযোগী। ডেটাসেটটি <strong>প্রাইভেট</strong>: অ্যাক্সেসের জন্য ব্যবহারের উদ্দেশ্যসহ বার্তা পাঠান।</p>')
) AS v(link, ord, heading_en, heading_bn, body_en, body_bn) ON COALESCE(a.model_url, a.dataset_url) = v.link
WHERE a.user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60'
  AND NOT EXISTS (
    SELECT 1 FROM pf_case_study_sections s WHERE s.artifact_id = a.id AND s.heading_en = v.heading_en
  );

------------------------------------------------------------------------------
-- 3. Challenges & solutions (added where missing)
------------------------------------------------------------------------------
INSERT INTO pf_challenges (user_id, artifact_id, challenge_en, challenge_bn, solution_en, solution_bn, result_en, result_bn, sort_order)
SELECT a.user_id, a.id, v.c_en, v.c_bn, v.s_en, v.s_bn, v.r_en, v.r_bn, v.ord
FROM pf_research_artifacts a
JOIN (VALUES
  ('https://huggingface.co/abir71/bangla-fake-news-bert', 1,
   '<p>The fine-tuned model is 658 MB, too heavy for a simple public demo.</p>', '<p>ফাইন-টিউন করা মডেলটি ৬৫৮ MB, সাধারণ পাবলিক ডেমোর জন্য বেশ ভারী।</p>',
   '<p>Exported an 8-bit ONNX copy that runs in the visitor''s browser with onnxruntime-web.</p>', '<p>onnxruntime-web দিয়ে দর্শকের ব্রাউজারে চলা ৮-বিট ONNX কপি তৈরি।</p>',
   '<p>165 MB, with predictions practically identical to the full model, and no server needed.</p>', '<p>১৬৫ MB, পূর্ণ মডেলের প্রায় হুবহু পূর্বাভাস, কোনো সার্ভার লাগে না।</p>'),
  ('https://huggingface.co/abir71/bangla-fake-news-bert', 2,
   '<p>The model uses a custom classification head, so the standard Transformers loader cannot rebuild it.</p>', '<p>মডেলটি কাস্টম ক্লাসিফিকেশন হেড ব্যবহার করে, তাই সাধারণ Transformers লোডার এটি তৈরি করতে পারে না।</p>',
   '<p>Shipped the model class, text cleaning and a <code>predict()</code> helper with the weights.</p>', '<p>ওজনের সাথে মডেল ক্লাস, টেক্সট পরিষ্কার ও <code>predict()</code> সহায়ক দেওয়া।</p>',
   '<p>A few lines of Python to load the model and score articles.</p>', '<p>অল্প কয়েক লাইনের Python-এ মডেল লোড ও সংবাদ স্কোর।</p>'),
  ('https://huggingface.co/abir71/maternal-fetal-risk-models', 1,
   '<p>The source file had 930 rows but only 100 unique patients, so most test rows also appeared in training and several models showed 100%.</p>', '<p>মূল ফাইলে ৯৩০টি সারি থাকলেও অনন্য রোগী মাত্র ১০০ জন, তাই বেশিরভাগ টেস্ট সারি ট্রেনিংয়েও ছিল এবং কয়েকটি মডেল ১০০% দেখাচ্ছিল।</p>',
   '<p>Trained and evaluated on the 100 unique records with 20× repeated 5-fold cross-validation, imputing inside each training fold.</p>', '<p>১০০টি অনন্য রেকর্ডে প্রশিক্ষণ ও মূল্যায়ন, ২০ বার পুনরাবৃত্ত ৫-ফোল্ড ক্রস-ভ্যালিডেশনে, প্রতিটি ট্রেনিং ফোল্ডের ভেতরে ইমপুটেশনসহ।</p>',
   '<p>An honest 75.6% accuracy, published with the model instead of 100%.</p>', '<p>১০০%-এর বদলে সৎ ৭৫.৬% accuracy, মডেলের সাথে প্রকাশিত।</p>'),
  ('https://huggingface.co/abir71/maternal-fetal-risk-models', 2,
   '<p>Clinicians need to see why a record is called high risk, not just the label.</p>', '<p>কোনো রেকর্ড কেন উচ্চ ঝুঁকির, শুধু লেবেল নয়, তা চিকিৎসকদের দেখা প্রয়োজন।</p>',
   '<p>Released a depth-3 decision tree beside the random forest, whose few rules can be read and checked.</p>', '<p>র‍্যান্ডম ফরেস্টের পাশে ৩-গভীরতার ডিসিশন ট্রি প্রকাশ, যার অল্প কয়েকটি নিয়ম পড়ে যাচাই করা যায়।</p>',
   '<p>A transparent option (63.0%) next to the more accurate one (75.6%).</p>', '<p>বেশি নির্ভুলটির (৭৫.৬%) পাশে একটি স্বচ্ছ বিকল্প (৬৩.০%)।</p>'),
  ('https://huggingface.co/abir71/bd-weather-forecast-models', 1,
   '<p>Building the forecast inputs by hand (lags, neighbours, climatology) is easy to get wrong and can leak future data.</p>', '<p>পূর্বাভাসের ইনপুট (পূর্ববর্তী মান, পার্শ্ববর্তী স্টেশন, জলবায়ুগত গড়) হাতে তৈরিতে ভুল হওয়া ও ভবিষ্যতের তথ্য ঢুকে পড়া সহজ।</p>',
   '<p>Shipped <code>bdweather.py</code>, which builds every predictor from a monthly panel using only data up to the previous month.</p>', '<p><code>bdweather.py</code> দেওয়া, যা শুধু আগের মাস পর্যন্ত ডেটা দিয়ে মাসিক প্যানেল থেকে প্রতিটি প্রেডিক্টর তৈরি করে।</p>',
   '<p>Forecasts that match the paper''s leakage-free setup.</p>', '<p>পেপারের লিকেজ-মুক্ত সেটআপের সাথে মেলে এমন পূর্বাভাস।</p>'),
  ('https://huggingface.co/abir71/bd-weather-forecast-models', 2,
   '<p>Users need both the tested models and models that use the latest data.</p>', '<p>ব্যবহারকারীদের পরীক্ষিত মডেল ও সর্বশেষ ডেটার মডেল দুটোই দরকার।</p>',
   '<p>Published two versions: trained to 2017 (exactly as evaluated) and to 2022 (for new forecasts), each with its climatology, settings and conformal quantiles.</p>', '<p>দুটি সংস্করণ প্রকাশ: ২০১৭ পর্যন্ত (ঠিক যেভাবে মূল্যায়িত) ও ২০২২ পর্যন্ত (নতুন পূর্বাভাসের জন্য), প্রতিটির জলবায়ুগত গড়, সেটিং ও কনফরমাল কোয়ান্টাইলসহ।</p>',
   '<p>Reproducible results and up-to-date forecasts from one repository.</p>', '<p>এক রিপোজিটরি থেকে পুনরুৎপাদনযোগ্য ফলাফল ও হালনাগাদ পূর্বাভাস।</p>'),
  ('https://huggingface.co/abir71/bangla-cyberbullying-two-stage', 1,
   '<p>Comments mix Bangla script, Romanized Bangla and English, with countless spellings of the same word.</p>', '<p>মন্তব্যে বাংলা লিপি, রোমান হরফের বাংলা ও ইংরেজি মিশে থাকে, একই শব্দের অসংখ্য বানানসহ।</p>',
   '<p>Combined word n-grams with character 2–4-grams inside word boundaries, so different spellings still share features.</p>', '<p>শব্দের n-গ্রামের সাথে শব্দসীমার ভেতরের অক্ষরের ২–৪-গ্রাম যোগ, যাতে ভিন্ন বানানও ফিচার ভাগ করে।</p>',
   '<p>One model for all three writing styles.</p>', '<p>তিন লিখনরীতির জন্য একটি মডেল।</p>'),
  ('https://huggingface.co/abir71/bangla-cyberbullying-two-stage', 2,
   '<p>Using the annotators'' sentiment labels in stage 2 looked great (75.7%) but is impossible for a new comment.</p>', '<p>দ্বিতীয় ধাপে চিহ্নিতকারীদের অনুভূতি-লেবেল ব্যবহারে ফল দারুণ (৭৫.৭%) দেখালেও নতুন মন্তব্যে তা অসম্ভব।</p>',
   '<p>Trained stage 2 on out-of-fold stage-1 predictions and reported the human-label score only as an upper bound.</p>', '<p>দ্বিতীয় ধাপ প্রথম ধাপের আউট-অফ-ফোল্ড পূর্বাভাসে প্রশিক্ষণ, এবং মানুষের লেবেলের ফল শুধু ঊর্ধ্বসীমা হিসেবে উল্লেখ।</p>',
   '<p>An honest 56.3% (macro F1 0.49) that works the same way on real comments.</p>', '<p>সৎ ৫৬.৩% (macro F1 ০.৪৯), যা বাস্তব মন্তব্যেও একইভাবে কাজ করে।</p>'),
  ('https://huggingface.co/abir71/imdb-sentiment-mpnet', 1,
   '<p>419 reviews appear more than once in IMDB 50K, so copies could land in both training and test.</p>', '<p>IMDB 50K-এ ৪১৯টি রিভিউ একাধিকবার আছে, তাই প্রতিলিপি ট্রেনিং ও টেস্ট দুটোতেই পড়তে পারত।</p>',
   '<p>Removed the repeats before splitting.</p>', '<p>ভাগ করার আগে পুনরাবৃত্তি বাদ।</p>',
   '<p>91.11% on reviews the model has truly never seen (the notebook''s 91.34% included repeats).</p>', '<p>সত্যিই অদেখা রিভিউয়ে ৯১.১১% (নোটবুকের ৯১.৩৪%-এ পুনরাবৃত্তি ছিল)।</p>'),
  ('https://huggingface.co/abir71/imdb-sentiment-mpnet', 2,
   '<p>The embedding model is large for a browser, and an 8-bit copy changed some predictions.</p>', '<p>এমবেডিং মডেলটি ব্রাউজারের জন্য বড়, আর ৮-বিট কপি কিছু পূর্বাভাস বদলে দিয়েছিল।</p>',
   '<p>Tested quantised copies and kept the 16-bit one, with the classifier''s weights exported as plain numbers.</p>', '<p>কোয়ান্টাইজ করা কপি পরীক্ষা করে ১৬-বিটটি রাখা, ক্লাসিফায়ারের ওজন সাধারণ সংখ্যা হিসেবে রপ্তানিসহ।</p>',
   '<p>Probabilities within 0.009 of the full model with identical labels, all in the browser.</p>', '<p>পূর্ণ মডেলের ০.০০৯-এর মধ্যে সম্ভাবনা ও হুবহু লেবেল, সবই ব্রাউজারে।</p>'),
  ('https://www.kaggle.com/datasets/abirhosenashik/bd-hourly-nasa-weather-report-64-districts-26-year', 1,
   '<p>Weather station names and NASA''s 64 district names do not line up one to one.</p>', '<p>আবহাওয়া স্টেশনের নাম ও NASA-র ৬৪টি জেলার নাম এক-এক করে মেলে না।</p>',
   '<p>Mapped each station to the district it physically lies in (e.g. Hatiya to Noakhali, Ishurdi to Pabna).</p>', '<p>প্রতিটি স্টেশনকে তার প্রকৃত জেলার সাথে মেলানো (যেমন হাতিয়া নোয়াখালীতে, ঈশ্বরদী পাবনায়)।</p>',
   '<p>NASA and station records can be combined district by district.</p>', '<p>NASA ও স্টেশনের রেকর্ড জেলাভিত্তিকভাবে মিলিয়ে ব্যবহার করা যায়।</p>')
) AS v(link, ord, c_en, c_bn, s_en, s_bn, r_en, r_bn) ON COALESCE(a.model_url, a.dataset_url) = v.link
WHERE a.user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60'
  AND NOT EXISTS (
    SELECT 1 FROM pf_challenges c WHERE c.artifact_id = a.id AND c.sort_order = v.ord
  );

COMMIT;
