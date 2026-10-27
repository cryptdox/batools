-- Research portfolio content for Abir Hosen (IAM user 88b3efb5-…).
-- Run once in the Supabase SQL editor AFTER migration 063. Safe to re-run:
-- it updates the profile and inserts only rows that are not there yet
-- (versions by slug, publications by title, experience by position, artifacts
-- by URL). New rows are in every version unless tagged otherwise.
-- Everything stays editable in batools → Portfolio afterwards.

BEGIN;

------------------------------------------------------------------------------
-- Versions: Developer (today's site, the default) and Researcher
------------------------------------------------------------------------------
INSERT INTO pf_versions (user_id, slug, name_en, name_bn, layout, is_active, is_default, sort_order,
  title_en, title_bn, affiliation_en, affiliation_bn, statement_en, interests_en, interests_bn)
VALUES
  ('88b3efb5-8c58-486e-a3f7-751cc4b23e60', 'developer', 'Developer', 'ডেভেলপার', 'developer', true, true, 1,
   NULL, NULL, NULL, NULL, NULL, '{}', '{}'),
  ('88b3efb5-8c58-486e-a3f7-751cc4b23e60', 'researcher', 'Researcher', 'গবেষক', 'researcher', true, false, 2,
   'AI Researcher · Machine Learning & Bengali NLP',
   'এআই গবেষক · মেশিন লার্নিং ও বাংলা এনএলপি',
   'Dept. of Information & Communication Engineering, Noakhali Science & Technology University',
   'তথ্য ও যোগাযোগ প্রকৌশল বিভাগ, নোয়াখালী বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়',
   $t$<p>I work on <strong>machine learning for healthcare risk prediction</strong>, <strong>climate forecasting</strong> and <strong>low-resource Bengali NLP</strong> (fake news and cyberbullying detection), with two years of academic research at Noakhali Science &amp; Technology University and about six years of industry engineering.</p><p>My focus is <strong>evaluation you can trust</strong>: removing train/test leakage, reporting honest numbers and giving uncertainty with conformal prediction intervals. I release my research models with live demos on Hugging Face so the results can be checked, and I build LLM systems with RAG and agentic tooling (MCP) in industry.</p>$t$,
   ARRAY[
     'Machine learning for clinical risk prediction',
     'Low-resource Bengali NLP: fake news and cyberbullying',
     'Climate and weather forecasting',
     'Trustworthy evaluation: leakage control, conformal prediction',
     'LLM systems: RAG and agentic tooling (MCP)',
     'Efficient deployment: ONNX and in-browser inference'
   ],
   ARRAY[
     'ক্লিনিক্যাল ঝুঁকি পূর্বাভাসে মেশিন লার্নিং',
     'স্বল্প-সম্পদ বাংলা এনএলপি: ভুয়া খবর ও সাইবার বুলিং',
     'জলবায়ু ও আবহাওয়ার পূর্বাভাস',
     'বিশ্বাসযোগ্য মূল্যায়ন: লিকেজ নিয়ন্ত্রণ, কনফরমাল প্রেডিকশন',
     'এলএলএম সিস্টেম: RAG ও এজেন্টিক টুলিং (MCP)',
     'দক্ষ ডিপ্লয়মেন্ট: ONNX ও ব্রাউজারে ইনফারেন্স'
   ])
ON CONFLICT (user_id, slug) DO NOTHING;

-- Academic links.
UPDATE pf_profile SET huggingface = 'abir71', updated_at = now()
WHERE user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60' AND huggingface IS NULL;

------------------------------------------------------------------------------
-- Publications under review
------------------------------------------------------------------------------
INSERT INTO pf_publications (user_id, title_en, authors, venue, pub_type, status, year, abstract_en, keywords, code_url, show_on_home, sort_order)
SELECT '88b3efb5-8c58-486e-a3f7-751cc4b23e60', v.title, v.authors, NULL, 'journal', 'under_review', 2026, v.abstract, v.keywords, v.code_url, true, v.sort_order
FROM (VALUES
  (
    'Leakage Controlled Machine Learning Forecasting of Monthly Rainfall, Temperature and Humidity Across Bangladesh',
    ARRAY['Joysri Rani Das', 'Md. Ashikur Rahman Khan', 'Ishtiaq Ahammad', 'Abir Hosen'],
    $t$<p>One-month-ahead forecasts of mean temperature, relative humidity and total rainfall at 24 Bangladesh Meteorological Department stations (1981–2022), using only information observed up to the end of the current month. Predictors combine the target's lags and seasonal means, the previous month's other variables, the inverse-distance-weighted values at neighbouring stations and the station climatology. Models are selected by rolling-origin cross-validation and tested on 2018–2022 with annual re-fitting: XGBoost reaches a temperature RMSE of 0.74 °C (R² 0.963) and a humidity RMSE of 4.35% (R² 0.842), and every model beats the station climatology. Season-stratified split-conformal intervals give 90% prediction intervals with 0.90–0.94 empirical coverage.</p>$t$,
    ARRAY['Weather Forecasting', 'Time Series', 'XGBoost', 'Support Vector Regression', 'Data Leakage', 'Conformal Prediction', 'Bangladesh'],
    'https://github.com/abir-hosen-ashik/bd-monthly-weather-forecast-ml-paper',
    3
  ),
  (
    'Artificial Neural Networks from Classical Models to Foundation Models: A Systematic Review and Bibliometric Analysis',
    ARRAY['Farida Siddiqi Prity', 'Md. Ashikur Rahman Khan', 'Ishtiaq Ahmmed', 'Joysri Rani Das', 'Abir Hosen'],
    $t$<p>A PRISMA 2020-guided systematic review of artificial neural networks, complemented by a bibliometric analysis. Records were retrieved from OpenAlex and cross-checked in IEEE Xplore and SpringerLink; 396 studies were included in the qualitative synthesis and 1,118,496 records in the bibliometric analysis. Seven research questions cover architectural evolution, architectures and learning paradigms, comparative performance and cost, application domains, datasets and evaluation measures, open challenges and emerging directions. The review proposes an integrated five-dimension taxonomy (architecture, learning paradigm, optimization, application, deployment), compares modern families from CNNs and recurrent networks to Transformers, diffusion, graph, spiking, neural-operator and state-space models, and closes with a conceptual framework and a prioritized research agenda.</p>$t$,
    ARRAY['Artificial Neural Networks', 'Deep Learning', 'Systematic Review', 'Bibliometric Analysis', 'Taxonomy', 'Transformers', 'Foundation Models'],
    NULL,
    4
  )
) AS v(title, authors, abstract, keywords, code_url, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM pf_publications p
  WHERE p.user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60' AND p.title_en = v.title
);

------------------------------------------------------------------------------
-- Research experience, shown in the Researcher version only.
------------------------------------------------------------------------------
INSERT INTO pf_experiences (user_id, versions, kind, position_en, position_bn, company_en, company_bn, location_en, location_bn, duration_en, duration_bn, responsibilities_en, is_current, show_on_home, sort_order)
SELECT '88b3efb5-8c58-486e-a3f7-751cc4b23e60',
  ARRAY(SELECT id FROM pf_versions WHERE user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60' AND slug = 'researcher'),
  'research',
  'Research Assistant', 'রিসার্চ অ্যাসিস্ট্যান্ট',
  'Dept. of ICE, Noakhali Science & Technology University (under Dr. Md. Ashikur Rahman Khan)',
  'আইসিই বিভাগ, নোয়াখালী বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয় (ড. মো. আশিকুর রহমান খানের তত্ত্বাবধানে)',
  'Noakhali, Bangladesh', 'নোয়াখালী, বাংলাদেশ',
  'Apr 2021 – May 2023', 'এপ্রিল ২০২১ – মে ২০২৩',
  ARRAY[
    'Machine learning and deep learning research on clinical risk prediction, climate forecasting and low-resource Bengali NLP.',
    'Maternal & fetal health: built the preprocessing pipeline for hospital records and compared 7 classifiers (MLR, NB, KNN, SVM, DT, RF, MLP); later detected train/test record duplication and re-evaluated on unique patients with repeated cross-validation.',
    'Bengali fake news: benchmarked classical classifiers against a fine-tuned Bangla BERT (94.49% accuracy, 98.36% ROC-AUC).',
    'Bengali cyberbullying: co-built a 3,150-comment YouTube/Facebook dataset (3 annotators) and a two-stage sentiment-aware classifier.',
    'Weather forecasting: leakage-controlled monthly forecasts for 24 BMD stations with conformal prediction intervals.',
    'Co-authored 2 peer-reviewed journal articles, with 2 more under review; released the models with live demos on Hugging Face.'
  ],
  false, true, 0
WHERE NOT EXISTS (
  SELECT 1 FROM pf_experiences e
  WHERE e.user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60' AND e.kind = 'research' AND e.position_en = 'Research Assistant'
);

------------------------------------------------------------------------------
-- Released models, datasets and code
------------------------------------------------------------------------------
INSERT INTO pf_research_artifacts (user_id, kind, platform, title_en, description_en, url, demo_url, publication_id, metrics, tags, released_on, is_featured, sort_order)
SELECT '88b3efb5-8c58-486e-a3f7-751cc4b23e60', v.kind, v.platform, v.title, v.description, v.url, v.demo_url,
  (SELECT p.id FROM pf_publications p
   WHERE p.user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60' AND v.paper IS NOT NULL AND p.title_en ILIKE v.paper || '%'
   LIMIT 1),
  v.metrics, v.tags, DATE '2026-10-27', v.featured, v.sort_order
FROM (VALUES
  ('model', 'huggingface', 'Bangla Fake News Classifier (Bangla BERT)',
   'Fine-tuned Bangla BERT that scores a Bangla news article as fake or authentic. Ships with an 8-bit ONNX copy (658 MB → 165 MB) that runs fully in the browser.',
   'https://huggingface.co/abir71/bangla-fake-news-bert', 'https://huggingface.co/spaces/abir71/bangla-fake-news-demo',
   'Combating deep-fake news in Bengali', ARRAY['94.49% accuracy', '89.03% F1', '98.36% ROC-AUC'],
   ARRAY['Bangla BERT', 'PyTorch', 'Transformers', 'ONNX'], true, 1),
  ('model', 'huggingface', 'Maternal & Fetal Health Risk Classifiers',
   'Random forest and an explainable depth-3 decision tree that assign a pregnancy record to low, mid or high risk from 19 clinical measurements. Re-evaluated on the 100 unique patient records after finding train/test duplication in the source data.',
   'https://huggingface.co/abir71/maternal-fetal-risk-models', 'https://huggingface.co/spaces/abir71/maternal-fetal-risk-demo',
   'Artificial Intelligence and Neural Network Based Maternal', ARRAY['75.6% accuracy (20× repeated 5-fold CV)', '74.3% macro F1'],
   ARRAY['Scikit-learn', 'Random Forest', 'Healthcare'], true, 2),
  ('model', 'huggingface', 'Bangladesh Monthly Weather Forecast Models',
   'XGBoost and SVR models forecasting next month''s temperature, rainfall and humidity at 24 BMD stations, with conformal prediction intervals.',
   'https://huggingface.co/abir71/bd-weather-forecast-models', 'https://huggingface.co/spaces/abir71/bd-weather-forecast-demo',
   'Leakage Controlled Machine Learning Forecasting', ARRAY['Temperature RMSE 0.74 °C (R² 0.963)', 'Humidity RMSE 4.35% (R² 0.842)', '90% intervals, 0.90–0.94 coverage'],
   ARRAY['XGBoost', 'SVR', 'Time Series'], true, 3),
  ('model', 'huggingface', 'Two-Stage Bangla Cyberbullying Classifier',
   'Sentiment probabilities over 9 classes feed a bullying / non-bullying / neutral classifier, for Bangla-script, Romanized and code-mixed comments. Research use only.',
   'https://huggingface.co/abir71/bangla-cyberbullying-two-stage', 'https://huggingface.co/spaces/abir71/bangla-cyberbullying-demo',
   NULL, ARRAY[]::TEXT[],
   ARRAY['NLP', 'TF-IDF', 'Logistic Regression', 'Code-mixed text'], false, 4),
  ('model', 'huggingface', 'IMDB Movie Review Sentiment (MPNet + Logistic Regression)',
   'Best lightweight configuration from a comparison of BoW, TF-IDF and sentence-embedding features across 6 classifiers on IMDB 50K, evaluated after removing duplicate reviews. Runs in the browser.',
   'https://huggingface.co/abir71/imdb-sentiment-mpnet', 'https://huggingface.co/spaces/abir71/imdb-sentiment-demo',
   NULL, ARRAY['91.11% accuracy', '96.94% ROC-AUC'],
   ARRAY['Sentence Transformers', 'MPNet', 'Scikit-learn'], false, 5),
  ('dataset', 'kaggle', 'Bangladesh BMD Station Weather Data 1981–2022 (quality-controlled)',
   'Quality-controlled monthly station panels from the Bangladesh Meteorological Department, used for the weather forecasting study.',
   'https://www.kaggle.com/datasets/abirhosenashik/bangladesh-bmd-station-weather-data-19812022-qc', NULL,
   'Leakage Controlled Machine Learning Forecasting', ARRAY['24 stations', '1981–2022'],
   ARRAY['Weather', 'Time Series', 'Bangladesh'], false, 6),
  ('dataset', 'kaggle', 'Bangla Comments: Bullying & Sentiment',
   '3,150 YouTube and Facebook comments in Bangla script, Romanized Bangla and code-mixed text, labelled by 3 annotators for bullying and 9 sentiment classes.',
   'https://www.kaggle.com/datasets/abirhosenashik/bangla-comments-bullying-sentiment', NULL,
   NULL, ARRAY['3,150 comments', '3 annotators'],
   ARRAY['NLP', 'Bangla', 'Cyberbullying'], false, 7),
  ('code', 'github', 'Monthly Weather Forecasting: Paper Code',
   'Reproducible code for the leakage-controlled weather forecasting study: data preparation, rolling-origin evaluation and conformal intervals.',
   'https://github.com/abir-hosen-ashik/bd-monthly-weather-forecast-ml-paper', NULL,
   'Leakage Controlled Machine Learning Forecasting', ARRAY[]::TEXT[],
   ARRAY['Python', 'Reproducibility'], false, 8)
) AS v(kind, platform, title, description, url, demo_url, paper, metrics, tags, featured, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM pf_research_artifacts a
  WHERE a.user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60' AND a.url = v.url
);

COMMIT;

-- Check:
-- SELECT kind, title_en, publication_id IS NOT NULL AS linked FROM pf_research_artifacts
--   WHERE user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60' ORDER BY sort_order;
