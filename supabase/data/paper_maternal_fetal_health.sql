-- Everything for one paper, in one go:
--   "Artificial Intelligence and Neural Network Based Maternal and Fetal Health
--    Risk Level Prediction and Sensitivity Analysis During Pregnancy"
--   (Cloud Computing and Data Science 7(2), 2026, doi:10.37256/ccds.7220269481)
-- Run in the Supabase SQL editor (needs migrations up to 073). Safe to re-run.
--
-- Facts are from the published paper. Kept as they are: the title, authors,
-- venue, DOI, links, abstract, BibTeX, and the case study you wrote (Problem,
-- Data and the missing-values challenge). Everything below is added or filled.

BEGIN;

------------------------------------------------------------------------------
-- 1. The paper: key findings, contribution, methods, keywords, switches
------------------------------------------------------------------------------
UPDATE pf_publications SET
  highlights_en = ARRAY[
    'Seven classifiers compared on one protocol (same features, split and metrics): Multinomial Logistic Regression 89.58%, Multinomial Naïve Bayes 80.13%, KNN 100%, linear SVM 90.23%, and Decision Tree, Random Forest and MLP 100% accuracy.',
    'Decision Tree, Random Forest and MLP also reached 100% precision, recall, F1-score and ROC-AUC on the 307-record test set.',
    'On 31 new, unseen samples: Decision Tree 100%, Random Forest 96.77% and MLP 90.32%.',
    'Mean-based sensitivity analysis over all 19 inputs: blood pressure (systolic and diastolic), fetal movement, fetal heart rate and amniotic fluid drive risk the most, followed by BMI, fasting glucose, HbA1c and maternal heart rate.',
    'The pipeline gave the same results in Python (scikit-learn) and MATLAB.',
    'The 100% scores are examined openly: labels come from clinical threshold rules, so the models recover those rules; independent clinical validation is still needed.'
  ],
  highlights_bn = ARRAY[
    'একই প্রটোকলে (একই ফিচার, বিভাজন ও মেট্রিক) সাতটি ক্লাসিফায়ারের তুলনা: মাল্টিনোমিয়াল লজিস্টিক রিগ্রেশন ৮৯.৫৮%, মাল্টিনোমিয়াল নাইভ বেইজ ৮০.১৩%, KNN ১০০%, লিনিয়ার SVM ৯০.২৩%, এবং ডিসিশন ট্রি, র‍্যান্ডম ফরেস্ট ও MLP ১০০% নির্ভুলতা।',
    'ডিসিশন ট্রি, র‍্যান্ডম ফরেস্ট ও MLP ৩০৭টি রেকর্ডের টেস্ট সেটে precision, recall, F1-score ও ROC-AUC-তেও ১০০% পেয়েছে।',
    '৩১টি নতুন, অদেখা নমুনায়: ডিসিশন ট্রি ১০০%, র‍্যান্ডম ফরেস্ট ৯৬.৭৭% ও MLP ৯০.৩২%।',
    '১৯টি ইনপুটে গড়-ভিত্তিক সংবেদনশীলতা বিশ্লেষণ: রক্তচাপ (সিস্টোলিক ও ডায়াস্টোলিক), ভ্রূণের নড়াচড়া, ভ্রূণের হৃদস্পন্দন ও অ্যামনিওটিক তরল ঝুঁকিতে সবচেয়ে বেশি প্রভাব ফেলে; এরপর BMI, খালি পেটে গ্লুকোজ, HbA1c ও মাতৃ হৃদস্পন্দন।',
    'Python (scikit-learn) ও MATLAB উভয়েই একই ফলাফল পাওয়া গেছে।',
    '১০০% ফলাফল খোলাখুলি যাচাই করা হয়েছে: লেবেল ক্লিনিক্যাল সীমা-নিয়ম থেকে তৈরি, তাই মডেল সেই নিয়মগুলো পুনরুদ্ধার করে; স্বাধীন ক্লিনিক্যাল যাচাই এখনো প্রয়োজন।'
  ],
  contributions_en = ARRAY[
    'Prepared the hospital dataset: cleaning irregular records, imputing missing values, encoding categorical fields, feature selection and scaling.',
    'Implemented and tuned the seven classifiers (solvers for MLR, k for KNN, kernels for SVM, depth for the tree, 100-tree forest, MLP) under one shared protocol.',
    'Evaluated them with accuracy, precision, recall, F1-score, ROC-AUC and confusion matrices, and tested them on new samples.',
    'Carried out the mean-based sensitivity analysis that ranks the 19 inputs.',
    'Later re-checked the data, found records repeated across the train/test split, re-evaluated on the 100 unique patients with repeated cross-validation, and released the models with a live demo on Hugging Face.'
  ],
  contributions_bn = ARRAY[
    'হাসপাতালের ডেটাসেট প্রস্তুত করা: অনিয়মিত রেকর্ড পরিষ্কার, অনুপস্থিত মান পূরণ, ক্যাটাগরিক্যাল ফিল্ড এনকোডিং, ফিচার নির্বাচন ও স্কেলিং।',
    'একটি প্রটোকলে সাতটি ক্লাসিফায়ার তৈরি ও টিউন করা (MLR-এর সলভার, KNN-এর k, SVM-এর কার্নেল, ট্রির গভীরতা, ১০০-ট্রির ফরেস্ট, MLP)।',
    'accuracy, precision, recall, F1-score, ROC-AUC ও কনফিউশন ম্যাট্রিক্স দিয়ে মূল্যায়ন এবং নতুন নমুনায় পরীক্ষা।',
    '১৯টি ইনপুটকে র‍্যাঙ্ক করা গড়-ভিত্তিক সংবেদনশীলতা বিশ্লেষণ।',
    'পরে ডেটা পুনরায় যাচাই করে ট্রেন/টেস্ট বিভাজনে পুনরাবৃত্ত রেকর্ড খুঁজে পাওয়া, ১০০ জন অনন্য রোগীর ওপর বারবার ক্রস-ভ্যালিডেশনে পুনর্মূল্যায়ন, এবং Hugging Face-এ লাইভ ডেমোসহ মডেল প্রকাশ।'
  ],
  methods = ARRAY['Python', 'scikit-learn', 'MATLAB', 'Pandas', 'Multinomial Logistic Regression', 'Naïve Bayes', 'KNN', 'SVM', 'Decision Tree', 'Random Forest', 'MLP Neural Network', 'Sensitivity Analysis', 'Confusion Matrix', 'ROC-AUC'],
  keywords = ARRAY['Maternal Health', 'Fetal Health', 'Pregnancy', 'Risk Level Prediction', 'Machine Learning', 'Neural Network', 'Sensitivity Analysis', 'Antenatal Care', 'Clinical Decision Support', 'Bangladesh'],
  show_highlights = true, show_contributions = true, show_methods = true,
  show_case_study = true, show_challenges = true,
  updated_at = now()
