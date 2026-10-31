-- Research portfolio, part 4, for Abir Hosen (IAM user 88b3efb5-…).
-- Run in the Supabase SQL editor AFTER migration 070.
-- Fills key findings, contributions and methods for the four papers; only
-- where they are still empty, so edits made in batools are kept.

UPDATE pf_publications p SET
  highlights_en = v.highlights, contributions_en = v.contributions, methods = v.methods, updated_at = now()
FROM (VALUES
  ('Artificial Intelligence and Neural Network Based Maternal',
   ARRAY[
     'Seven classifiers compared for low / mid / high pregnancy risk from clinical records collected in Bangladesh.',
     'Sensitivity analysis ranks blood pressure, fetal movement, fetal heart rate and amniotic fluid as the strongest risk drivers.',
     'Re-evaluated on the 100 unique patients after finding train/test duplication: random forest 75.6% accuracy, 74.3% macro F1 (20× repeated 5-fold CV).'],
   ARRAY[
     'Built the preprocessing pipeline: categorical encoding, missing-value imputation, feature selection and scaling.',
     'Trained and compared MLR, Naive Bayes, KNN, SVM, Decision Tree, Random Forest and an MLP neural network.',
     'Ran the sensitivity analysis and released the models with a live demo on Hugging Face.'],
   ARRAY['Python', 'Scikit-learn', 'TensorFlow', 'Random Forest', 'MLP', 'Sensitivity Analysis', 'Cross-Validation']),
  ('Combating deep-fake news in Bengali',
   ARRAY[
     'Fine-tuned Bangla BERT reaches 94.49% accuracy, 89.03% F1 and 98.36% ROC-AUC on Bengali news.',
     'Clearly outperforms Logistic Regression, Decision Tree, Random Forest and Gradient Boosting baselines.',
     'Performance keeps growing with training data, a baseline for real-world Bangla misinformation detection.'],
   ARRAY[
     'Built Bangla text preprocessing and TF-IDF baselines with class-imbalance handling and cross-validation.',
     'Fine-tuned Bangla BERT and ran the learning-curve experiments.',
     'Published the model with an 8-bit ONNX copy (658 MB → 165 MB) that runs in the browser demo.'],
   ARRAY['Python', 'PyTorch', 'Transformers', 'Bangla BERT', 'TF-IDF', 'Scikit-learn', 'ONNX']),
  ('Leakage Controlled Machine Learning Forecasting',
   ARRAY[
     'One-month-ahead forecasts at 24 BMD stations beat the station climatology for every target.',
     'Temperature RMSE 0.74 °C (R² 0.963) and humidity RMSE 4.35% (R² 0.842) on 2018–2022.',
     '90% conformal prediction intervals with 0.90–0.94 empirical coverage.'],
   ARRAY[
     'Designed leakage-free features: target lags, neighbouring-station values and station climatology.',
     'Set up rolling-origin evaluation with annual re-fitting and compared XGBoost, SVR and SARIMA baselines.',
     'Added season-stratified conformal intervals and released the models with a live demo.'],
   ARRAY['Python', 'XGBoost', 'SVR', 'SARIMA', 'Time Series', 'Conformal Prediction', 'Rolling-Origin Validation']),
  ('Artificial Neural Networks from Classical Models to Foundation Models',
   ARRAY[
     'PRISMA 2020-guided review of 396 studies plus a bibliometric analysis of 1,118,496 OpenAlex records.',
     'An integrated five-dimension taxonomy: architecture, learning paradigm, optimization, application and deployment.',
     'Compares modern families from CNNs to Transformers, diffusion, graph, spiking, neural-operator and state-space models.'],
   ARRAY[
     'Worked on the revised manuscript: the systematic search, screening and reference verification.',
     'Prepared the bibliometric analysis and the comparative tables.'],
   ARRAY['PRISMA 2020', 'Systematic Review', 'Bibliometric Analysis', 'OpenAlex', 'Python'])
) AS v(title, highlights, contributions, methods)
WHERE p.user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60' AND p.title_en ILIKE v.title || '%'
  AND p.highlights_en = '{}' AND p.contributions_en = '{}';

