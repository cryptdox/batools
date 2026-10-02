-- Migration: 029_portfolio_more_samples.sql
-- Two more sample publications (6 in total with 028), so the Research
-- section has more than the 4 it previews and its "View All" button shows.
-- Same rules as 028: "[Sample]" titles, 10.5555 test DOIs — delete or replace
-- them from Portfolio > Research before going live. Safe to re-run.

INSERT INTO pf_publications (id, user_id, title_en, title_bn, authors, venue, pub_type, status, year,
                             abstract_en, abstract_bn, keywords, doi, url, pdf_url, code_url, citation,
                             is_featured, sort_order) VALUES
  ('5a3c1e0e-1f6b-4d7a-9c11-0a0000000005', '88b3efb5-8c58-486e-a3f7-751cc4b23e60',
   '[Sample] Matching Job Requirements to Candidate CVs with Transformer Embeddings and Learning-to-Rank',
   '[নমুনা] ট্রান্সফরমার এমবেডিং ও লার্নিং-টু-র‍্যাংক দিয়ে চাকরির চাহিদা ও প্রার্থীর সিভি মেলানো',
   ARRAY['S. Islam', 'Abir Hosen', 'T. Chowdhury'], 'Sample Transactions on Intelligent Systems', 'journal', 'accepted', 2025,
   'A two-stage recruitment pipeline: dense retrieval of candidate CVs with transformer embeddings, then a learning-to-rank model trained on recruiter feedback. (Sample entry — replace with a real publication.)',
   'দুই ধাপের রিক্রুটমেন্ট পাইপলাইন: ট্রান্সফরমার এমবেডিং দিয়ে সিভি খোঁজা, তারপর রিক্রুটারের মতামতে প্রশিক্ষিত র‍্যাংকিং মডেল। (নমুনা — আসল প্রকাশনা দিয়ে বদলান।)',
   ARRAY['NLP', 'Information Retrieval', 'Learning to Rank', 'Recruitment'], '10.5555/sample.2025.0005', NULL, NULL, NULL,
   E'@article{islam2025sample,\n  title   = {[Sample] Matching Job Requirements to Candidate CVs with Transformer Embeddings and Learning-to-Rank},\n  author  = {Islam, S. and Hosen, Abir and Chowdhury, T.},\n  journal = {Sample Transactions on Intelligent Systems},\n  year    = {2025},\n  doi     = {10.5555/sample.2025.0005}\n}',
   false, 5),

  ('5a3c1e0e-1f6b-4d7a-9c11-0a0000000006', '88b3efb5-8c58-486e-a3f7-751cc4b23e60',
   '[Sample] Event-Driven Microservices for Real-Time Media Processing at Scale',
   '',
   ARRAY['Abir Hosen', 'N. Haque'], 'Proceedings of the Sample International Conference on Cloud Computing (SICCC 2023)', 'conference', 'published', 2023,
   'An architecture for audio and video processing jobs (FFmpeg, source separation) built on event-driven microservices, with measurements of throughput and cost on AWS. (Sample entry — replace with a real publication.)',
   NULL,
   ARRAY['Microservices', 'Event-Driven Architecture', 'Media Processing', 'AWS'], '10.5555/sample.2023.0006', NULL, NULL, 'https://github.com/abir-hosen-ashik',
   E'@inproceedings{hosen2023sample,\n  title     = {[Sample] Event-Driven Microservices for Real-Time Media Processing at Scale},\n  author    = {Hosen, Abir and Haque, N.},\n  booktitle = {Proceedings of the Sample International Conference on Cloud Computing},\n  year      = {2023},\n  doi       = {10.5555/sample.2023.0006}\n}',
   false, 6)
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