WHERE user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60'
  AND title_en ILIKE 'Artificial Intelligence and Neural Network Based Maternal%';

------------------------------------------------------------------------------
-- 2. Case study: after your Problem and Data, the rest of the story
------------------------------------------------------------------------------
INSERT INTO pf_case_study_sections (user_id, publication_id, heading_en, heading_bn, body_en, body_bn, sort_order)
SELECT p.user_id, p.id, v.heading_en, v.heading_bn, v.body_en, v.body_bn, v.ord
FROM pf_publications p
JOIN (VALUES
  (3, 'Approach', 'পদ্ধতি',
   '<p>From <strong>930 records and 19 clinical attributes</strong> collected in Noakhali, each pregnancy is labelled <strong>low, mid or high risk</strong> using established clinical thresholds (34.4% / 30.1% / 35.5%: close to balanced). The data were split <strong>67% / 33%</strong> (623 training, 307 test records).</p><p>Seven models were compared under one protocol: Multinomial Logistic Regression, Multinomial Naïve Bayes, KNN, SVM, Decision Tree, Random Forest and an MLP neural network, each tuned (solvers, k, kernels, depth, 100 trees) and scored with accuracy, precision, recall, F1-score, ROC-AUC and confusion matrices. A <strong>mean-based sensitivity analysis</strong> then measured how much each input moves the predicted risk.</p>',
   '<p>নোয়াখালী থেকে সংগৃহীত <strong>৯৩০টি রেকর্ড ও ১৯টি ক্লিনিক্যাল বৈশিষ্ট্য</strong> থেকে প্রতিটি গর্ভাবস্থাকে প্রতিষ্ঠিত ক্লিনিক্যাল সীমা অনুযায়ী <strong>নিম্ন, মাঝারি বা উচ্চ ঝুঁকি</strong> হিসেবে লেবেল করা হয় (৩৪.৪% / ৩০.১% / ৩৫.৫%: প্রায় সুষম)। ডেটা <strong>৬৭% / ৩৩%</strong> ভাগ করা হয় (৬২৩টি ট্রেনিং, ৩০৭টি টেস্ট রেকর্ড)।</p><p>একটি প্রটোকলে সাতটি মডেল তুলনা করা হয়, প্রতিটি টিউন করে accuracy, precision, recall, F1-score, ROC-AUC ও কনফিউশন ম্যাট্রিক্সে মূল্যায়ন। এরপর <strong>গড়-ভিত্তিক সংবেদনশীলতা বিশ্লেষণে</strong> দেখা হয় কোন ইনপুট ঝুঁকিকে কতটা প্রভাবিত করে।</p>'),
  (4, 'Results', 'ফলাফল',
   '<p><strong>Decision Tree, Random Forest and MLP reached 100%</strong> accuracy, precision, recall, F1-score and ROC-AUC; KNN 100% accuracy but weaker per-class scores; linear SVM 90.23%, MLR 89.58% (ROC-AUC 98.09%), Naïve Bayes 80.13%. On <strong>31 new samples</strong> the Decision Tree stayed at 100%, Random Forest 96.77% and MLP 90.32%. The same results came out in Python and MATLAB.</p><p>The sensitivity analysis points to <strong>blood pressure, fetal movement, fetal heart rate and amniotic fluid</strong> as the strongest drivers of risk.</p>',
   '<p><strong>ডিসিশন ট্রি, র‍্যান্ডম ফরেস্ট ও MLP ১০০%</strong> accuracy, precision, recall, F1-score ও ROC-AUC পেয়েছে; KNN ১০০% accuracy তবে প্রতিটি শ্রেণিতে দুর্বল; লিনিয়ার SVM ৯০.২৩%, MLR ৮৯.৫৮% (ROC-AUC ৯৮.০৯%), নাইভ বেইজ ৮০.১৩%। <strong>৩১টি নতুন নমুনায়</strong> ডিসিশন ট্রি ১০০%, র‍্যান্ডম ফরেস্ট ৯৬.৭৭% ও MLP ৯০.৩২%। Python ও MATLAB-এ একই ফলাফল।</p><p>সংবেদনশীলতা বিশ্লেষণ অনুযায়ী <strong>রক্তচাপ, ভ্রূণের নড়াচড়া, ভ্রূণের হৃদস্পন্দন ও অ্যামনিওটিক তরল</strong> ঝুঁকির সবচেয়ে বড় চালক।</p>'),
  (5, 'What the 100% means', '১০০% ফলাফলের অর্থ',
   '<p>Because risk levels were assigned from clinical threshold rules, tree models can learn those very thresholds: the task is closer to <strong>recovering the rules</strong> than to predicting independently judged outcomes. The near-balanced classes rule out a model that scores well by always guessing the largest class.</p><p>Re-checking the data later showed many records repeated across the train/test split. Evaluated on the <strong>100 unique patients</strong> with 20× repeated 5-fold cross-validation, Random Forest scores <strong>75.6% accuracy (74.3% macro F1)</strong>: the honest figure for new patients, and the one used by the public model.</p>',
   '<p>ঝুঁকির মাত্রা ক্লিনিক্যাল সীমা-নিয়ম থেকে নির্ধারিত হওয়ায় ট্রি মডেল ঠিক সেই সীমাগুলোই শিখতে পারে: কাজটি স্বাধীনভাবে বিচার করা ফলাফল পূর্বাভাসের চেয়ে <strong>নিয়ম পুনরুদ্ধারের</strong> কাছাকাছি। প্রায় সুষম শ্রেণি থাকায় সবসময় বড় শ্রেণি অনুমান করে ভালো ফল পাওয়ার সম্ভাবনা বাদ পড়ে।</p><p>পরে ডেটা পুনরায় যাচাই করে দেখা যায় অনেক রেকর্ড ট্রেন/টেস্ট বিভাজনে পুনরাবৃত্ত। <strong>১০০ জন অনন্য রোগীর</strong> ওপর ২০ বার পুনরাবৃত্ত ৫-ফোল্ড ক্রস-ভ্যালিডেশনে র‍্যান্ডম ফরেস্ট <strong>৭৫.৬% accuracy (৭৪.৩% macro F1)</strong> পায়: নতুন রোগীর জন্য সৎ সংখ্যা, এবং প্রকাশিত মডেলে এটিই ব্যবহৃত।</p>'),
  (6, 'Clinical implications', 'ক্লিনিক্যাল তাৎপর্য',
   '<p>The ranking suggests a <strong>priority-based monitoring checklist</strong>: watch blood pressure, fetal movement counts, fetal heart rate and amniotic fluid more often, and follow up borderline BMI, fasting glucose, HbA1c and maternal heart rate. In resource-limited settings such as Noakhali, where testing all nineteen parameters often is not feasible, this can serve as a <strong>triage aid</strong> for gynecologists, not a replacement for clinical judgement.</p>',
   '<p>এই র‍্যাঙ্কিং একটি <strong>অগ্রাধিকার-ভিত্তিক পর্যবেক্ষণ চেকলিস্ট</strong> নির্দেশ করে: রক্তচাপ, ভ্রূণের নড়াচড়া, ভ্রূণের হৃদস্পন্দন ও অ্যামনিওটিক তরল ঘন ঘন দেখা, এবং সীমান্তবর্তী BMI, গ্লুকোজ, HbA1c ও মাতৃ হৃদস্পন্দনের ফলো-আপ। নোয়াখালীর মতো সীমিত সম্পদের এলাকায় এটি গাইনোকোলজিস্টদের জন্য <strong>ট্রায়াজ সহায়ক</strong> হতে পারে, ক্লিনিক্যাল বিচারের বিকল্প নয়।</p>'),
  (7, 'Limitations & next steps', 'সীমাবদ্ধতা ও পরবর্তী ধাপ',
   '<ul><li><p>Data from a single district (Noakhali) limits how far the results generalise.</p></li><li><p>Rule-based labels: models are judged on recovering the rules, not on clinician-adjudicated outcomes.</p></li><li><p>930 records (100 unique patients) is small, and there is no external validation set yet.</p></li><li><p>Next: prospective validation on new cohorts with clinician-assigned labels, k-fold cross-validation, and explainability (SHAP / LIME).</p></li></ul>',
   '<ul><li><p>একটি জেলার (নোয়াখালী) ডেটা হওয়ায় ফলাফলের সাধারণীকরণ সীমিত।</p></li><li><p>নিয়ম-ভিত্তিক লেবেল: মডেল নিয়ম পুনরুদ্ধারে মূল্যায়িত, চিকিৎসক-নির্ধারিত ফলাফলে নয়।</p></li><li><p>৯৩০টি রেকর্ড (১০০ জন অনন্য রোগী) ছোট, এবং এখনো বাহ্যিক যাচাই সেট নেই।</p></li><li><p>পরবর্তী: চিকিৎসক-নির্ধারিত লেবেলসহ নতুন রোগীদলে যাচাই, k-ফোল্ড ক্রস-ভ্যালিডেশন ও ব্যাখ্যাযোগ্যতা (SHAP / LIME)।</p></li></ul>')
) AS v(ord, heading_en, heading_bn, body_en, body_bn) ON true
WHERE p.user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60'
  AND p.title_en ILIKE 'Artificial Intelligence and Neural Network Based Maternal%'
  AND NOT EXISTS (
    SELECT 1 FROM pf_case_study_sections s WHERE s.publication_id = p.id AND s.heading_en = v.heading_en
  );

