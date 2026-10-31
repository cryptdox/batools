-- Everything for one paper, in one go:
--   "Leakage Controlled Machine Learning Forecasting of Monthly Rainfall,
--    Temperature and Humidity Across Bangladesh" (under review)
-- Run in the Supabase SQL editor (needs migrations up to 073). Safe to re-run.
--
-- Facts are from the revised manuscript (Revised_Manuscript, October 2026).
-- Kept as they are: title, authors, status and the code link. The abstract is
-- replaced with the revised one (English and Bangla). The case study and
-- challenges added earlier by data part 4 are replaced with fuller ones, but
-- only rows nobody has edited since.

BEGIN;

------------------------------------------------------------------------------
-- 1. The paper: abstract, key findings, contribution, methods, keywords
------------------------------------------------------------------------------
UPDATE pf_publications SET
  title_bn = 'বাংলাদেশজুড়ে মাসিক বৃষ্টিপাত, তাপমাত্রা ও আর্দ্রতার লিকেজ-নিয়ন্ত্রিত মেশিন লার্নিং পূর্বাভাস',
  abstract_en = $t$<p>Reliable monthly forecasts of rainfall, temperature and humidity support agriculture, water management and disaster preparedness in Bangladesh, but reported machine-learning accuracies are often inflated by data leakage and the absence of baselines. We built a quality-controlled panel of 24 Bangladesh Meteorological Department stations (1981–2022) with temperature, humidity, rainfall, pressure, wind and dew point, with documented range, robust-outlier and consistency checks, zero-coded missing values and conservative imputation.</p><p>One-month-ahead forecasts using only lagged, physically motivated predictors were produced by Ridge regression, decision tree, random forest, support vector regression, k-nearest neighbours, XGBoost, multilayer perceptron, LSTM and GRU models and compared with climatology, persistence, seasonal naive and SARIMA forecasts. Hyperparameters were selected by nested rolling-origin validation on 1982–2017, and models were re-fitted annually over a 2018–2022 test period with 10 random seeds. Performance was assessed with MAE, RMSE, bias, R² and the MSE skill score (MSESS) relative to climatology, Diebold-Mariano tests, seasonal, extreme-event and division-wise verification, leave-one-division-out validation, SHAP interpretation, residual diagnostics and conformal prediction intervals.</p><p>Mean temperature rose significantly by 0.23 °C per decade, while rainfall and humidity trends were not significant. ML added modest but variable-dependent skill over climatology (best MSESS: rainfall +0.21 with SVR, temperature +0.32 with XGBoost, humidity +0.59 with GRU); a per-station SARIMA was the most accurate model for rainfall and humidity; differences among the better ML models, including LSTM and GRU, were mostly not statistically significant; extreme rainfall months were under-predicted by all models; and 90% conformal intervals achieved 0.89–0.97 coverage. A re-analysis showed that an earlier apparent loss of accuracy after tuning arose from unscaled inputs and test-informed manual settings. The results provide a reproducible benchmark and practical guidance for operational use.</p>$t$,
  abstract_bn = $t$<p>নির্ভরযোগ্য মাসিক বৃষ্টিপাত, তাপমাত্রা ও আর্দ্রতার পূর্বাভাস বাংলাদেশে কৃষি, পানি ব্যবস্থাপনা ও দুর্যোগ প্রস্তুতিতে সহায়ক, কিন্তু প্রকাশিত মেশিন লার্নিং ফলাফল প্রায়ই ডেটা লিকেজ ও বেসলাইনের অভাবে অতিরঞ্জিত হয়। আমরা বাংলাদেশ আবহাওয়া অধিদপ্তরের ২৪টি স্টেশনের (১৯৮১–২০২২) মান-নিয়ন্ত্রিত প্যানেল তৈরি করেছি, যাতে তাপমাত্রা, আর্দ্রতা, বৃষ্টিপাত, চাপ, বায়ু ও শিশিরাঙ্ক রয়েছে, নথিভুক্ত পরিসর, আউটলায়ার ও সামঞ্জস্য যাচাই এবং সংযত ইমপুটেশনসহ।</p><p>শুধু পূর্ববর্তী মাসের, ভৌতভাবে অর্থবহ প্রেডিক্টর দিয়ে নয়টি মেশিন লার্নিং ও ডিপ লার্নিং মডেলে (Ridge, ডিসিশন ট্রি, র‍্যান্ডম ফরেস্ট, SVR, KNN, XGBoost, MLP, LSTM, GRU) এক মাস আগের পূর্বাভাস তৈরি করে জলবায়ুগত গড়, পারসিস্টেন্স, সিজনাল নাইভ ও SARIMA-র সাথে তুলনা করা হয়েছে। ১৯৮২–২০১৭ সালে নেস্টেড রোলিং-অরিজিন যাচাইয়ে হাইপারপ্যারামিটার বেছে, ২০১৮–২০২২ সালে প্রতি বছর মডেল পুনঃপ্রশিক্ষিত করা হয়েছে।</p><p>গড় তাপমাত্রা প্রতি দশকে ০.২৩ °C উল্লেখযোগ্যভাবে বেড়েছে; বৃষ্টিপাত ও আর্দ্রতার প্রবণতা উল্লেখযোগ্য নয়। মেশিন লার্নিং জলবায়ুগত গড়ের তুলনায় পরিমিত কিন্তু ভেরিয়েবল-নির্ভর দক্ষতা যোগ করেছে (সেরা MSESS: বৃষ্টিপাত +০.২১ SVR, তাপমাত্রা +০.৩২ XGBoost, আর্দ্রতা +০.৫৯ GRU); বৃষ্টিপাত ও আর্দ্রতায় স্টেশনভিত্তিক SARIMA সবচেয়ে নির্ভুল; চরম বৃষ্টির মাস সব মডেলই কম অনুমান করেছে; এবং ৯০% কনফরমাল ইন্টারভাল ০.৮৯–০.৯৭ কভারেজ পেয়েছে। ফলাফল একটি পুনরুৎপাদনযোগ্য বেঞ্চমার্ক ও কার্যকর ব্যবহারের নির্দেশনা দেয়।</p>$t$,
  highlights_en = ARRAY[
    'Leakage-controlled one-month-ahead forecasts at 24 BMD stations (1981–2022): only lagged predictors, scalers fitted on training years, nested rolling-origin tuning on 1982–2017, annual re-fitting over 2018–2022.',
    'ML beats climatology for every target: rainfall RMSE 132.1 mm with SVR (MSESS +0.21) vs 148.4 mm, temperature 0.74 °C with XGBoost (+0.32) vs 0.90 °C, humidity 4.22% with GRU (+0.59) vs 6.58%.',
    'A per-station SARIMA is the most accurate for rainfall (126.5 mm) and humidity (3.79%); LSTM and GRU are not significantly better than tree ensembles or SVR (Diebold-Mariano tests).',
    'Mean temperature rose by 0.23 °C per decade (1982–2022); rainfall and humidity trends are not significant.',
    '90% conformal prediction intervals reach 0.89–0.97 coverage; extreme rainfall months are under-predicted by every model (about −37% to −40% bias).',
    'A step-by-step re-analysis shows the first submission''s near-perfect R² came from the seasonal cycle, unscaled inputs and test-informed settings.'
  ],
  highlights_bn = ARRAY[
    'লিকেজ-নিয়ন্ত্রিত এক মাস আগের পূর্বাভাস, বাংলাদেশ আবহাওয়া অধিদপ্তরের ২৪টি স্টেশনে (১৯৮১–২০২২): শুধু পূর্ববর্তী মাসের প্রেডিক্টর, ট্রেনিং বছরেই স্কেলার ফিট, ১৯৮২–২০১৭ সালে নেস্টেড রোলিং-অরিজিন টিউনিং, ২০১৮–২০২২ সালে বার্ষিক পুনঃপ্রশিক্ষণ।',
    'প্রতিটি লক্ষ্যে মেশিন লার্নিং জলবায়ুগত গড়ের চেয়ে ভালো: বৃষ্টিপাত RMSE ১৩২.১ মিমি SVR (MSESS +০.২১), তুলনায় ১৪৮.৪ মিমি; তাপমাত্রা ০.৭৪ °C XGBoost (+০.৩২), তুলনায় ০.৯০ °C; আর্দ্রতা ৪.২২% GRU (+০.৫৯), তুলনায় ৬.৫৮%।',
    'বৃষ্টিপাত (১২৬.৫ মিমি) ও আর্দ্রতায় (৩.৭৯%) স্টেশনভিত্তিক SARIMA সবচেয়ে নির্ভুল; LSTM ও GRU ট্রি এনসেম্বল বা SVR-এর চেয়ে উল্লেখযোগ্যভাবে ভালো নয়।',
    'গড় তাপমাত্রা প্রতি দশকে ০.২৩ °C বেড়েছে (১৯৮২–২০২২); বৃষ্টিপাত ও আর্দ্রতার প্রবণতা উল্লেখযোগ্য নয়।',
    '৯০% কনফরমাল ইন্টারভাল ০.৮৯–০.৯৭ কভারেজ পেয়েছে; চরম বৃষ্টির মাস সব মডেলই কম অনুমান করে (প্রায় −৩৭% থেকে −৪০% পক্ষপাত)।',
    'ধাপে ধাপে পুনর্বিশ্লেষণে দেখা গেছে প্রথম জমার প্রায়-নিখুঁত R² এসেছিল ঋতুচক্র, স্কেল না করা ইনপুট ও টেস্ট-জানা সেটিং থেকে।'
  ],
  contributions_en = ARRAY[
    'Re-designed the study for the revision around a strictly forecasting, leakage-controlled protocol, and re-analysed the first submission step by step to show where its scores came from.',
    'Built the quality-controlled 24-station panel: range, outlier and consistency checks, zero-coded missing values found and removed, conservative temporal and spatial imputation of predictors only.',
    'Implemented the nine ML / deep-learning models and four baselines with nested rolling-origin tuning, annual re-fitting and repeated seeds.',
    'Ran the verification: skill scores, Diebold-Mariano tests, seasonal, extreme-event and division-wise results, leave-one-division-out tests, SHAP, residual diagnostics and conformal intervals.',
    'Released the code on GitHub, the quality-controlled data on Kaggle and the models with a live demo on Hugging Face, and prepared the response to the reviewers.'
  ],
  contributions_bn = ARRAY[
    'সংশোধনের জন্য গবেষণাটিকে কঠোরভাবে পূর্বাভাসমূলক, লিকেজ-নিয়ন্ত্রিত প্রটোকলে নতুন করে সাজানো, এবং প্রথম জমার ফলাফল কোথা থেকে এসেছে তা ধাপে ধাপে পুনর্বিশ্লেষণ।',
    '২৪ স্টেশনের মান-নিয়ন্ত্রিত প্যানেল তৈরি: পরিসর, আউটলায়ার ও সামঞ্জস্য যাচাই, শূন্য-চিহ্নিত অনুপস্থিত মান শনাক্ত ও বাদ, শুধু প্রেডিক্টরে সংযত সময় ও স্থানভিত্তিক ইমপুটেশন।',
    'নেস্টেড রোলিং-অরিজিন টিউনিং, বার্ষিক পুনঃপ্রশিক্ষণ ও একাধিক সিডসহ নয়টি মডেল ও চারটি বেসলাইন তৈরি।',
    'যাচাই: স্কিল স্কোর, Diebold-Mariano টেস্ট, ঋতু, চরম ঘটনা ও বিভাগভিত্তিক ফলাফল, leave-one-division-out টেস্ট, SHAP, রেসিডুয়াল বিশ্লেষণ ও কনফরমাল ইন্টারভাল।',
    'GitHub-এ কোড, Kaggle-এ মান-নিয়ন্ত্রিত ডেটা ও Hugging Face-এ লাইভ ডেমোসহ মডেল প্রকাশ, এবং রিভিউয়ারদের জবাব প্রস্তুত।'
  ],
  methods = ARRAY['Python', 'scikit-learn', 'XGBoost', 'SVR', 'Random Forest', 'LSTM', 'GRU', 'SARIMA', 'Rolling-Origin Validation', 'Diebold-Mariano Test', 'SHAP', 'Conformal Prediction', 'Time Series'],
  keywords = ARRAY['Monthly Weather Forecasting', 'Machine Learning', 'Rolling-Origin Validation', 'Data Leakage', 'SHAP', 'Conformal Prediction', 'Rainfall', 'Temperature', 'Humidity', 'Bangladesh'],
  show_highlights = true, show_contributions = true, show_methods = true,
  show_case_study = true, show_challenges = true,
  updated_at = now()
