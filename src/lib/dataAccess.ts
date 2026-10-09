import { PAGE_RESOURCES, SECTION_RESOURCES, permissionKey, type Action } from './permissions';

// Authorization of batools' own Supabase calls (tables, views, functions and
// the music storage bucket), checked in the browser before a request leaves:
// every call through `supabase` passes `checkRequest`. It mirrors the page
// gates (lib/permissions.ts) one level down, per data operation:
//   - reading a module's table / view needs READ or READ_ALL on any page of
//     that module (pages share tables, e.g. Buy reads products and partners);
//   - inserting / updating / deleting needs CREATE / UPDATE / DELETE (or the
//     *_ALL variant) on a page that owns that table (TABLE_RESOURCES);
//   - functions are classed as reads or as a write on their page (FUNCTIONS).
// Tables of modules batools does not know stay unchecked. This guards the app,
// not the database: the anon key itself can still reach Supabase directly.

/** Every module's tables / views / functions share a prefix; its pages share one in IAM. */
const MODULES: Record<string, string> = {
  lt: 'LATE_TRACKER',
  ac: 'ACHIVEMENT_CYCLE',
  tm: 'TASK_MANAGER',
  pb: 'PARTNER_BUSINESS',
  pf: 'PORTFOLIO',
  org: 'ORG_SITE',
  mp: 'MUSIC',
};