------------------------------------------------------------------------------
-- 3. Challenges & solutions: after your missing-values one
------------------------------------------------------------------------------
INSERT INTO pf_challenges (user_id, publication_id, challenge_en, challenge_bn, solution_en, solution_bn, result_en, result_bn, sort_order)
SELECT p.user_id, p.id, v.c_en, v.c_bn, v.s_en, v.s_bn, v.r_en, v.r_bn, v.ord
FROM pf_publications p
JOIN (VALUES
  (2,
   '<p>There was no ground-truth risk score: records had to be labelled before any model could learn.</p>',
   '<p>কোনো প্রকৃত ঝুঁকি স্কোর ছিল না: মডেল শেখার আগে রেকর্ডগুলো লেবেল করতে হয়েছে।</p>',
   '<p>Built a three-tier (low / mid / high) labelling framework from 19 parameters mapped to established clinical thresholds.</p>',
   '<p>প্রতিষ্ঠিত ক্লিনিক্যাল সীমার সাথে মেলানো ১৯টি প্যারামিটার থেকে তিন স্তরের (নিম্ন / মাঝারি / উচ্চ) লেবেলিং কাঠামো তৈরি।</p>',
   '<p>A transparent, clinically grounded label for every record, close to balanced across the three classes.</p>',
   '<p>প্রতিটি রেকর্ডের জন্য স্বচ্ছ, ক্লিনিক্যালি ভিত্তিক লেবেল, তিন শ্রেণিতে প্রায় সুষম।</p>'),
  (3,
   '<p>Single-model studies make algorithms hard to compare fairly.</p>',
   '<p>একক-মডেলের গবেষণায় অ্যালগরিদমগুলোর ন্যায্য তুলনা কঠিন।</p>',
   '<p>Ran all seven models on the same features, split and metrics, tuning each one (solvers, k, kernels, depth, trees) and keeping its best setting.</p>',
   '<p>সাতটি মডেলই একই ফিচার, বিভাজন ও মেট্রিকে চালানো, প্রতিটি টিউন করে (সলভার, k, কার্নেল, গভীরতা, ট্রি) সেরা সেটিং রাখা।</p>',
   '<p>A like-for-like benchmark: tree models and the MLP lead, linear SVM and MLR follow, Naïve Bayes trails.</p>',
   '<p>সমতুল্য তুলনা: ট্রি মডেল ও MLP এগিয়ে, এরপর লিনিয়ার SVM ও MLR, পিছিয়ে নাইভ বেইজ।</p>'),
  (4,
   '<p>Three models scored a perfect 100%, which needed explaining rather than celebrating.</p>',
   '<p>তিনটি মডেল নিখুঁত ১০০% পেয়েছে, যা উদযাপনের চেয়ে ব্যাখ্যার দাবি রাখে।</p>',
   '<p>Examined it openly in the paper (rule-derived labels, balanced classes, KNN memorisation), tested on 31 new samples, and confirmed the pipeline in a second tool (MATLAB).</p>',
   '<p>পেপারে খোলাখুলি যাচাই (নিয়ম-ভিত্তিক লেবেল, সুষম শ্রেণি, KNN মুখস্থকরণ), ৩১টি নতুন নমুনায় পরীক্ষা, এবং দ্বিতীয় টুলে (MATLAB) পাইপলাইন নিশ্চিত করা।</p>',
   '<p>Decision Tree 100%, Random Forest 96.77% and MLP 90.32% on new samples, with the caveats stated plainly.</p>',
   '<p>নতুন নমুনায় ডিসিশন ট্রি ১০০%, র‍্যান্ডম ফরেস্ট ৯৬.৭৭% ও MLP ৯০.৩২%, সীমাবদ্ধতা স্পষ্টভাবে উল্লেখসহ।</p>'),
  (5,
   '<p>Many of the 930 rows were copies of the same patients, so test records also appeared in training.</p>',
   '<p>৯৩০টি সারির অনেকগুলো একই রোগীর প্রতিলিপি, তাই টেস্ট রেকর্ড ট্রেনিংয়েও ছিল।</p>',
   '<p>Reduced the data to the 100 unique patients and re-evaluated with 20× repeated 5-fold cross-validation, with imputation fitted inside each training fold.</p>',
   '<p>ডেটাকে ১০০ জন অনন্য রোগীতে নামিয়ে ২০ বার পুনরাবৃত্ত ৫-ফোল্ড ক্রস-ভ্যালিডেশনে পুনর্মূল্যায়ন, প্রতিটি ট্রেনিং ফোল্ডের ভেতরে ইমপুটেশনসহ।</p>',
   '<p>An honest 75.6% accuracy (74.3% macro F1) for Random Forest, now the figure behind the public model.</p>',
   '<p>র‍্যান্ডম ফরেস্টের সৎ ৭৫.৬% accuracy (৭৪.৩% macro F1), যা এখন প্রকাশিত মডেলের ভিত্তি।</p>')
) AS v(ord, c_en, c_bn, s_en, s_bn, r_en, r_bn) ON true
WHERE p.user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60'
  AND p.title_en ILIKE 'Artificial Intelligence and Neural Network Based Maternal%'
  AND NOT EXISTS (
    SELECT 1 FROM pf_challenges c WHERE c.publication_id = p.id AND c.sort_order = v.ord
  );