WHERE user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60'
  AND title_en ILIKE 'Leakage Controlled Machine Learning Forecasting%';

------------------------------------------------------------------------------
-- 2. Case study (unedited earlier rows make way for the fuller story)
------------------------------------------------------------------------------
DELETE FROM pf_case_study_sections s
USING pf_publications p
WHERE s.publication_id = p.id AND s.updated_at = s.created_at
  AND p.user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60'
  AND p.title_en ILIKE 'Leakage Controlled Machine Learning Forecasting%'
  AND s.heading_en IN ('Problem', 'Approach', 'Results')
  AND s.created_at < now() - interval '1 minute';

INSERT INTO pf_case_study_sections (user_id, publication_id, heading_en, heading_bn, body_en, body_bn, sort_order)
SELECT p.user_id, p.id, v.heading_en, v.heading_bn, v.body_en, v.body_bn, v.ord
FROM pf_publications p
JOIN (VALUES
  (1, 'Problem', 'সমস্যা',
   '<p>Farmers, water managers and disaster agencies in Bangladesh mostly rely on the long-term monthly average (climatology) at a one-month lead. Many ML studies report near-perfect rainfall and temperature accuracy, but those numbers are often <strong>inflated by data leakage</strong>, missing baselines and no error bars: a forecast is only useful if it is demonstrably better than climatology.</p>',
   '<p>বাংলাদেশের কৃষক, পানি ব্যবস্থাপক ও দুর্যোগ সংস্থা এক মাস আগের জন্য মূলত দীর্ঘমেয়াদি মাসিক গড়ের (জলবায়ুগত গড়) ওপর নির্ভর করে। অনেক মেশিন লার্নিং গবেষণা প্রায়-নিখুঁত নির্ভুলতা দাবি করে, কিন্তু সেই সংখ্যা প্রায়ই <strong>ডেটা লিকেজে অতিরঞ্জিত</strong>, বেসলাইন ও ত্রুটি-সীমা ছাড়া: পূর্বাভাস তখনই কাজের, যখন তা স্পষ্টভাবে জলবায়ুগত গড়ের চেয়ে ভালো।</p>'),
  (2, 'Data', 'ডেটা',
   '<p>A quality-controlled monthly panel of <strong>24 Bangladesh Meteorological Department stations, 1981–2022</strong>, with eight variables: temperature, humidity, rainfall, station pressure, wind speed and direction, and dew point. Range, robust-outlier and consistency checks found zero-coded missing values that had biased earlier series; short gaps were filled conservatively, and the three target variables were never spatially imputed. The panel is public on Kaggle.</p>',
   '<p><strong>বাংলাদেশ আবহাওয়া অধিদপ্তরের ২৪টি স্টেশনের, ১৯৮১–২০২২</strong> সালের মান-নিয়ন্ত্রিত মাসিক প্যানেল, আটটি ভেরিয়েবলসহ: তাপমাত্রা, আর্দ্রতা, বৃষ্টিপাত, স্টেশন চাপ, বায়ুর গতি ও দিক, এবং শিশিরাঙ্ক। পরিসর, আউটলায়ার ও সামঞ্জস্য যাচাইয়ে শূন্য-চিহ্নিত অনুপস্থিত মান ধরা পড়ে, যা আগের সিরিজকে পক্ষপাতদুষ্ট করেছিল; ছোট ফাঁক সংযতভাবে পূরণ করা হয় এবং তিনটি লক্ষ্য ভেরিয়েবল কখনো স্থানভিত্তিকভাবে পূরণ করা হয়নি। প্যানেলটি Kaggle-এ উন্মুক্ত।</p>'),
  (3, 'Approach', 'পদ্ধতি',
   '<p>Every predictor is observed <strong>before</strong> the forecast month: the target''s lags and seasonal means, the previous month''s other variables, neighbouring stations and the station climatology. Nine models (Ridge, decision tree, random forest, SVR, KNN, XGBoost, MLP, <strong>LSTM, GRU</strong>) are compared with climatology, persistence, seasonal naive and SARIMA. Hyperparameters come from <strong>nested rolling-origin validation on 1982–2017</strong>; scalers and climatologies are fitted on training years only; models are re-fitted each year over <strong>2018–2022</strong> (1,440 forecasts per target) with repeated seeds.</p>',
   '<p>প্রতিটি প্রেডিক্টর পূর্বাভাসের মাসের <strong>আগেই</strong> পর্যবেক্ষিত: লক্ষ্যের পূর্ববর্তী মান ও ঋতুগড়, আগের মাসের অন্যান্য ভেরিয়েবল, পার্শ্ববর্তী স্টেশন ও স্টেশনের জলবায়ুগত গড়। নয়টি মডেল (Ridge, ডিসিশন ট্রি, র‍্যান্ডম ফরেস্ট, SVR, KNN, XGBoost, MLP, <strong>LSTM, GRU</strong>) জলবায়ুগত গড়, পারসিস্টেন্স, সিজনাল নাইভ ও SARIMA-র সাথে তুলনা। হাইপারপ্যারামিটার আসে <strong>১৯৮২–২০১৭ সালের নেস্টেড রোলিং-অরিজিন যাচাই</strong> থেকে; স্কেলার ও জলবায়ুগত গড় শুধু ট্রেনিং বছরে ফিট; <strong>২০১৮–২০২২</strong> সালে প্রতি বছর পুনঃপ্রশিক্ষণ (প্রতি লক্ষ্যে ১,৪৪০টি পূর্বাভাস)।</p>'),
  (4, 'Results', 'ফলাফল',
   '<p>ML beats climatology for all three targets, but the gain is <strong>modest and variable-dependent</strong>: rainfall SVR 132.1 mm RMSE (MSESS +0.21), temperature XGBoost 0.74 °C (+0.32), humidity GRU 4.22% (+0.59). A per-station <strong>SARIMA</strong> is the most accurate for rainfall and humidity, and differences among the better ML models are mostly not significant. Every model is far better than persistence. Mean temperature rose by <strong>0.23 °C per decade</strong>.</p>',
   '<p>তিনটি লক্ষ্যেই মেশিন লার্নিং জলবায়ুগত গড়ের চেয়ে ভালো, তবে লাভ <strong>পরিমিত ও ভেরিয়েবল-নির্ভর</strong>: বৃষ্টিপাতে SVR ১৩২.১ মিমি RMSE (MSESS +০.২১), তাপমাত্রায় XGBoost ০.৭৪ °C (+০.৩২), আর্দ্রতায় GRU ৪.২২% (+০.৫৯)। বৃষ্টিপাত ও আর্দ্রতায় স্টেশনভিত্তিক <strong>SARIMA</strong> সবচেয়ে নির্ভুল, এবং ভালো মডেলগুলোর পার্থক্য বেশিরভাগই উল্লেখযোগ্য নয়। সব মডেলই পারসিস্টেন্সের চেয়ে অনেক ভালো। গড় তাপমাত্রা <strong>প্রতি দশকে ০.২৩ °C</strong> বেড়েছে।</p>'),
  (5, 'Why the model decides', 'মডেল কীভাবে সিদ্ধান্ত নেয়',
   '<p><strong>SHAP</strong> shows physically sensible behaviour, consistent across random forest and XGBoost: the models first reproduce the seasonal cycle (station climatology) and then adjust it with recent anomalies. Rainfall leans on climatology, last month''s dew point and rainfall and neighbouring stations'' rainfall; temperature on climatology and last month''s temperature; humidity on last month''s humidity, which captures its persistent anomalies.</p>',
   '<p><strong>SHAP</strong> দেখায় ভৌতভাবে যুক্তিসঙ্গত আচরণ, র‍্যান্ডম ফরেস্ট ও XGBoost-এ একই রকম: মডেল আগে ঋতুচক্র (স্টেশনের জলবায়ুগত গড়) তৈরি করে, তারপর সাম্প্রতিক বিচ্যুতি দিয়ে সমন্বয় করে। বৃষ্টিপাত নির্ভর করে জলবায়ুগত গড়, আগের মাসের শিশিরাঙ্ক ও বৃষ্টি এবং পার্শ্ববর্তী স্টেশনের বৃষ্টির ওপর; তাপমাত্রা জলবায়ুগত গড় ও আগের মাসের তাপমাত্রার ওপর; আর্দ্রতা আগের মাসের আর্দ্রতার ওপর।</p>'),
  (6, 'Honest uncertainty', 'সৎ অনিশ্চয়তা',
   '<p>Point forecasts come with season-stratified <strong>conformal prediction intervals</strong>: 90% intervals reach 0.89–0.97 empirical coverage. Skill holds up for divisions left out of training (leave-one-division-out). The weak spot is stated plainly: <strong>extreme rainfall months are under-predicted by every model</strong> (about −37% to −40% relative bias).</p>',
   '<p>পয়েন্ট পূর্বাভাসের সাথে ঋতুভিত্তিক <strong>কনফরমাল প্রেডিকশন ইন্টারভাল</strong>: ৯০% ইন্টারভাল ০.৮৯–০.৯৭ প্রকৃত কভারেজ পায়। ট্রেনিংয়ে বাদ রাখা বিভাগেও দক্ষতা বজায় থাকে (leave-one-division-out)। দুর্বলতা স্পষ্টভাবে বলা হয়েছে: <strong>চরম বৃষ্টির মাস সব মডেলই কম অনুমান করে</strong> (প্রায় −৩৭% থেকে −৪০% আপেক্ষিক পক্ষপাত)।</p>'),
  (7, 'Limitations & next steps', 'সীমাবদ্ধতা ও পরবর্তী ধাপ',
   '<ul><li><p>Station observations only: no ENSO, Indian Ocean Dipole, sea-surface temperatures, reanalysis or dynamical model output.</p></li><li><p>Five test years, so seasonal and extreme-event statistics rest on limited samples; no daily rainfall and no archived operational NWP forecasts to compare.</p></li><li><p>Next: hybrid statistical-dynamical forecasts with large-scale climate indices, daily rainfall from gauge archives, and probabilistic forecasts of heavy-rainfall months.</p></li></ul>',
   '<ul><li><p>শুধু স্টেশন পর্যবেক্ষণ: ENSO, ভারত মহাসাগর ডাইপোল, সমুদ্রপৃষ্ঠের তাপমাত্রা, রিঅ্যানালাইসিস বা ডায়নামিক মডেলের আউটপুট নেই।</p></li><li><p>পাঁচটি টেস্ট বছর, তাই ঋতু ও চরম ঘটনার পরিসংখ্যান সীমিত নমুনানির্ভর; দৈনিক বৃষ্টিপাত ও আর্কাইভ করা NWP পূর্বাভাসের সাথে তুলনা নেই।</p></li><li><p>পরবর্তী: বৃহৎ পরিসরের জলবায়ু সূচকসহ হাইব্রিড পরিসংখ্যান-ডায়নামিক পূর্বাভাস, গেজ আর্কাইভ থেকে দৈনিক বৃষ্টিপাত, এবং ভারী বৃষ্টির মাসের সম্ভাব্যতাভিত্তিক পূর্বাভাস।</p></li></ul>')
) AS v(ord, heading_en, heading_bn, body_en, body_bn) ON true
WHERE p.user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60'
  AND p.title_en ILIKE 'Leakage Controlled Machine Learning Forecasting%'
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
  AND p.title_en ILIKE 'Leakage Controlled Machine Learning Forecasting%'
  AND c.sort_order IN (1, 2)
  AND c.created_at < now() - interval '1 minute';