/** Pages (IAM resources) that may change each table. Unlisted tables of a module fall back to any of its pages. */
const TABLE_RESOURCES: Record<string, string[]> = {
  // Late Tracker
  lt_attendance_records: ['LATE_TRACKER_DAILY'],
  lt_attendance_settings: ['LATE_TRACKER_SETTINGS'],
  lt_team_members: ['LATE_TRACKER_MEMBER'],
  lt_team_member_types: ['LATE_TRACKER_MEMBER', 'LATE_TRACKER_SETTINGS'],
  lt_punishments: ['LATE_TRACKER_PUNISHMENT'],
  lt_punishment_transactions: ['LATE_TRACKER_PUNISHMENT'],
  lt_spends: ['LATE_TRACKER_SPEND'],
  // Achievement Cycle
  ac_topics: ['ACHIVEMENT_CYCLE_TOPICS'],
  ac_topic_links: ['ACHIVEMENT_CYCLE_TOPICS'],
  ac_topic_domains: ['ACHIVEMENT_CYCLE_TOPICS'],
  ac_cycles: ['ACHIVEMENT_CYCLE_TOPICS', 'ACHIVEMENT_CYCLE_KANBAN'],
  ac_progress_logs: ['ACHIVEMENT_CYCLE_KANBAN', 'ACHIVEMENT_CYCLE_TOPICS'],
  ac_domains: ['ACHIVEMENT_CYCLE_DOMAIN'],
  ac_domain_types: ['ACHIVEMENT_CYCLE_DOMAIN_TYPE'],
  // Task Manager
  tm_task: ['TASK_MANAGER_DAILY', 'TASK_MANAGER_STORE'],
  tm_to_do_task: ['TASK_MANAGER_STORE', 'TASK_MANAGER_DAILY'],
  tm_task_tag: ['TASK_MANAGER_ADMINISTRATION'],
  tm_task_type: ['TASK_MANAGER_ADMINISTRATION'],
  tm_task_tag_task_type: ['TASK_MANAGER_ADMINISTRATION'],
  tm_vocabulary: ['TASK_MANAGER_VOCABULARY'],
  tm_vocabulary_map: ['TASK_MANAGER_VOCABULARY'],
  // Partner Business
  pb_products: ['PARTNER_BUSINESS_PRODUCTS'],
  pb_buy_batches: ['PARTNER_BUSINESS_BUY'],
  pb_buy_batch_items: ['PARTNER_BUSINESS_BUY'],
  pb_buy_batch_extra_costs: ['PARTNER_BUSINESS_BUY'],
  pb_buy_batch_partner_shares: ['PARTNER_BUSINESS_BUY', 'PARTNER_BUSINESS_PROFIT_ADJUST'],
  pb_sales: ['PARTNER_BUSINESS_SELL'],
  pb_sale_events: ['PARTNER_BUSINESS_SELL'],
  pb_sale_extra_costs: ['PARTNER_BUSINESS_SELL'],
  pb_additional_costs: ['PARTNER_BUSINESS_COSTS'],
  pb_assets: ['PARTNER_BUSINESS_ASSETS'],
  pb_partners: ['PARTNER_BUSINESS_PARTNERS'],
  pb_partner_shares: ['PARTNER_BUSINESS_PARTNERS'],
  pb_partner_transactions: ['PARTNER_BUSINESS_LEDGER', 'PARTNER_BUSINESS_PARTNERS'],
  pb_share_groups: ['PARTNER_BUSINESS_SHARE_GROUPS'],
  pb_share_group_members: ['PARTNER_BUSINESS_SHARE_GROUPS'],
  pb_group_fund_allocations: ['PARTNER_BUSINESS_SHARE_GROUPS'],
  pb_profit_adjustments: ['PARTNER_BUSINESS_PROFIT_ADJUST'],
  pb_profit_adjustment_batches: ['PARTNER_BUSINESS_PROFIT_ADJUST'],
  pb_profit_adjustment_costs: ['PARTNER_BUSINESS_PROFIT_ADJUST'],
  pb_profit_adjustment_partners: ['PARTNER_BUSINESS_PROFIT_ADJUST'],
  // Portfolio
  pf_profile: ['PORTFOLIO_PROFILE'],
  pf_hero_roles: ['PORTFOLIO_PROFILE'],
  pf_about_sections: ['PORTFOLIO_ABOUT'],
  pf_about_blocks: ['PORTFOLIO_ABOUT'],
  pf_interests: ['PORTFOLIO_ABOUT'],
  pf_checklist: ['PORTFOLIO_ABOUT'],
  pf_projects: ['PORTFOLIO_PROJECTS'],
  pf_experiences: ['PORTFOLIO_EXPERIENCE'],
  pf_education: ['PORTFOLIO_EXPERIENCE'],
  pf_tech_categories: ['PORTFOLIO_TECH_STACK'],
  pf_core_skills: ['PORTFOLIO_TECH_STACK'],
  pf_publications: ['PORTFOLIO_RESEARCH'],
  pf_labels: ['PORTFOLIO_LABELS'],
  pf_messages: ['PORTFOLIO_MESSAGES'],
  // Organization site
  org_about: ['ORG_SITE_ABOUT'],
  org_services: ['ORG_SITE_SERVICES'],
  org_products: ['ORG_SITE_PRODUCTS'],
  org_projects: ['ORG_SITE_PROJECTS'],
  org_clients: ['ORG_SITE_CLIENTS'],
  org_testimonials: ['ORG_SITE_CLIENTS'],
  org_teams: ['ORG_SITE_TEAMS'],
  org_skills: ['ORG_SITE_TEAMS', 'ORG_SITE_MEMBERS'],
  org_members: ['ORG_SITE_MEMBERS'],
  org_member_teams: ['ORG_SITE_MEMBERS', 'ORG_SITE_TEAMS'],
  org_member_skills: ['ORG_SITE_MEMBERS'],
  org_member_education: ['ORG_SITE_MEMBERS'],
  org_member_experiences: ['ORG_SITE_MEMBERS'],
  org_blogs: ['ORG_SITE_BLOG'],
  org_jobs: ['ORG_SITE_JOBS'],
  org_faqs: ['ORG_SITE_FAQS'],
  org_job_applications: ['ORG_SITE_APPLICATIONS'],
  org_contacts: ['ORG_SITE_CONTACTS'],
  // Music
  mp_songs: ['MUSIC_LIBRARY'],
  mp_files: ['MUSIC_LIBRARY'],
  mp_song_singers: ['MUSIC_LIBRARY'],
  mp_ratings: ['MUSIC_LIBRARY', 'MUSIC_COLLECTIONS', 'MUSIC_PLAYER'],
  mp_collections: ['MUSIC_COLLECTIONS'],
  mp_collection_songs: ['MUSIC_COLLECTIONS', 'MUSIC_LIBRARY'],
  mp_collection_singers: ['MUSIC_COLLECTIONS'],
  mp_collection_languages: ['MUSIC_COLLECTIONS'],
  mp_singers: ['MUSIC_SINGERS', 'MUSIC_LIBRARY'],
  mp_sources: ['MUSIC_SOURCES', 'MUSIC_LIBRARY'],
  mp_source_singers: ['MUSIC_SOURCES'],
  mp_genres: ['MUSIC_GENRES'],
  mp_countries: ['MUSIC_PLACES'],
  mp_languages: ['MUSIC_PLACES'],
};

