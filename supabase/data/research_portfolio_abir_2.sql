-- Research portfolio, part 2, for Abir Hosen (IAM user 88b3efb5-…).
-- Run in the Supabase SQL editor AFTER migration 064. Safe to re-run.
--
--   * Facebook link removed from the profile.
--   * Datasets: the cyberbullying set is private; three more datasets added
--     (two private). Private ones stay listed with a Private tag.
--   * The Hugging Face models as projects, in every version, listed first.

BEGIN;

UPDATE pf_profile SET facebook = NULL, updated_at = now()
WHERE user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60';

UPDATE pf_research_artifacts SET is_private = true, updated_at = now()
WHERE user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60'
  AND url = 'https://www.kaggle.com/datasets/abirhosenashik/bangla-comments-bullying-sentiment';

------------------------------------------------------------------------------
-- More datasets
------------------------------------------------------------------------------
INSERT INTO pf_research_artifacts (user_id, kind, platform, title_en, description_en, url, publication_id, metrics, tags, is_private, sort_order)
SELECT '88b3efb5-8c58-486e-a3f7-751cc4b23e60', 'dataset', 'kaggle', v.title, v.description, v.url,
  (SELECT p.id FROM pf_publications p
   WHERE p.user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60' AND v.paper IS NOT NULL AND p.title_en ILIKE v.paper || '%'
   LIMIT 1),
  v.metrics, v.tags, v.is_private, v.sort_order
FROM (VALUES
  ('Maternal & Fetal Health Risk Data',
   'Clinical pregnancy records from local hospitals in Bangladesh (blood pressure, blood glucose, TSH, SGPT, fetal heart rate, amniotic fluid, fetal movement and more), labelled low / mid / high risk.',
   'https://www.kaggle.com/datasets/abirhosenashik/maternal-fetal-health-risk-data',
   'Artificial Intelligence and Neural Network Based Maternal', ARRAY['19 clinical features', '3 risk levels'],
   ARRAY['Healthcare', 'Tabular', 'Bangladesh'], true, 9),
  ('Bangladesh Hourly NASA Weather Report: 64 Districts, 26 Years',
   'Hourly weather records from NASA for all 64 districts of Bangladesh over 26 years, for climate and forecasting research.',
   'https://www.kaggle.com/datasets/abirhosenashik/bd-hourly-nasa-weather-report-64-districts-26-year',
   NULL, ARRAY['64 districts', '26 years', 'hourly'],
   ARRAY['Weather', 'Time Series', 'Bangladesh'], true, 10),
  ('Embedded IMDB Dataset (Sentence Transformer)',
   'The IMDB 50K movie reviews with their sentence-transformer embeddings, ready for training classifiers without re-encoding.',
   'https://www.kaggle.com/datasets/abirhosenashik/embedded-imdb-dataset-sentence-transformer',
   NULL, ARRAY['50K reviews', 'sentence embeddings'],
   ARRAY['NLP', 'Embeddings', 'Sentiment'], false, 11)
) AS v(title, description, url, paper, metrics, tags, is_private, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM pf_research_artifacts a
  WHERE a.user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60' AND a.url = v.url
);

------------------------------------------------------------------------------
-- The Hugging Face models as projects: every version, before the others
-- (negative sort_order), on the home page.
------------------------------------------------------------------------------
INSERT INTO pf_projects (user_id, title_en, duration_en, description_en, responsibilities_en, tech_stack, link, is_featured, show_on_home, sort_order)
SELECT '88b3efb5-8c58-486e-a3f7-751cc4b23e60', v.title, 'Open research model · Hugging Face', v.description, v.points, v.tech, v.link, true, true, v.sort_order
FROM (VALUES
  ('Bangla Fake News Detection (Bangla BERT)',
   '<p>Fine-tuned Bangla BERT that scores a Bangla news article as fake or authentic, from the IJACR (2026) paper. Published on Hugging Face with a live demo that runs fully in the browser.</p>',
   ARRAY['94.49% accuracy, 89.03% F1 and 98.36% ROC-AUC on the held-out test set.', '8-bit ONNX copy (658 MB → 165 MB) for in-browser inference.', 'Live demo: huggingface.co/spaces/abir71/bangla-fake-news-demo'],
   ARRAY['Python', 'PyTorch', 'Transformers', 'Bangla BERT', 'ONNX'],
   'https://huggingface.co/abir71/bangla-fake-news-bert', -5),
  ('Maternal & Fetal Health Risk Prediction',
   '<p>Random forest and an explainable decision tree that classify a pregnancy record as low, mid or high risk from 19 clinical measurements, from the CCDS (2026) paper.</p>',
   ARRAY['Found train/test duplication in the source data and re-evaluated on the 100 unique patients with 20× repeated 5-fold CV: 75.6% accuracy.', 'Live demo: huggingface.co/spaces/abir71/maternal-fetal-risk-demo'],
   ARRAY['Python', 'Scikit-learn', 'Random Forest', 'Pandas'],
   'https://huggingface.co/abir71/maternal-fetal-risk-models', -4),
  ('Bangladesh Monthly Weather Forecasting',
   '<p>Leakage-controlled one-month-ahead forecasts of temperature, rainfall and humidity at 24 BMD stations, with conformal prediction intervals.</p>',
   ARRAY['Temperature RMSE 0.74 °C (R² 0.963), humidity RMSE 4.35% (R² 0.842) on 2018–2022.', '90% intervals with 0.90–0.94 empirical coverage.', 'Live demo: huggingface.co/spaces/abir71/bd-weather-forecast-demo'],
   ARRAY['Python', 'XGBoost', 'SVR', 'Time Series', 'Scikit-learn'],
   'https://huggingface.co/abir71/bd-weather-forecast-models', -3),
  ('Bangla Cyberbullying Detection',
   '<p>Two-stage classifier for Bangla-script, Romanized and code-mixed comments: sentiment probabilities over 9 classes feed a bullying / non-bullying / neutral classifier.</p>',
   ARRAY['Built on a 3,150-comment YouTube/Facebook dataset labelled by 3 annotators.', 'Live demo: huggingface.co/spaces/abir71/bangla-cyberbullying-demo'],
   ARRAY['Python', 'NLP', 'TF-IDF', 'Logistic Regression', 'Scikit-learn'],
   'https://huggingface.co/abir71/bangla-cyberbullying-two-stage', -2),
  ('Movie Review Sentiment Analysis (MPNet)',
   '<p>Comparison of BoW, TF-IDF and sentence-embedding features across 6 classifiers on IMDB 50K; the best lightweight model is published and runs in the browser.</p>',
   ARRAY['MPNet embeddings + logistic regression: 91.11% accuracy, 96.94% ROC-AUC after removing duplicate reviews.', 'Live demo: huggingface.co/spaces/abir71/imdb-sentiment-demo'],
   ARRAY['Python', 'Sentence Transformers', 'MPNet', 'Scikit-learn', 'ONNX'],
   'https://huggingface.co/abir71/imdb-sentiment-mpnet', -1)
) AS v(title, description, points, tech, link, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM pf_projects p
  WHERE p.user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60' AND p.link = v.link
);

COMMIT;