------------------------------------------------------------------------------
-- 4. Its released model & dataset: description, results, tags
------------------------------------------------------------------------------
UPDATE pf_research_artifacts a SET
  description_en = 'Random forest and an explainable depth-3 decision tree that place a pregnancy record at low, mid or high risk from 19 clinical measurements, with the hospital dataset from Noakhali (private, on request). Re-evaluated on the 100 unique patients after finding records repeated across the train/test split.',
  description_bn = '১৯টি ক্লিনিক্যাল পরিমাপ থেকে গর্ভাবস্থার রেকর্ডকে নিম্ন, মাঝারি বা উচ্চ ঝুঁকিতে শ্রেণিবদ্ধ করা র‍্যান্ডম ফরেস্ট ও ব্যাখ্যাযোগ্য ৩-গভীরতার ডিসিশন ট্রি, নোয়াখালীর হাসপাতালের ডেটাসেটসহ (প্রাইভেট, অনুরোধে)। ট্রেন/টেস্ট বিভাজনে পুনরাবৃত্ত রেকর্ড পাওয়ার পর ১০০ জন অনন্য রোগীর ওপর পুনর্মূল্যায়িত।',
  metrics = ARRAY['75.6% accuracy (20× repeated 5-fold CV)', '74.3% macro F1', '19 clinical features', '3 risk levels'],
  tags = ARRAY['Scikit-learn', 'Random Forest', 'Decision Tree', 'Healthcare', 'Tabular', 'Bangladesh'],
  publication_id = p.id,
  updated_at = now()
FROM pf_publications p
WHERE a.user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60'
  AND a.model_url = 'https://huggingface.co/abir71/maternal-fetal-risk-models'
  AND p.user_id = a.user_id
  AND p.title_en ILIKE 'Artificial Intelligence and Neural Network Based Maternal%';

COMMIT;

-- Check:
-- SELECT heading_en, sort_order FROM pf_case_study_sections s JOIN pf_publications p ON p.id = s.publication_id
--   WHERE p.title_en ILIKE 'Artificial Intelligence and Neural Network Based Maternal%' ORDER BY sort_order;
