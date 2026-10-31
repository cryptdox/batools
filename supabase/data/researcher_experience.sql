-- Experience for the Researcher version: the Research Assistant role first, in
-- full, and the industry roles worded for a research reader (the skills that
-- carry over: AI / LLM systems, event-driven and fault-tolerant distributed
-- systems, data pipelines). English and Bangla.
-- Run in the Supabase SQL editor. Safe to re-run.
--
-- Only the Researcher copies are touched, and only while nobody has edited
-- them (updated_at = created_at); the Developer rows stay exactly as they are.
-- Facts are from the CV and the portfolio; nothing new is claimed.

BEGIN;

UPDATE pf_experiences e SET
  position_en = v.position_en, position_bn = v.position_bn,
  company_en = v.company_en, company_bn = v.company_bn,
  location_en = v.location_en, location_bn = v.location_bn,
  duration_en = v.duration_en, duration_bn = v.duration_bn,
  responsibilities_en = v.r_en, responsibilities_bn = v.r_bn,
  show_on_home = v.on_home, sort_order = v.ord,
  updated_at = e.created_at          -- still counts as untouched, so a re-run refreshes it
FROM (VALUES
  ('Noakhali Science', 0, true,
   'Research Assistant', 'রিসার্চ অ্যাসিস্ট্যান্ট',
   'Dept. of Information & Communication Engineering, Noakhali Science & Technology University · Supervisor: Dr. Md. Ashikur Rahman Khan',
   'তথ্য ও যোগাযোগ প্রকৌশল বিভাগ, নোয়াখালী বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয় · তত্ত্বাবধায়ক: ড. মো. আশিকুর রহমান খান',
   'Noakhali, Bangladesh', 'নোয়াখালী, বাংলাদেশ',
   'Apr 2023 – Present', 'এপ্রিল ২০২৩ – বর্তমান',
   ARRAY[
     'Machine learning and deep learning research on clinical risk prediction, climate forecasting and low-resource Bengali NLP.',
     'Maternal & fetal health: prepared hospital records from Noakhali, compared seven classifiers and ran a sensitivity analysis of 19 clinical inputs; later found repeated patient records and re-evaluated on unique patients with repeated cross-validation.',
     'Bengali fake news: benchmarked classical TF-IDF models against a fine-tuned Bangla BERT (94.49% accuracy, 90.28% recall, 98.36% ROC-AUC), with LIME explanations.',
     'Weather forecasting: leakage-controlled monthly forecasts of rainfall, temperature and humidity for 24 BMD stations (1981–2022), with rolling-origin validation, ML and deep-learning models compared against SARIMA and climatology, and conformal prediction intervals.',
     'Bengali cyberbullying: co-built a 3,150-comment YouTube / Facebook dataset with three annotators and a two-stage, sentiment-aware classifier for native and Romanized Bangla.',
     'Systematic review of neural networks: PRISMA 2020 search of OpenAlex and a bibliometric analysis of over a million records.',
     'Outcomes: two peer-reviewed journal articles and two manuscripts under review; five models released with live demos on Hugging Face, datasets on Kaggle and code on GitHub.'
   ],
   ARRAY[
     'ক্লিনিক্যাল ঝুঁকি পূর্বাভাস, জলবায়ু পূর্বাভাস ও স্বল্প-সম্পদের বাংলা এনএলপিতে মেশিন লার্নিং ও ডিপ লার্নিং গবেষণা।',
     'মাতৃ ও ভ্রূণের স্বাস্থ্য: নোয়াখালীর হাসপাতালের রেকর্ড প্রস্তুত, সাতটি ক্লাসিফায়ারের তুলনা ও ১৯টি ক্লিনিক্যাল ইনপুটের সংবেদনশীলতা বিশ্লেষণ; পরে রোগীর পুনরাবৃত্ত রেকর্ড খুঁজে পেয়ে অনন্য রোগীদের ওপর পুনরাবৃত্ত ক্রস-ভ্যালিডেশনে পুনর্মূল্যায়ন।',
     'বাংলা ভুয়া খবর: ক্লাসিক্যাল TF-IDF মডেলের সাথে ফাইন-টিউন করা বাংলা BERT-এর তুলনা (৯৪.৪৯% accuracy, ৯০.২৮% recall, ৯৮.৩৬% ROC-AUC), LIME ব্যাখ্যাসহ।',
     'আবহাওয়া পূর্বাভাস: ২৪টি BMD স্টেশনে (১৯৮১–২০২২) বৃষ্টিপাত, তাপমাত্রা ও আর্দ্রতার লিকেজ-নিয়ন্ত্রিত মাসিক পূর্বাভাস — রোলিং-অরিজিন যাচাই, SARIMA ও জলবায়ুগত গড়ের বিপরীতে মেশিন লার্নিং ও ডিপ লার্নিং মডেল, এবং কনফরমাল প্রেডিকশন ইন্টারভাল।',
     'বাংলা সাইবার বুলিং: তিনজন চিহ্নিতকারীসহ ৩,১৫০টি YouTube / Facebook মন্তব্যের ডেটাসেট ও বাংলা ও রোমান হরফের জন্য দুই ধাপের, অনুভূতি-সচেতন ক্লাসিফায়ার সহ-নির্মাণ।',
     'নিউরাল নেটওয়ার্কের পদ্ধতিগত পর্যালোচনা: OpenAlex-এ PRISMA 2020 অনুসন্ধান ও দশ লাখেরও বেশি রেকর্ডের বিবলিওমেট্রিক বিশ্লেষণ।',
     'ফলাফল: দুটি পিয়ার-রিভিউড জার্নাল প্রবন্ধ ও পর্যালোচনাধীন দুটি পাণ্ডুলিপি; Hugging Face-এ লাইভ ডেমোসহ পাঁচটি মডেল, Kaggle-এ ডেটাসেট ও GitHub-এ কোড প্রকাশ।'
   ]),
  ('Grameen Health Tech', 1, true,
   'Senior Software Engineer', 'সিনিয়র সফটওয়্যার ইঞ্জিনিয়ার',
   'Grameen Health Tech', 'গ্রামীণ হেলথ টেক',
   'Dhaka, Bangladesh', 'ঢাকা, বাংলাদেশ',
   'Jun 2026 – Present', 'জুন ২০২৬ – বর্তমান',
   ARRAY[
     'Build the AI patient-assistant chat that supports patients through their whole care journey on Shukhee, Bangladesh''s all-in-one healthcare platform.',
     'Design core healthcare APIs, payment integrations, Health Store e-commerce and bulk-processing services.',
     'Run asynchronous, fault-tolerant background workflows (scheduled jobs, retries) with BullMQ and Redis.',
     'Own database design and system architecture, and drive technical decisions and code quality.'
   ],
   ARRAY[
     'বাংলাদেশের সর্বাঙ্গীণ স্বাস্থ্যসেবা প্ল্যাটফর্ম সুখীতে রোগীদের পুরো চিকিৎসা-যাত্রায় সহায়তাকারী এআই পেশেন্ট-অ্যাসিস্ট্যান্ট চ্যাট তৈরি।',
     'মূল স্বাস্থ্যসেবা API, পেমেন্ট ইন্টিগ্রেশন, হেলথ স্টোর ই-কমার্স ও বাল্ক-প্রসেসিং সার্ভিসের নকশা।',
     'BullMQ ও Redis দিয়ে অ্যাসিঙ্ক্রোনাস, ফল্ট-টলারেন্ট ব্যাকগ্রাউন্ড ওয়ার্কফ্লো (নির্ধারিত কাজ, পুনঃচেষ্টা) পরিচালনা।',
     'ডেটাবেস নকশা ও সিস্টেম আর্কিটেকচারের দায়িত্ব, এবং প্রযুক্তিগত সিদ্ধান্ত ও কোডের মান নিশ্চিত করা।'
   ]),
  ('Sofof Tech', 2, true,
   'Senior Software Engineer', 'সিনিয়র সফটওয়্যার ইঞ্জিনিয়ার',
   'Sofof Tech', 'সফফ টেক',
   'Dhaka, Bangladesh', 'ঢাকা, বাংলাদেশ',
   'Dec 2025 – Jun 2026', 'ডিসেম্বর ২০২৫ – জুন ২০২৬',
   ARRAY[
     'Led 10+ event-driven microservices (NestJS monorepo) connecting core systems with an LLM service that writes business-tailored WhatsApp messages for Arabic businesses (Radd).',
     'Built RabbitMQ pipelines delivering million-scale messages, with retry handling and failure tracking against Meta API errors.',
     'Owned the end-to-end lifecycle (architecture, development, deployment, maintenance) and mentored engineers on code quality.'
   ],
   ARRAY[
     'আরব ব্যবসার জন্য ব্যবসা-উপযোগী WhatsApp বার্তা লেখা এলএলএম সার্ভিসের সাথে মূল সিস্টেম যুক্ত ১০টিরও বেশি ইভেন্ট-ড্রিভেন মাইক্রোসার্ভিসের (NestJS মনোরেপো) নেতৃত্ব (Radd)।',
     'লাখো বার্তা পৌঁছানো RabbitMQ পাইপলাইন তৈরি, Meta API ত্রুটির বিপরীতে পুনঃচেষ্টা ও ব্যর্থতা ট্র্যাকিংসহ।',
     'শুরু থেকে শেষ পর্যন্ত (আর্কিটেকচার, ডেভেলপমেন্ট, ডিপ্লয়মেন্ট, রক্ষণাবেক্ষণ) দায়িত্ব এবং কোডের মান নিয়ে প্রকৌশলীদের পরামর্শদান।'
   ]),
  ('Embedded Logic', 3, true,
   'Software Engineer', 'সফটওয়্যার ইঞ্জিনিয়ার',
   'Embedded Logic Operations (ELO)', 'এমবেডেড লজিক অপারেশনস (ELO)',
   'Dhaka, Bangladesh', 'ঢাকা, বাংলাদেশ',
   'Mar 2023 – Aug 2025', 'মার্চ ২০২৩ – আগস্ট ২০২৫',
   ARRAY[
     'Owned three full-cycle products with AI modules (AI job matching for overseas recruitment, AI music generation for producers): database design, architecture, integration and deployment.',
     'Led two technology-stack migrations, managed 10+ repositories and their access, and built scalable applications from scratch.',
     'Mentored newcomers and gave technical presentations across teams.'
   ],
   ARRAY[
     'এআই মডিউলসহ তিনটি পূর্ণাঙ্গ প্রোডাক্টের দায়িত্ব (বিদেশে নিয়োগের জন্য এআই জব ম্যাচিং, প্রযোজকদের জন্য এআই মিউজিক জেনারেশন): ডেটাবেস নকশা, আর্কিটেকচার, ইন্টিগ্রেশন ও ডিপ্লয়মেন্ট।',
     'দুটি টেকনোলজি-স্ট্যাক মাইগ্রেশনের নেতৃত্ব, ১০টিরও বেশি রিপোজিটরি ও তাদের অ্যাক্সেস ব্যবস্থাপনা, এবং শুরু থেকে স্কেলযোগ্য অ্যাপ্লিকেশন তৈরি।',
     'নতুনদের পরামর্শদান ও বিভিন্ন দলে প্রযুক্তিগত উপস্থাপনা।'
   ]),
  ('ADN', 4, false,
   'Software Engineer', 'সফটওয়্যার ইঞ্জিনিয়ার',
   'ADN DigiNet', 'এডিএন ডিজিনেট',
   'Dhaka, Bangladesh', 'ঢাকা, বাংলাদেশ',
   'Feb 2021 – Mar 2023', 'ফেব্রুয়ারি ২০২১ – মার্চ ২০২৩',
   ARRAY[
     'Supported a marketing-automation platform (Roboket) whose AI-driven decisions chose marketing targets from client activity, integrating Mautic and Facebook APIs.',
     'Owned 5+ ReactJS micro-frontend projects and supported backend development across 3+ teams.',
     'Gathered requirements and contributed to three in-house and two client projects.'
   ],
   ARRAY[
     'গ্রাহকের কার্যকলাপ থেকে এআই-চালিত সিদ্ধান্তে মার্কেটিং লক্ষ্য বেছে নেওয়া মার্কেটিং-অটোমেশন প্ল্যাটফর্মে (Roboket) সহায়তা, Mautic ও Facebook API ইন্টিগ্রেশনসহ।',
     '৫টিরও বেশি ReactJS মাইক্রো-ফ্রন্টএন্ড প্রকল্পের দায়িত্ব এবং ৩টিরও বেশি দলে ব্যাকএন্ড ডেভেলপমেন্টে সহায়তা।',
     'প্রয়োজনীয়তা সংগ্রহ এবং তিনটি অভ্যন্তরীণ ও দুটি ক্লায়েন্ট প্রকল্পে অবদান।'
   ]),
  ('Tiger ERP', 5, false,
   'Java Developer', 'জাভা ডেভেলপার',
   'Tiger ERP', 'টাইগার ইআরপি',
   'Dhaka, Bangladesh', 'ঢাকা, বাংলাদেশ',
   'Jan 2020 – Jan 2021', 'জানুয়ারি ২০২০ – জানুয়ারি ২০২১',
   ARRAY[
     'Built ERP modules with Spring Boot, turning business requirements into maintainable code.',
     'Tested and debugged modules and planned them for future growth.'
   ],
   ARRAY[
     'Spring Boot দিয়ে ইআরপি মডিউল তৈরি, ব্যবসায়িক প্রয়োজনীয়তাকে রক্ষণাবেক্ষণযোগ্য কোডে রূপান্তর।',
     'মডিউল পরীক্ষা ও ডিবাগ এবং ভবিষ্যৎ প্রবৃদ্ধির পরিকল্পনা।'
   ])
) AS v(company_match, ord, on_home, position_en, position_bn, company_en, company_bn, location_en, location_bn, duration_en, duration_bn, r_en, r_bn)
WHERE e.user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60'
  AND e.company_en ILIKE '%' || v.company_match || '%'
  AND e.updated_at = e.created_at
  AND EXISTS (
    SELECT 1 FROM pf_versions r
    WHERE r.user_id = e.user_id AND r.slug = 'researcher' AND r.id = ANY(e.versions)
  );

COMMIT;

-- Check:
-- SELECT sort_order, position_en, company_en, show_on_home FROM pf_experiences e JOIN pf_versions r
--   ON r.id = ANY(e.versions) AND r.slug = 'researcher' ORDER BY sort_order;
