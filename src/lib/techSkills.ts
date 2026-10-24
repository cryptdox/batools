import { supabase } from './supabase';

// The Tech Stack (pf_tech_categories.skills) is the list of skills; a
// project's tech stack picks from it, and anything new a project adds joins
// an "Others" category so the portfolio's skill ↔ project counts line up.

/** Same matching as the portfolio: case, punctuation and a trailing "JS" do not count. */
export const skillKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/js$/, '');

export type SkillCategory = { id: string; title_en: string; skills: string[]; sort_order: number };

export async function loadSkillCategories(userId: string): Promise<SkillCategory[]> {
  const { data, error } = await supabase.from('pf_tech_categories')
    .select('id, title_en, skills, sort_order').eq('user_id', userId).order('sort_order');
  if (error) throw error;
  return (data ?? []) as SkillCategory[];
}

const OTHERS = 'Others';

/** Adds the skills no category has yet to "Others" (created when missing); returns what was added. */
export async function addMissingSkills(userId: string, skills: string[]): Promise<string[]> {
  const categories = await loadSkillCategories(userId);
  const known = new Set(categories.flatMap(c => c.skills.map(skillKey)));
  const missing: string[] = [];
  for (const s of skills.map(x => x.trim()).filter(Boolean)) {
    const key = skillKey(s);
    if (key && !known.has(key)) { known.add(key); missing.push(s); }
  }
  if (!missing.length) return [];

  const others = categories.find(c => c.title_en.trim().toLowerCase() === OTHERS.toLowerCase());
  const { error } = others
    ? await supabase.from('pf_tech_categories')
        .update({ skills: [...others.skills, ...missing], updated_at: new Date().toISOString() })
        .eq('id', others.id).eq('user_id', userId)
    : await supabase.from('pf_tech_categories').insert({
        user_id: userId, title_en: OTHERS, title_bn: 'অন্যান্য', icon: 'wrench', skills: missing,
        sort_order: Math.max(0, ...categories.map(c => c.sort_order)) + 1,
      });
  if (error) throw error;
  return missing;
}
