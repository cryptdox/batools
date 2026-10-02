        -- Migration: 028_portfolio_storage_and_samples.sql
        --
        -- 1. A public `portfolio` storage bucket for files the portfolio links to
        --    (the resume PDF today). Files live under `<user_id>/…`. Public so the
        --    site can link to them without signing URLs; writes are open to the anon
        --    key like every pf_ table, since Bangla Tools has no Supabase Auth.
        --
        -- 2. Sample publications so the Research section has something to render.
        --    Every title starts with "[Sample]" and uses the 10.5555 test DOI prefix:
        --    delete or replace them from Portfolio > Research before going live.

        ------------------------------------------------------------------------------
        -- Storage
        ------------------------------------------------------------------------------

        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES ('portfolio', 'portfolio', true, 10485760,
                ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/webp'])
        ON CONFLICT (id) DO NOTHING;

        CREATE POLICY "pf portfolio read"   ON storage.objects FOR SELECT USING (bucket_id = 'portfolio');
        CREATE POLICY "pf portfolio insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'portfolio');
        CREATE POLICY "pf portfolio update" ON storage.objects FOR UPDATE USING (bucket_id = 'portfolio');
        CREATE POLICY "pf portfolio delete" ON storage.objects FOR DELETE USING (bucket_id = 'portfolio');

        ------------------------------------------------------------------------------
        -- Sample publications
        ------------------------------------------------------------------------------

        INSERT INTO pf_publications (id, user_id, title_en, title_bn, authors, venue, pub_type, status, year,
                                abstract_en, abstract_bn, keywords, doi, url, pdf_url, code_url, citation,
                                is_featured, sort_order) VALUES
        ('5a3c1e0e-1f6b-4d7a-9c11-0a0000000001', '88b3efb5-8c58-486e-a3f7-751cc4b23e60',
        '[Sample] Context-Aware Retrieval-Augmented Generation for Domain-Specific Financial Chat Assistants',
        '[নমুনা] ডোমেইন-নির্দিষ্ট আর্থিক চ্যাট সহকারীর জন্য প্রসঙ্গ-সচেতন রিট্রিভাল-অগমেন্টেড জেনারেশন',
        ARRAY['Abir Hosen', 'R. Rahman', 'S. Akter'], 'Sample Journal of Applied AI', 'journal', 'published', 2025,
        'We present a <b>retrieval-augmented generation</b> pipeline that combines structured broker profiles with Model Context Protocol tools, improving answer faithfulness over a plain LLM baseline. (Sample entry — replace with a real publication.)',
        'আমরা একটি <b>রিট্রিভাল-অগমেন্টেড জেনারেশন</b> পাইপলাইন উপস্থাপন করি যা কাঠামোবদ্ধ ব্রোকার প্রোফাইল ও MCP টুল একত্রিত করে। (নমুনা — আসল প্রকাশনা দিয়ে বদলান।)',
        ARRAY['RAG', 'LLM', 'MCP', 'Conversational AI'], '10.5555/sample.2025.0001', NULL, NULL, 'https://github.com/abir-hosen-ashik',
        E'@article{hosen2025sample,\n  title   = {[Sample] Context-Aware Retrieval-Augmented Generation for Domain-Specific Financial Chat Assistants},\n  author  = {Hosen, Abir and Rahman, R. and Akter, S.},\n  journal = {Sample Journal of Applied AI},\n  year    = {2025},\n  doi     = {10.5555/sample.2025.0001}\n}',
        true, 1),

        ('5a3c1e0e-1f6b-4d7a-9c11-0a0000000002', '88b3efb5-8c58-486e-a3f7-751cc4b23e60',
        '[Sample] Natural Language to SQL with Schema-Grounded Prompting and pgvector Retrieval',
        '',
        ARRAY['M. Karim', 'Abir Hosen'], 'Proceedings of the Sample Conference on Data Engineering (SCDE 2024)', 'conference', 'published', 2024,
        'A text-to-SQL approach that retrieves relevant schema fragments with pgvector before prompting, reducing invalid queries on large schemas. (Sample entry — replace with a real publication.)',
        NULL,
        ARRAY['Text-to-SQL', 'NLP', 'pgvector'], '10.5555/sample.2024.0002', NULL, NULL, NULL,
        E'@inproceedings{karim2024sample,\n  title     = {[Sample] Natural Language to SQL with Schema-Grounded Prompting and pgvector Retrieval},\n  author    = {Karim, M. and Hosen, Abir},\n  booktitle = {Proceedings of the Sample Conference on Data Engineering},\n  year      = {2024}\n}',
        false, 2),

        ('5a3c1e0e-1f6b-4d7a-9c11-0a0000000003', '88b3efb5-8c58-486e-a3f7-751cc4b23e60',
        '[Sample] Controllable Solo Instrument Generation with Open Latent Diffusion Audio Models',
        '',
        ARRAY['Abir Hosen'], 'Sample preprint server', 'preprint', 'under_review', 2025,
        'An evaluation of open latent-diffusion audio models for generating solo instrumental parts that follow a given tempo and key. (Sample entry — replace with a real publication.)',
        NULL,
        ARRAY['Audio Generation', 'Diffusion Models', 'Music AI'], NULL, NULL, NULL, NULL, NULL,
        false, 3),

        ('5a3c1e0e-1f6b-4d7a-9c11-0a0000000004', '88b3efb5-8c58-486e-a3f7-751cc4b23e60',
        '[Sample] Machine Learning Approaches for Information & Communication Engineering (MSc Thesis)',
        '',
        ARRAY['Abir Hosen'], 'Noakhali Science & Technology University', 'thesis', 'published', 2023,
        'Master''s thesis placeholder. (Sample entry — replace with your real thesis title and abstract.)',
        NULL,
        ARRAY['Machine Learning'], NULL, NULL, NULL, NULL, NULL,
        false, 4)
        ON CONFLICT DO NOTHING;

        ------------------------------------------------------------------------------
        -- "View All" for the Research section (it previews the first 4 papers)
        ------------------------------------------------------------------------------

        INSERT INTO pf_labels (user_id, key, value_en, value_bn)
        SELECT '88b3efb5-8c58-486e-a3f7-751cc4b23e60', key, value_en, value_bn
        FROM (VALUES
          ('research.viewAll', 'View All Research', 'সকল গবেষণা দেখুন'),
          ('research.allTitle', 'All Research & Publications', 'সকল গবেষণা ও প্রকাশনা')
        ) AS v(key, value_en, value_bn)
        ON CONFLICT (user_id, key) DO NOTHING;

        NOTIFY pgrst, 'reload schema';
