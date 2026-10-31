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