INSERT INTO pf_challenges (user_id, publication_id, challenge_en, challenge_bn, solution_en, solution_bn, result_en, result_bn, sort_order)
SELECT p.user_id, p.id, v.c_en, v.c_bn, v.s_en, v.s_bn, v.r_en, v.r_bn, v.ord
FROM pf_publications p
JOIN (VALUES
  (1,
   '<p>The first submission reported near-perfect scores, but its predictors included same-month observations and its scaling used the test years: an estimation task dressed up as a forecast.</p>',
   '<p>প্রথম জমায় প্রায়-নিখুঁত ফলাফল ছিল, কিন্তু প্রেডিক্টরে একই মাসের পর্যবেক্ষণ ছিল এবং স্কেলিংয়ে টেস্ট বছর ব্যবহৃত হয়েছিল: পূর্বাভাসের রূপে আসলে অনুমানের কাজ।</p>',
   '<p>Rebuilt the protocol so every predictor is observed before the forecast month, with scalers and climatologies fitted on training years only, and reproduced the old experiment step by step to show what each correction changes.</p>',
   '<p>প্রটোকল নতুন করে তৈরি, যাতে প্রতিটি প্রেডিক্টর পূর্বাভাসের মাসের আগে পর্যবেক্ষিত এবং স্কেলার ও জলবায়ুগত গড় শুধু ট্রেনিং বছরে ফিট; আর পুরোনো পরীক্ষা ধাপে ধাপে পুনরুৎপাদন করে প্রতিটি সংশোধনের প্রভাব দেখানো।</p>',
   '<p>Honest skill scores against climatology, and a clear account of where the old numbers came from.</p>',
   '<p>জলবায়ুগত গড়ের বিপরীতে সৎ স্কিল স্কোর, এবং পুরোনো সংখ্যা কোথা থেকে এসেছিল তার স্পষ্ট ব্যাখ্যা।</p>'),
  (2,
   '<p>Tuning seemed to make several models worse, which made no sense.</p>',
   '<p>টিউনিংয়ে কয়েকটি মডেল খারাপ হচ্ছে বলে মনে হচ্ছিল, যা অযৌক্তিক।</p>',
   '<p>Traced it to unscaled inputs for distance- and kernel-based models and to "manual" settings chosen while looking at test results; replaced them with nested rolling-origin tuning on 1982–2017 only.</p>',
   '<p>কারণ খুঁজে পাওয়া: দূরত্ব ও কার্নেল-ভিত্তিক মডেলে স্কেল না করা ইনপুট, এবং টেস্ট ফলাফল দেখে বেছে নেওয়া "ম্যানুয়াল" সেটিং; সেগুলোর বদলে শুধু ১৯৮২–২০১৭ সালে নেস্টেড রোলিং-অরিজিন টিউনিং।</p>',
   '<p>Tuned models now improve on the defaults, and every setting is chosen without seeing the test years.</p>',
   '<p>টিউন করা মডেল এখন ডিফল্টের চেয়ে ভালো, এবং প্রতিটি সেটিং টেস্ট বছর না দেখেই বেছে নেওয়া।</p>'),
  (3,
   '<p>Some station records used zeros for missing values, which quietly biased the national series.</p>',
   '<p>কিছু স্টেশনের রেকর্ডে অনুপস্থিত মানের জায়গায় শূন্য ছিল, যা জাতীয় সিরিজকে নীরবে পক্ষপাতদুষ্ট করেছিল।</p>',
   '<p>Added range, robust-outlier and consistency checks, removed zero-coded values, and filled only short gaps (temporal) and auxiliary predictors (spatial), never the targets.</p>',
   '<p>পরিসর, আউটলায়ার ও সামঞ্জস্য যাচাই যোগ, শূন্য-চিহ্নিত মান বাদ, এবং শুধু ছোট ফাঁক (সময়ভিত্তিক) ও সহায়ক প্রেডিক্টর (স্থানভিত্তিক) পূরণ, লক্ষ্য ভেরিয়েবল কখনো নয়।</p>',
   '<p>A clean, documented 24-station panel, published on Kaggle.</p>',
   '<p>পরিষ্কার, নথিভুক্ত ২৪ স্টেশনের প্যানেল, Kaggle-এ প্রকাশিত।</p>'),
  (4,
   '<p>High R² values looked impressive but mostly reflected the seasonal cycle that climatology already captures.</p>',
   '<p>উচ্চ R² চমকপ্রদ দেখালেও মূলত ঋতুচক্রই প্রতিফলিত করছিল, যা জলবায়ুগত গড় আগেই ধরে।</p>',
   '<p>Ranked models by the MSE skill score against climatology, with Diebold-Mariano significance tests and repeated seeds.</p>',
   '<p>জলবায়ুগত গড়ের বিপরীতে MSE স্কিল স্কোর দিয়ে মডেল র‍্যাঙ্ক, Diebold-Mariano তাৎপর্য টেস্ট ও একাধিক সিডসহ।</p>',
   '<p>A fair ranking that shows where ML truly helps and where SARIMA is just as good.</p>',
   '<p>ন্যায্য র‍্যাঙ্কিং, যা দেখায় কোথায় মেশিন লার্নিং সত্যিই সাহায্য করে আর কোথায় SARIMA সমান ভালো।</p>'),
  (5,
   '<p>A single number per forecast hides how uncertain it is, especially in the monsoon.</p>',
   '<p>প্রতিটি পূর্বাভাসে একটি সংখ্যা অনিশ্চয়তা লুকিয়ে রাখে, বিশেষ করে বর্ষায়।</p>',
   '<p>Added season-stratified split-conformal prediction intervals.</p>',
   '<p>ঋতুভিত্তিক split-conformal প্রেডিকশন ইন্টারভাল যোগ।</p>',
   '<p>90% intervals with 0.89–0.97 empirical coverage.</p>',
   '<p>০.৮৯–০.৯৭ প্রকৃত কভারেজসহ ৯০% ইন্টারভাল।</p>')
) AS v(ord, c_en, c_bn, s_en, s_bn, r_en, r_bn) ON true
WHERE p.user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60'
  AND p.title_en ILIKE 'Leakage Controlled Machine Learning Forecasting%'
  AND NOT EXISTS (
    SELECT 1 FROM pf_challenges c WHERE c.publication_id = p.id AND c.sort_order = v.ord
  );