------------------------------------------------------------------------------
-- Case study and challenges & solutions for the papers that have none yet
-- (the maternal & fetal health paper already has its own, so it is left as is).
------------------------------------------------------------------------------
INSERT INTO pf_case_study_sections (user_id, publication_id, heading_en, body_en, sort_order)
SELECT p.user_id, p.id, v.heading, v.body, v.ord
FROM pf_publications p
JOIN (VALUES
  ('Combating deep-fake news in Bengali', 1, 'Problem',
   '<p>Manipulated news spreads fast on Bangla social media, but Bengali is a low-resource language: few labelled datasets and few models built for it.</p>'),
  ('Combating deep-fake news in Bengali', 2, 'Approach',
   '<p>TF-IDF baselines with Logistic Regression, Decision Tree, Random Forest and Gradient Boosting, compared against a fine-tuned <strong>Bangla BERT</strong>, with class-imbalance handling and cross-validation on BanFakeNews.</p>'),
  ('Combating deep-fake news in Bengali', 3, 'Results',
   '<p>Bangla BERT reached <strong>94.49% accuracy</strong> and <strong>98.36% ROC-AUC</strong>, well ahead of the classical models; learning curves show it keeps improving with more data. The model is public, with a browser demo.</p>'),
  ('Leakage Controlled Machine Learning Forecasting', 1, 'Problem',
   '<p>Monthly rainfall, temperature and humidity forecasts matter for agriculture and planning in Bangladesh, but many published ML results quietly use information from the future and report numbers that do not hold up.</p>'),
  ('Leakage Controlled Machine Learning Forecasting', 2, 'Approach',
   '<p>Only data observed up to the end of the current month is used: target lags, neighbouring stations and station climatology. Models are chosen by rolling-origin cross-validation on data up to 2017 and tested on 2018–2022 with annual re-fitting, against climatology and SARIMA baselines.</p>'),
  ('Leakage Controlled Machine Learning Forecasting', 3, 'Results',
   '<p>Every model beats climatology; temperature RMSE <strong>0.74 °C</strong> (R² 0.963) and humidity RMSE <strong>4.35%</strong>. Conformal intervals give honest 90% ranges with 0.90–0.94 coverage.</p>'),
  ('Artificial Neural Networks from Classical Models to Foundation Models', 1, 'Problem',
   '<p>Existing reviews cover either classical networks or a single modern family, rarely say how their literature was chosen, and seldom compare architectures side by side.</p>'),
  ('Artificial Neural Networks from Classical Models to Foundation Models', 2, 'Approach',
   '<p>A PRISMA 2020-guided systematic review over OpenAlex (cross-checked in IEEE Xplore and SpringerLink) with a citation-stratified two-tier design, plus a bibliometric analysis of over a million records.</p>'),
  ('Artificial Neural Networks from Classical Models to Foundation Models', 3, 'Results',
   '<p>396 studies synthesised into a five-dimension taxonomy, 22 comparative tables, a conceptual framework and a prioritised research agenda.</p>')
) AS v(title, ord, heading, body) ON p.title_en ILIKE v.title || '%'
WHERE p.user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60'
  AND NOT EXISTS (SELECT 1 FROM pf_case_study_sections s WHERE s.publication_id = p.id);

INSERT INTO pf_challenges (user_id, publication_id, challenge_en, solution_en, result_en, sort_order)
SELECT p.user_id, p.id, v.challenge, v.solution, v.result, v.ord
FROM pf_publications p
JOIN (VALUES
  ('Combating deep-fake news in Bengali', 1,
   '<p>Far fewer fake than authentic articles (about 1 to 3), so a model can look accurate while missing fakes.</p>',
   '<p>Kept the natural ratio, handled the imbalance in training, and reported F1 and recall on the fake class besides accuracy.</p>',
   '<p>89.03% F1 and 90.28% recall on fake news.</p>'),
  ('Combating deep-fake news in Bengali', 2,
   '<p>The fine-tuned model is 658 MB, too heavy for a simple public demo.</p>',
   '<p>Exported an 8-bit ONNX copy that runs in the visitor''s browser.</p>',
   '<p>165 MB, with probabilities within a hair of the full model.</p>'),
  ('Leakage Controlled Machine Learning Forecasting', 1,
   '<p>Random train/test splits and features computed over the whole series leak the future into training.</p>',
   '<p>Built every feature from data up to the forecast month only, and evaluated with rolling origins and annual re-fitting.</p>',
   '<p>Results that reflect real forecasting, compared fairly with climatology and SARIMA.</p>'),
  ('Leakage Controlled Machine Learning Forecasting', 2,
   '<p>A single number per forecast hides how uncertain it is, especially for monsoon rainfall.</p>',
   '<p>Added season-stratified split-conformal prediction intervals.</p>',
   '<p>90% intervals with 0.90–0.94 empirical coverage.</p>'),
  ('Artificial Neural Networks from Classical Models to Foundation Models', 1,
   '<p>Hundreds of thousands of candidate papers: far too many to screen by hand.</p>',
   '<p>A two-tier design: citation-stratified selection per year for the qualitative review, and the full set for the bibliometric analysis.</p>',
   '<p>545 records screened, 396 included, 1,118,496 analysed bibliometrically.</p>'),
  ('Artificial Neural Networks from Classical Models to Foundation Models', 2,
   '<p>Reviewers asked for a reproducible method and verified references.</p>',
   '<p>Reported the full search protocol and PRISMA flow, and checked every reference against its source.</p>',
   '<p>A fully verified list of 257 references.</p>')
) AS v(title, ord, challenge, solution, result) ON p.title_en ILIKE v.title || '%'
WHERE p.user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60'
  AND NOT EXISTS (SELECT 1 FROM pf_challenges c WHERE c.publication_id = p.id);

-- Show them on the site.
UPDATE pf_publications SET show_case_study = true, show_challenges = true, updated_at = now()
WHERE user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60';
