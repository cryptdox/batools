-- "More about me" and research interests for the Researcher version.
-- Run in the Supabase SQL editor (needs migrations up to 067). Safe to re-run.
--
--   * Today's audiences ("In General", "As Client") become Developer-only, so
--     the Developer version is unchanged.
--   * The Researcher version gets its own tabs: Short Bio, Research Journey,
--     For Collaborators, each with its sections (English and Bangla).
--   * Research interests: your four anchors made specific, from today's
--     foundation toward computational intelligence, learning-based control,
--     multi-agent and cyber-physical systems, and robotics.
-- Your statement is left as you wrote it.

BEGIN;

CREATE TEMP TABLE me ON COMMIT DROP AS
SELECT '88b3efb5-8c58-486e-a3f7-751cc4b23e60'::uuid AS user_id,
  (SELECT id FROM pf_versions WHERE user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60' AND slug = 'researcher') AS researcher,
  (SELECT id FROM pf_versions WHERE user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60' AND slug = 'developer') AS developer;

------------------------------------------------------------------------------
-- 1. Developer keeps its tabs
------------------------------------------------------------------------------
UPDATE pf_about_audiences a SET versions = ARRAY[me.developer], updated_at = now()
FROM me
WHERE a.user_id = me.user_id AND a.versions = '{}' AND a.name_en IN ('In General', 'As Client');

------------------------------------------------------------------------------
-- 2. Researcher tabs
------------------------------------------------------------------------------
INSERT INTO pf_about_audiences (user_id, name_en, name_bn, versions, sort_order)
SELECT me.user_id, v.name_en, v.name_bn, ARRAY[me.researcher], v.ord
FROM me, (VALUES
  ('Short Bio', 'সংক্ষিপ্ত পরিচিতি', 11),
  ('Research Journey', 'গবেষণার যাত্রা', 12),
  ('For Collaborators', 'সহযোগীদের জন্য', 13)
) AS v(name_en, name_bn, ord)
WHERE NOT EXISTS (SELECT 1 FROM pf_about_audiences a WHERE a.user_id = me.user_id AND a.name_en = v.name_en);

------------------------------------------------------------------------------
-- 3. Their sections and content
------------------------------------------------------------------------------
CREATE TEMP TABLE about_content (
  audience TEXT, ord INT, heading_en TEXT, heading_bn TEXT,
  block INT, kind TEXT, text_en TEXT, text_bn TEXT, items_en TEXT[], items_bn TEXT[]
) ON COMMIT DROP;

INSERT INTO about_content VALUES
-- Short Bio ------------------------------------------------------------------
('Short Bio', 1, 'Short bio', 'সংক্ষিপ্ত পরিচিতি', 1, 'paragraph',
 $t$<p>Abir Hosen is an AI/ML research engineer from Bangladesh. Abir received the B.Sc. (2019) and M.Sc. (2023) degrees in Information and Communication Engineering from Noakhali Science and Technology University (NSTU), and since 2023 has worked as a Research Assistant in the Department of Information and Communication Engineering at NSTU under Dr. Md. Ashikur Rahman Khan.</p>$t$,
 $t$<p>আবির হোসেন বাংলাদেশের একজন এআই/এমএল রিসার্চ ইঞ্জিনিয়ার। নোয়াখালী বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয় (নোবিপ্রবি) থেকে তথ্য ও যোগাযোগ প্রকৌশলে বি.এসসি. (২০১৯) ও এম.এসসি. (২০২৩) ডিগ্রি অর্জন করেছেন, এবং ২০২৩ সাল থেকে নোবিপ্রবির তথ্য ও যোগাযোগ প্রকৌশল বিভাগে ড. মো. আশিকুর রহমান খানের তত্ত্বাবধানে রিসার্চ অ্যাসিস্ট্যান্ট হিসেবে কাজ করছেন।</p>$t$, '{}', '{}'),
('Short Bio', 1, 'Short bio', 'সংক্ষিপ্ত পরিচিতি', 2, 'paragraph',
 $t$<p>The research spans machine learning for maternal and fetal health risk prediction, leakage-controlled monthly weather forecasting across Bangladesh, and low-resource Bengali NLP (fake news and cyberbullying detection), with a focus on honest evaluation and calibrated uncertainty. It has produced two peer-reviewed journal articles (<em>Cloud Computing and Data Science</em> and <em>International Journal of Advanced Computer Research</em>, 2026), two manuscripts under review, and five open models with live demos on Hugging Face and datasets on Kaggle.</p>$t$,
 $t$<p>গবেষণার পরিসর: মাতৃ ও ভ্রূণের স্বাস্থ্যঝুঁকি পূর্বাভাসে মেশিন লার্নিং, বাংলাদেশজুড়ে লিকেজ-নিয়ন্ত্রিত মাসিক আবহাওয়া পূর্বাভাস, এবং স্বল্প-সম্পদের বাংলা এনএলপি (ভুয়া খবর ও সাইবার বুলিং শনাক্তকরণ), সৎ মূল্যায়ন ও নির্ভরযোগ্য অনিশ্চয়তা পরিমাপের ওপর জোর দিয়ে। এর ফলে দুটি পিয়ার-রিভিউড জার্নাল প্রবন্ধ (<em>Cloud Computing and Data Science</em> ও <em>International Journal of Advanced Computer Research</em>, ২০২৬), পর্যালোচনাধীন দুটি পাণ্ডুলিপি, এবং Hugging Face-এ লাইভ ডেমোসহ পাঁচটি উন্মুক্ত মডেল ও Kaggle-এ ডেটাসেট প্রকাশিত হয়েছে।</p>$t$, '{}', '{}'),
('Short Bio', 1, 'Short bio', 'সংক্ষিপ্ত পরিচিতি', 3, 'paragraph',
 $t$<p>Alongside research, Abir has about six years of industry experience in software engineering, currently as a Senior Software Engineer at Grameen Health Tech, building backend infrastructure, event-driven distributed systems, and LLM-powered applications with retrieval-augmented generation and agentic tooling (MCP). The long-term goal is to contribute to <strong>adaptive, intelligent and autonomous systems</strong>: computational intelligence, learning-based control, and networked multi-agent and robotic systems.</p>$t$,
 $t$<p>গবেষণার পাশাপাশি আবিরের সফটওয়্যার প্রকৌশলে প্রায় ছয় বছরের ইন্ডাস্ট্রি অভিজ্ঞতা রয়েছে; বর্তমানে গ্রামীণ হেলথ টেকে সিনিয়র সফটওয়্যার ইঞ্জিনিয়ার হিসেবে ব্যাকএন্ড অবকাঠামো, ইভেন্ট-ড্রিভেন ডিস্ট্রিবিউটেড সিস্টেম এবং RAG ও এজেন্টিক টুলিং (MCP) ভিত্তিক এলএলএম অ্যাপ্লিকেশন তৈরি করছেন। দীর্ঘমেয়াদি লক্ষ্য <strong>অভিযোজনশীল, বুদ্ধিমান ও স্বায়ত্তশাসিত সিস্টেমে</strong> অবদান রাখা: কম্পিউটেশনাল ইন্টেলিজেন্স, লার্নিং-ভিত্তিক নিয়ন্ত্রণ, এবং নেটওয়ার্কভিত্তিক বহু-এজেন্ট ও রোবোটিক সিস্টেম।</p>$t$, '{}', '{}'),
-- Research Journey -----------------------------------------------------------
('Research Journey', 1, 'Where it started', 'যেখান থেকে শুরু', 1, 'paragraph',
 $t$<p>My research began with applied machine learning on real, messy data: predicting pregnancy risk from hospital records, forecasting rainfall, temperature and humidity from 42 years of station data, and detecting fake news and cyberbullying in Bengali, a language with few resources. Twice I found that impressive numbers came from leakage, repeated patient records in one study and future information in another, and I rebuilt the evaluation until the results were honest. That experience shapes how I work: <strong>leakage-free validation, honest baselines and calibrated uncertainty</strong> (conformal prediction) before any claim.</p>$t$,
 $t$<p>আমার গবেষণা শুরু হয়েছিল বাস্তব, অগোছালো ডেটায় প্রয়োগমূলক মেশিন লার্নিং দিয়ে: হাসপাতালের রেকর্ড থেকে গর্ভাবস্থার ঝুঁকি পূর্বাভাস, ৪২ বছরের স্টেশন ডেটা থেকে বৃষ্টিপাত, তাপমাত্রা ও আর্দ্রতার পূর্বাভাস, এবং স্বল্প-সম্পদের ভাষা বাংলায় ভুয়া খবর ও সাইবার বুলিং শনাক্তকরণ। দুবার দেখেছি চমকপ্রদ ফলাফল এসেছে লিকেজ থেকে — একটি গবেষণায় রোগীর পুনরাবৃত্ত রেকর্ড, আরেকটিতে ভবিষ্যতের তথ্য — এবং ফলাফল সৎ না হওয়া পর্যন্ত মূল্যায়ন নতুন করে তৈরি করেছি। সেই অভিজ্ঞতাই আমার কাজের ধরন ঠিক করেছে: যেকোনো দাবির আগে <strong>লিকেজ-মুক্ত যাচাই, সৎ বেসলাইন ও নির্ভরযোগ্য অনিশ্চয়তা</strong> (কনফরমাল প্রেডিকশন)।</p>$t$, '{}', '{}'),
('Research Journey', 2, 'Where it is heading', 'যেদিকে এগোচ্ছে', 1, 'paragraph',
 $t$<p>Prediction is only half of intelligence; the other half is acting well on what is predicted. I want to move from models that forecast a system to systems that <strong>learn, adapt and decide</strong> in a changing world: computational intelligence and adaptive learning, reinforcement learning and adaptive dynamic programming for learning-based control, intelligent and adaptive control of autonomous systems, networked and multi-agent systems, cyber-physical systems with RF and signal sensing, and, ultimately, robotics.</p>$t$,
 $t$<p>পূর্বাভাস বুদ্ধিমত্তার অর্ধেক মাত্র; বাকি অর্ধেক হলো পূর্বাভাসের ভিত্তিতে ঠিকভাবে কাজ করা। আমি এমন মডেল থেকে এগোতে চাই যা কোনো সিস্টেমের পূর্বাভাস দেয়, এমন সিস্টেমের দিকে যা পরিবর্তনশীল পরিবেশে <strong>শেখে, মানিয়ে নেয় ও সিদ্ধান্ত নেয়</strong>: কম্পিউটেশনাল ইন্টেলিজেন্স ও অভিযোজনশীল শিক্ষা, লার্নিং-ভিত্তিক নিয়ন্ত্রণের জন্য রিইনফোর্সমেন্ট লার্নিং ও অ্যাডাপ্টিভ ডায়নামিক প্রোগ্রামিং, স্বায়ত্তশাসিত সিস্টেমের বুদ্ধিমান ও অভিযোজনশীল নিয়ন্ত্রণ, নেটওয়ার্কভিত্তিক ও বহু-এজেন্ট সিস্টেম, RF ও সংকেত সেন্সিংসহ সাইবার-ফিজিক্যাল সিস্টেম, এবং শেষ পর্যন্ত রোবোটিক্স।</p>$t$, '{}', '{}'),
('Research Journey', 3, 'How the pieces connect', 'কীভাবে সব যুক্ত', 1, 'list', NULL, NULL,
 ARRAY[
   '<strong>Forecasting → system models.</strong> Learning one-step-ahead dynamics from noisy time series is the predictive core of model-based and adaptive control.',
   '<strong>Calibrated uncertainty → safe decisions.</strong> Conformal intervals and leakage-free evaluation carry over to deciding and acting safely under uncertainty.',
   '<strong>Agentic LLM tools → multi-agent intelligence.</strong> Building agents that plan, call tools and coordinate is a practical step toward cooperative multi-agent systems.',
   '<strong>Distributed systems engineering → networked and cyber-physical systems.</strong> Six years of event-driven, fault-tolerant backend work maps onto communication, delay and reliability in networked control.',
   '<strong>Efficient deployment → embedded intelligence.</strong> Shrinking models to run in a browser (ONNX, 8- and 16-bit) is the same skill robots and edge devices need.'
 ],
 ARRAY[
   '<strong>পূর্বাভাস → সিস্টেম মডেল।</strong> কোলাহলপূর্ণ টাইম সিরিজ থেকে এক ধাপ সামনের গতিবিদ্যা শেখা মডেল-ভিত্তিক ও অভিযোজনশীল নিয়ন্ত্রণের পূর্বাভাসমূলক কেন্দ্র।',
   '<strong>নির্ভরযোগ্য অনিশ্চয়তা → নিরাপদ সিদ্ধান্ত।</strong> কনফরমাল ইন্টারভাল ও লিকেজ-মুক্ত মূল্যায়ন অনিশ্চয়তার মধ্যে নিরাপদে সিদ্ধান্ত নেওয়া ও কাজ করায় কাজে লাগে।',
   '<strong>এজেন্টিক এলএলএম টুল → বহু-এজেন্ট বুদ্ধিমত্তা।</strong> পরিকল্পনা করে, টুল ব্যবহার করে ও সমন্বয় করে এমন এজেন্ট তৈরি সহযোগিতামূলক বহু-এজেন্ট সিস্টেমের দিকে বাস্তব পদক্ষেপ।',
   '<strong>ডিস্ট্রিবিউটেড সিস্টেম প্রকৌশল → নেটওয়ার্কভিত্তিক ও সাইবার-ফিজিক্যাল সিস্টেম।</strong> ছয় বছরের ইভেন্ট-ড্রিভেন, ফল্ট-টলারেন্ট ব্যাকএন্ড কাজ নেটওয়ার্কভিত্তিক নিয়ন্ত্রণের যোগাযোগ, বিলম্ব ও নির্ভরযোগ্যতার সাথে মেলে।',
   '<strong>দক্ষ ডিপ্লয়মেন্ট → এমবেডেড বুদ্ধিমত্তা।</strong> মডেল ছোট করে ব্রাউজারে চালানো (ONNX, ৮ ও ১৬-বিট) রোবট ও এজ ডিভাইসের জন্য প্রয়োজনীয় একই দক্ষতা।'
 ]),
-- For Collaborators ----------------------------------------------------------
('For Collaborators', 1, 'What I bring', 'আমি যা দিতে পারি', 1, 'list', NULL, NULL,
 ARRAY[
   '<strong>Research:</strong> two peer-reviewed journal articles and two manuscripts under review; experiment design, implementation, analysis, writing and responses to reviewers.',
   '<strong>Rigour:</strong> leakage-free validation, rolling-origin and repeated cross-validation, statistical tests, interpretability (SHAP, LIME) and conformal uncertainty.',
   '<strong>Open science:</strong> five models with live demos on Hugging Face, datasets on Kaggle and reproducible code on GitHub.',
   '<strong>Engineering:</strong> about six years of production software: Python, TypeScript, distributed and event-driven systems, databases, cloud and deployment.',
   '<strong>Modern AI:</strong> deep learning (PyTorch, Transformers), LLM systems with RAG and agentic tooling (MCP), and efficient inference (ONNX).'
 ],
 ARRAY[
   '<strong>গবেষণা:</strong> দুটি পিয়ার-রিভিউড জার্নাল প্রবন্ধ ও পর্যালোচনাধীন দুটি পাণ্ডুলিপি; পরীক্ষার নকশা, বাস্তবায়ন, বিশ্লেষণ, লেখা ও রিভিউয়ারদের জবাব।',
   '<strong>নিখুঁততা:</strong> লিকেজ-মুক্ত যাচাই, রোলিং-অরিজিন ও পুনরাবৃত্ত ক্রস-ভ্যালিডেশন, পরিসংখ্যানিক পরীক্ষা, ব্যাখ্যাযোগ্যতা (SHAP, LIME) ও কনফরমাল অনিশ্চয়তা।',
   '<strong>উন্মুক্ত বিজ্ঞান:</strong> Hugging Face-এ লাইভ ডেমোসহ পাঁচটি মডেল, Kaggle-এ ডেটাসেট ও GitHub-এ পুনরুৎপাদনযোগ্য কোড।',
   '<strong>প্রকৌশল:</strong> প্রায় ছয় বছরের প্রোডাকশন সফটওয়্যার: Python, TypeScript, ডিস্ট্রিবিউটেড ও ইভেন্ট-ড্রিভেন সিস্টেম, ডেটাবেস, ক্লাউড ও ডিপ্লয়মেন্ট।',
   '<strong>আধুনিক এআই:</strong> ডিপ লার্নিং (PyTorch, Transformers), RAG ও এজেন্টিক টুলিং (MCP) ভিত্তিক এলএলএম সিস্টেম, এবং দক্ষ ইনফারেন্স (ONNX)।'
 ]),
('For Collaborators', 2, 'What I am looking for', 'আমি যা খুঁজছি', 1, 'paragraph',
 $t$<p>I am looking for <strong>graduate research opportunities (Ph.D.)</strong> and collaborations in computational intelligence, reinforcement learning and adaptive control, intelligent and autonomous systems, networked and multi-agent systems, cyber-physical systems and robotics. I bring the evaluation discipline of my applied research and the systems skills of industry, and I am eager to grow into control-oriented, theory-backed work. If our interests meet, I would be glad to hear from you through the contact form.</p>$t$,
 $t$<p>আমি কম্পিউটেশনাল ইন্টেলিজেন্স, রিইনফোর্সমেন্ট লার্নিং ও অভিযোজনশীল নিয়ন্ত্রণ, বুদ্ধিমান ও স্বায়ত্তশাসিত সিস্টেম, নেটওয়ার্কভিত্তিক ও বহু-এজেন্ট সিস্টেম, সাইবার-ফিজিক্যাল সিস্টেম ও রোবোটিক্সে <strong>স্নাতকোত্তর গবেষণার সুযোগ (পিএইচ.ডি.)</strong> ও সহযোগিতা খুঁজছি। আমার প্রয়োগমূলক গবেষণার মূল্যায়ন-শৃঙ্খলা ও ইন্ডাস্ট্রির সিস্টেম-দক্ষতা নিয়ে আসছি, এবং নিয়ন্ত্রণ-কেন্দ্রিক, তত্ত্বভিত্তিক কাজে বেড়ে উঠতে আগ্রহী। আমাদের আগ্রহ মিলে গেলে যোগাযোগ ফর্মের মাধ্যমে আপনার বার্তা পেলে খুশি হব।</p>$t$, '{}', '{}');

INSERT INTO pf_about_sections (user_id, audience_id, heading_en, heading_bn, versions, sort_order)
SELECT DISTINCT me.user_id, a.id, c.heading_en, c.heading_bn, ARRAY[me.researcher], a.sort_order * 10 + c.ord
FROM me
JOIN about_content c ON true
JOIN pf_about_audiences a ON a.user_id = me.user_id AND a.name_en = c.audience
WHERE NOT EXISTS (
  SELECT 1 FROM pf_about_sections s WHERE s.user_id = me.user_id AND s.audience_id = a.id AND s.heading_en = c.heading_en
);

INSERT INTO pf_about_blocks (user_id, section_id, kind, text_en, text_bn, items_en, items_bn, sort_order)
SELECT me.user_id, s.id, c.kind, c.text_en, c.text_bn, c.items_en, c.items_bn, c.block
FROM me
JOIN about_content c ON true
JOIN pf_about_audiences a ON a.user_id = me.user_id AND a.name_en = c.audience
JOIN pf_about_sections s ON s.audience_id = a.id AND s.heading_en = c.heading_en
WHERE NOT EXISTS (
  SELECT 1 FROM pf_about_blocks b WHERE b.section_id = s.id AND b.sort_order = c.block
);

------------------------------------------------------------------------------
-- 4. Research interests (Researcher version)
------------------------------------------------------------------------------
UPDATE pf_versions SET
  interests_en = ARRAY[
    'Computational Intelligence & Adaptive Learning',
    'Reinforcement Learning & Adaptive Dynamic Programming',
    'Intelligent & Adaptive Control, Autonomous Systems',
    'Networked & Multi-Agent Systems',
    'Cyber-Physical Systems & RF / Signal Intelligence',
    'Robotics',
    'Trustworthy ML: Uncertainty & Leakage-Free Evaluation'
  ],
  interests_bn = ARRAY[
    'কম্পিউটেশনাল ইন্টেলিজেন্স ও অভিযোজনশীল শিক্ষা',
    'রিইনফোর্সমেন্ট লার্নিং ও অ্যাডাপ্টিভ ডায়নামিক প্রোগ্রামিং',
    'বুদ্ধিমান ও অভিযোজনশীল নিয়ন্ত্রণ, স্বায়ত্তশাসিত সিস্টেম',
    'নেটওয়ার্কভিত্তিক ও বহু-এজেন্ট সিস্টেম',
    'সাইবার-ফিজিক্যাল সিস্টেম ও RF / সংকেত বুদ্ধিমত্তা',
    'রোবোটিক্স',
    'নির্ভরযোগ্য এমএল: অনিশ্চয়তা ও লিকেজ-মুক্ত মূল্যায়ন'
  ],
  updated_at = now()
WHERE user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60' AND slug = 'researcher';

COMMIT;
