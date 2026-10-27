-- Research portfolio, part 3, for Abir Hosen (IAM user 88b3efb5-…).
-- Run in the Supabase SQL editor after parts 1 and 2. Safe to re-run.
--
-- Experience and projects get one wording per version:
--   * everything there today becomes Developer-only (the Hugging Face model
--     projects from part 2 stay in every version);
--   * Researcher gets its own copies, worded like the research CV: the AI
--     work first, then the rest.
-- Edit either copy in batools without touching the other.

BEGIN;

------------------------------------------------------------------------------
-- Today's rows → Developer only
------------------------------------------------------------------------------
UPDATE pf_experiences SET versions = ARRAY(
    SELECT id FROM pf_versions WHERE user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60' AND slug = 'developer'),
  updated_at = now()
WHERE user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60' AND kind = 'industry' AND versions = '{}';

UPDATE pf_projects SET versions = ARRAY(
    SELECT id FROM pf_versions WHERE user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60' AND slug = 'developer'),
  updated_at = now()
WHERE user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60' AND versions = '{}'
  AND (link IS NULL OR link NOT LIKE 'https://huggingface.co/%');

------------------------------------------------------------------------------
-- Researcher experience: a copy of each industry role, AI work first.
-- English only (the Bangla view falls back to it).
------------------------------------------------------------------------------
INSERT INTO pf_experiences (user_id, versions, kind, company_en, company_bn, position_en, position_bn, location_en, location_bn,
  duration_en, duration_bn, responsibilities_en, responsibilities_bn, is_current, show_on_home, sort_order)
SELECT e.user_id,
  ARRAY(SELECT id FROM pf_versions WHERE user_id = e.user_id AND slug = 'researcher'),
  'industry', e.company_en, e.company_bn, e.position_en, e.position_bn, e.location_en, e.location_bn,
  e.duration_en, e.duration_bn, v.points, '{}', e.is_current, true, e.sort_order
FROM pf_experiences e
JOIN (VALUES
  ('Grameen Health Tech', ARRAY[
    'Build the AI patient-assistant chat that supports patients through their whole care journey on the Shukhee platform.',
    'Build core APIs, payment integrations, Health Store e-commerce, and bulk-processing services.',
    'Automate scheduled tasks and background workflows using cron jobs, BullMQ, and Redis.',
    'Manage database design, system architecture, deployment support, and maintenance.',
    'Drive code quality, technical decisions, and engineering collaboration.']),
  ('Sofof Tech', ARRAY[
    'Connected core systems with an AI service for LLM-generated, business-tailored messaging through event-driven pipelines.',
    'Led development of large-scale microservices (10+ services) using NestJS monorepo architecture.',
    'Owned the end-to-end system lifecycle: architecture, development, deployment support, and maintenance.',
    'Mentored engineers, enforced code quality, and contributed to technical decisions.']),
  ('Embedded Logic Operation (ELO)', ARRAY[
    'Owned 3 full-cycle projects: DB design, system architecture, AI module integration (AI job matching, AI music generation) and deployments.',
    'Led 2 tech stack migrations, managed 10+ GitHub repos and access, and built scalable apps from scratch.',
    'Collaborated in daily scrums, mentored newcomers, gave tech presentations and ensured code quality across teams.']),
  ('ADN Diginet', ARRAY[
    'Supported a marketing automation platform (Roboket) with AI-driven decision making from client activity to choose marketing targets.',
    'Owned 5+ micro frontend projects and maintained clean, scalable code structure.',
    'Collaborated with 3+ project teams, onboarded new members, and supported backend development.',
    'Gathered business requirements, contributed to 3 in-house and 2 client projects, and proposed development strategies.']),
  ('Tiger ERP', ARRAY[
    'Translated business needs into clean, maintainable code with teams.',
    'Analyzed requirements and delivered effective, maintainable, user-friendly software solutions.',
    'Performed thorough testing and debugging, and planned for scalable future growth.'])
) AS v(company, points) ON e.company_en = v.company
WHERE e.user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60' AND e.kind = 'industry'
  AND NOT EXISTS (SELECT 1 FROM pf_versions r WHERE r.id = ANY(e.versions) AND r.slug = 'researcher')
  AND NOT EXISTS (
    SELECT 1 FROM pf_experiences x JOIN pf_versions r ON r.id = ANY(x.versions) AND r.slug = 'researcher'
    WHERE x.user_id = e.user_id AND x.company_en = e.company_en AND x.kind = 'industry'
  );

------------------------------------------------------------------------------
-- Researcher projects: copies of the AI projects, worded like the CV.
------------------------------------------------------------------------------
INSERT INTO pf_projects (user_id, versions, title_en, title_bn, duration_en, duration_bn, description_en, responsibilities_en,
  tech_stack, link, is_featured, show_on_home, sort_order)
SELECT p.user_id,
  ARRAY(SELECT id FROM pf_versions WHERE user_id = p.user_id AND slug = 'researcher'),
  p.title_en, p.title_bn, p.duration_en, p.duration_bn, v.description, v.points, v.tech, p.link, p.is_featured, true, v.sort_order
FROM pf_projects p
JOIN (VALUES
  ('Query AI', '<p>NLP-based natural-language-to-SQL system that generates and executes SQL queries from user prompts.</p>', ARRAY[
    'Used pgVector for semantic vector search over schema and data, with PostgreSQL for structured storage.',
    'Designed and optimized the full database and query execution pipeline; built the FastAPI backend.'],
    ARRAY['Python', 'FastAPI', 'NLP', 'SpaCy', 'pgVector', 'SQLAlchemy', 'PostgreSQL'], 1),
  ('Radd', '<p>AI-first customer service platform for Arabic businesses on the official WhatsApp (Meta) API.</p>', ARRAY[
    'AI-generated broadcast campaigns: the AI service analyzes each client''s business and writes tailored messages.',
    'Connected the core system and AI service through event-driven RabbitMQ pipelines delivering million-scale messages, with retry handling and failure tracking.'],
    ARRAY['LLM', 'NestJS', 'RabbitMQ', 'PostgreSQL', 'Redis', 'WhatsApp Cloud API', 'AWS'], 2),
  ('Jamahook', '<p>Solo instrumental generation service built on Stable Audio open models, integrated into Jamahook''s real-time DAW assistant.</p>', ARRAY[
    'Designed and developed the generation service with Stable Audio open models.',
    'Analyzed platform constraints to choose the deployment architecture for generative audio inference.'],
    ARRAY['Generative AI', 'Stable Audio', 'Python', 'FastAPI', 'Docker'], 3),
  ('Chat Brokers', '<p>LLM-powered broker information assistant with dynamic, context-aware conversations.</p>', ARRAY[
    'Designed a RAG and MCP toolset for broker comparison and recommendations.',
    'Built the data ingestion and structuring pipeline for diverse broker profiles; owned the architecture and data model.'],
    ARRAY['LLM', 'RAG', 'MCP', 'LangChain', 'Python', 'FastAPI', 'PostgreSQL'], 4),
  ('Cannella', '<p>AI models that analyze job requirements and applicant CVs to match candidates to roles.</p>', ARRAY[
    'Implemented machine learning ranking of candidates per job and optimized it for accuracy and speed.'],
    ARRAY['Machine Learning', 'NLP', 'Python', 'Scikit-learn', 'PostgreSQL'], 5),
  ('Shukhee', '<p>AI assistant chat that supports patients through their whole care journey, from finding services to follow-up, on Bangladesh''s all-in-one healthcare platform.</p>', ARRAY[
    'Healthcare platform (teleconsultation, lab tests, health store): payment APIs, health e-commerce and bulk processing.',
    'Scheduled and asynchronous background workflows using cron jobs, BullMQ and Redis.'],
    ARRAY['AI Assistant', 'NestJS', 'PostgreSQL', 'Prisma', 'Redis', 'BullMQ'], 6),
  ('Probashkormi', '<p>AI job matching that connects Bangladeshi job seekers with suitable, verified overseas employers.</p>', ARRAY[
    'Full-stack recruitment platform; designed the system and database schema.'],
    ARRAY['AI Job Matching', 'NestJS', 'MongoDB', 'Prisma', 'AdminJS', 'AWS S3'], 7),
  ('SoftCollab', '<p>AI-based music generation for producers and musicians on a music collaboration platform.</p>', ARRAY[
    'Upgraded the platform backend; audio and image processing pipelines with FFmpeg and ImageMagick.',
    'Real-time collaboration over Socket.IO.'],
    ARRAY['Generative AI', 'FFmpeg', 'ImageMagick', 'Socket.IO', 'ExpressJS', 'MySQL', 'AWS S3'], 8),
  ('Roboket', '<p>AI-driven decision making from client activity to choose marketing targets, in a marketing automation and lead generation system.</p>', ARRAY[
    'Integrated Mautic and Facebook APIs; led the ReactJS micro-frontends.'],
    ARRAY['AI Decision Support', 'Python', 'FastAPI', 'ReactJS', 'Mautic API'], 9),
  ('Singistic', '<p>Online karaoke app for Web, Android and iOS using Spleeter (deep-learning source separation) to split vocals from music.</p>', ARRAY[
    'Audio processing with FFmpeg; media pipeline on AWS S3.'],
    ARRAY['Spleeter', 'FFmpeg', 'ImageMagick', 'NestJS', 'DynamoDB', 'AWS S3'], 12)
) AS v(match, description, points, tech, sort_order) ON p.title_en ILIKE v.match || '%'
WHERE p.user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60'
  AND NOT EXISTS (SELECT 1 FROM pf_versions r WHERE r.id = ANY(p.versions) AND r.slug = 'researcher')
  AND NOT EXISTS (
    SELECT 1 FROM pf_projects x JOIN pf_versions r ON r.id = ANY(x.versions) AND r.slug = 'researcher'
    WHERE x.user_id = p.user_id AND x.title_en = p.title_en
  );

-- Two research write-ups that are not projects on the developer site.
INSERT INTO pf_projects (user_id, versions, title_en, duration_en, description_en, responsibilities_en, tech_stack, is_featured, show_on_home, sort_order)
SELECT '88b3efb5-8c58-486e-a3f7-751cc4b23e60',
  ARRAY(SELECT id FROM pf_versions WHERE user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60' AND slug = 'researcher'),
  v.title, 'Independent research', v.description, v.points, v.tech, true, true, v.sort_order
FROM (VALUES
  ('Document RAG Pipeline', '<p>Retrieval-augmented generation pipeline that ingests PDF documents, indexes them in FAISS and answers questions with DeepSeek-LLM.</p>',
   ARRAY['Published a technical write-up on Medium.'], ARRAY['LangChain', 'FAISS', 'DeepSeek-LLM', 'Python'], 10),
  ('MCP Server with Gemini 2.0 Flash', '<p>An MCP setup on Gemini 2.0 Flash for persistent, structured context across LLM tools.</p>',
   ARRAY['Published a technical write-up on Medium.'], ARRAY['MCP', 'Gemini', 'LLM Tooling', 'Python'], 11)
) AS v(title, description, points, tech, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM pf_projects x
  WHERE x.user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60' AND x.title_en = v.title
);

COMMIT;