------------------------------------------------------------------------------
-- 4. Its released models, data and code: description and tags
--    (the released models are the XGBoost / SVR ones on Hugging Face, so
--    their own figures stay)
------------------------------------------------------------------------------
UPDATE pf_research_artifacts a SET
  description_en = 'XGBoost and SVR models forecasting next month''s temperature, rainfall and humidity at 24 BMD stations, with season-stratified conformal intervals. Comes with the quality-controlled station panel (1981–2022) on Kaggle and the full, reproducible code on GitHub.',
  description_bn = '২৪টি স্টেশনে পরের মাসের তাপমাত্রা, বৃষ্টিপাত ও আর্দ্রতার পূর্বাভাস দেওয়া XGBoost ও SVR মডেল, ঋতুভিত্তিক কনফরমাল ইন্টারভালসহ। Kaggle-এ মান-নিয়ন্ত্রিত স্টেশন প্যানেল (১৯৮১–২০২২) ও GitHub-এ পূর্ণ, পুনরুৎপাদনযোগ্য কোডসহ।',
  tags = ARRAY['XGBoost', 'SVR', 'Time Series', 'Conformal Prediction', 'Weather', 'Bangladesh', 'Reproducibility'],
  publication_id = p.id,
  updated_at = now()
FROM pf_publications p
WHERE a.user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60'
  AND a.model_url = 'https://huggingface.co/abir71/bd-weather-forecast-models'
  AND p.user_id = a.user_id
  AND p.title_en ILIKE 'Leakage Controlled Machine Learning Forecasting%';

COMMIT;