/** Database functions: read-only ones, and writes with the action and pages they need. */
const FUNCTIONS: Record<string, 'read' | { action: Action; resources: string[] }> = {
  ac_rollup: 'read',
  ac_domain_rollup: 'read',
  mp_similar_song_scores: 'read',
  // The player counts a play while listening: part of reading music.
  mp_count_play: 'read',
  record_attendance: { action: 'UPDATE', resources: ['LATE_TRACKER_DAILY'] },
  add_punishment_transaction: { action: 'UPDATE', resources: ['LATE_TRACKER_PUNISHMENT'] },
  waive_all_remaining: { action: 'UPDATE', resources: ['LATE_TRACKER_PUNISHMENT'] },
  ac_set_topic_points: { action: 'UPDATE', resources: ['ACHIVEMENT_CYCLE_TOPICS'] },
  ac_start_cycle: { action: 'CREATE', resources: ['ACHIVEMENT_CYCLE_TOPICS'] },
  ac_delete_cycle: { action: 'DELETE', resources: ['ACHIVEMENT_CYCLE_TOPICS'] },
  ac_remove: { action: 'DELETE', resources: ['ACHIVEMENT_CYCLE_TOPICS', 'ACHIVEMENT_CYCLE_DOMAIN'] },
  ac_restore: { action: 'UPDATE', resources: ['ACHIVEMENT_CYCLE_TOPICS', 'ACHIVEMENT_CYCLE_DOMAIN'] },
  ac_log_progress: { action: 'UPDATE', resources: ['ACHIVEMENT_CYCLE_KANBAN', 'ACHIVEMENT_CYCLE_TOPICS'] },
  ac_set_status: { action: 'UPDATE', resources: ['ACHIVEMENT_CYCLE_KANBAN', 'ACHIVEMENT_CYCLE_TOPICS'] },
  ac_bulk_status: { action: 'UPDATE', resources: ['ACHIVEMENT_CYCLE_MILESTONE'] },
};

/** Storage buckets batools writes to, and the page that owns uploads. */
const BUCKETS: Record<string, string[]> = { music: ['MUSIC_LIBRARY', 'MUSIC_COLLECTIONS'] };

// Section resources count for their module's reads too (e.g. MUSIC_QUICK_PLAY reads songs to play them).
const ALL_RESOURCES = [...Object.values(PAGE_RESOURCES), ...Object.values(SECTION_RESOURCES)];
const moduleOf = (name: string) => MODULES[name.split('_')[0]] ?? null;
const moduleResources = (module: string) => ALL_RESOURCES.filter(r => r.startsWith(`${module}_`) || r === module);

type Need = { action: Action; resources: string[]; what: string } | null;

/** What a Supabase request needs, or null when batools does not check it. */
export function requirementOf(url: string, method: string, prefer: string | null): Need {
  let path: string;
  try { path = new URL(url).pathname; } catch { return null; }
  const m = method.toUpperCase();
  const read = m === 'GET' || m === 'HEAD';

  const rest = path.match(/\/rest\/v1\/(rpc\/)?([a-z0-9_]+)/);
  if (rest) {
    const [, rpc, name] = rest;
    const module = moduleOf(name);
    if (!module) return null;
    const own = TABLE_RESOURCES[name] ?? moduleResources(module);
    if (rpc) {
      const fn = FUNCTIONS[name];
      if (!fn || fn === 'read') return { action: 'READ', resources: moduleResources(module), what: `${name}()` };
      return { ...fn, what: `${name}()` };
    }
    if (read) return { action: 'READ', resources: moduleResources(module), what: name };
    if (m === 'DELETE') return { action: 'DELETE', resources: own, what: name };
    if (m === 'PATCH' || m === 'PUT') return { action: 'UPDATE', resources: own, what: name };
    // POST: an insert, or an upsert that may also overwrite rows.
    return { action: prefer?.includes('resolution=merge-duplicates') ? 'UPDATE' : 'CREATE', resources: own, what: name };
  }

  const storage = path.match(/\/storage\/v1\/object\/(?:public\/|sign\/|authenticated\/)?([a-z0-9_-]+)/);
  if (storage) {
    const resources = BUCKETS[storage[1]];
    if (!resources || read) return null; // public files are read straight from the bucket
    return { action: m === 'DELETE' ? 'DELETE' : m === 'POST' ? 'CREATE' : 'UPDATE', resources, what: `${storage[1]} files` };
  }
  return null;
}

/** Whether a permission list satisfies a requirement (the *_ALL variant counts too). */
export function allows(permissions: string[], need: NonNullable<Need>): boolean {
  const actions: Action[] = need.action === 'READ' ? ['READ', 'READ_ALL']
    : need.action === 'CREATE' ? ['CREATE']
    : [need.action, `${need.action}_ALL` as Action];
  return need.resources.some(r => actions.some(a => permissions.includes(permissionKey(r, a))));
}

/** A PostgREST / Storage shaped 403, so supabase-js reports it like any refused call. */
export function deniedResponse(need: NonNullable<Need>): Response {
  const module = moduleOf(need.what.replace(/\(\)$/, ''));
  const where = need.resources.length > 2 && module ? `any ${module} page` : need.resources.join(' or ');
  const message = `Permission denied: ${need.action.toLowerCase()} on ${need.what} needs ${need.action} on ${where} in IAM.`;
  return new Response(JSON.stringify({ code: '42501', message, details: null, hint: null, error: 'Forbidden', statusCode: '403' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });
}
