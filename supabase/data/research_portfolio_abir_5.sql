-- Research portfolio, part 5, for Abir Hosen (IAM user 88b3efb5-…).
-- Run in the Supabase SQL editor AFTER migration 073. Safe to re-run.
-- Merges each paper's separate dataset / code entry into its model entry, so
-- one card carries Model, Demo, Dataset and Code links. Private datasets stay
-- private (only their link). The merged-away rows are deleted.
-- Left alone: Bangla Fake News (model only) and the NASA hourly weather data.

BEGIN;

-- Into the model (by its Hugging Face link) go the other rows (by their links).
CREATE TEMP TABLE merge_plan (model_url TEXT, other_url TEXT) ON COMMIT DROP;
INSERT INTO merge_plan VALUES
  ('https://huggingface.co/abir71/bd-weather-forecast-models',   'https://www.kaggle.com/datasets/abirhosenashik/bangladesh-bmd-station-weather-data-19812022-qc'),
  ('https://huggingface.co/abir71/bd-weather-forecast-models',   'https://github.com/abir-hosen-ashik/bd-monthly-weather-forecast-ml-paper'),
  ('https://huggingface.co/abir71/maternal-fetal-risk-models',   'https://www.kaggle.com/datasets/abirhosenashik/maternal-fetal-health-risk-data'),
  ('https://huggingface.co/abir71/bangla-cyberbullying-two-stage','https://www.kaggle.com/datasets/abirhosenashik/bangla-comments-bullying-sentiment'),
  ('https://huggingface.co/abir71/imdb-sentiment-mpnet',         'https://www.kaggle.com/datasets/abirhosenashik/embedded-imdb-dataset-sentence-transformer');

UPDATE pf_research_artifacts m SET
  kinds = ARRAY(SELECT DISTINCT unnest(m.kinds || o.kinds) ORDER BY 1),
  dataset_url = COALESCE(m.dataset_url, o.dataset_url),
  code_url = COALESCE(m.code_url, o.code_url),
  private_kinds = ARRAY(SELECT DISTINCT unnest(m.private_kinds || o.private_kinds)),
  metrics = m.metrics || ARRAY(SELECT x FROM unnest(o.metrics) x WHERE x <> ALL (m.metrics)),
  tags = m.tags || ARRAY(SELECT x FROM unnest(o.tags) x WHERE x <> ALL (m.tags)),
  publication_id = COALESCE(m.publication_id, o.publication_id),
  updated_at = now()
FROM merge_plan p
JOIN pf_research_artifacts o ON o.user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60'
  AND COALESCE(o.dataset_url, o.code_url, o.url) = p.other_url
WHERE m.user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60' AND m.model_url = p.model_url AND o.id <> m.id;

-- A second pass for the weather model, which takes two rows (one UPDATE
-- applies only one joined row per target).
UPDATE pf_research_artifacts m SET
  kinds = ARRAY(SELECT DISTINCT unnest(m.kinds || o.kinds) ORDER BY 1),
  dataset_url = COALESCE(m.dataset_url, o.dataset_url),
  code_url = COALESCE(m.code_url, o.code_url),
  private_kinds = ARRAY(SELECT DISTINCT unnest(m.private_kinds || o.private_kinds)),
  metrics = m.metrics || ARRAY(SELECT x FROM unnest(o.metrics) x WHERE x <> ALL (m.metrics)),
  tags = m.tags || ARRAY(SELECT x FROM unnest(o.tags) x WHERE x <> ALL (m.tags)),
  updated_at = now()
FROM merge_plan p
JOIN pf_research_artifacts o ON o.user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60'
  AND COALESCE(o.dataset_url, o.code_url, o.url) = p.other_url
WHERE m.user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60' AND m.model_url = p.model_url AND o.id <> m.id
  AND NOT (o.kinds <@ m.kinds AND COALESCE(o.dataset_url, o.code_url) IN (m.dataset_url, m.code_url));

-- Rows now carried by their model: gone (only once their link is on the model).
DELETE FROM pf_research_artifacts o
USING merge_plan p, pf_research_artifacts m
WHERE o.user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60' AND m.user_id = o.user_id
  AND COALESCE(o.dataset_url, o.code_url, o.url) = p.other_url AND m.model_url = p.model_url AND o.id <> m.id
  AND p.other_url IN (m.dataset_url, m.code_url);

COMMIT;

-- Check:
-- SELECT title_en, kinds, private_kinds, model_url IS NOT NULL m, dataset_url IS NOT NULL d, code_url IS NOT NULL c
--   FROM pf_research_artifacts WHERE user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60' ORDER BY sort_order;
