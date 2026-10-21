import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';

// CV Maker (cv_) rows belong to the signed-in IAM user. A CV's content is one
// JSONB document (CvData); `normalizeCv` fills in anything an older row lacks.

export type CvTemplate = 'classic' | 'modern' | 'minimal';
export const CV_TEMPLATES: CvTemplate[] = ['classic', 'modern', 'minimal'];
export const CV_ACCENTS = ['#2a78d6', '#1baf7a', '#6c5ce7', '#e34948', '#eb6834', '#eda100', '#131d3d', '#4b5563'];

export type CvPersonal = {
  name: string; headline: string; email: string; phone: string; location: string;
  website: string; linkedin: string; github: string; photoUrl: string;
};

/** Dates are free text ("Jan 2022"); `details` is one bullet per line. */
export type CvExperience = { id: string; role: string; company: string; location: string; start: string; end: string; current: boolean; details: string };
export type CvEducation = { id: string; degree: string; school: string; location: string; start: string; end: string; details: string };
export type CvProject = { id: string; name: string; link: string; tech: string; details: string };
/** `items` is comma separated. */
export type CvSkillGroup = { id: string; name: string; items: string };
export type CvCertification = { id: string; name: string; issuer: string; date: string };
export type CvLanguage = { id: string; name: string; level: string };

export type CvListKey = 'experience' | 'education' | 'projects' | 'skills' | 'certifications' | 'languages';
export type CvSectionKey = 'summary' | CvListKey;
export const CV_SECTIONS: CvSectionKey[] = ['summary', 'experience', 'education', 'projects', 'skills', 'certifications', 'languages'];

export type CvData = {
  personal: CvPersonal;
  summary: string;
  experience: CvExperience[];
  education: CvEducation[];
  projects: CvProject[];
  skills: CvSkillGroup[];
  certifications: CvCertification[];
  languages: CvLanguage[];
  /** Order the sections print in; every key appears once. */
  order: CvSectionKey[];
  hidden: CvSectionKey[];
};

export type CvResume = {
  id: string;
  user_id: string;
  title: string;
  template: CvTemplate;
  accent: string;
  data: CvData;
  created_at: string;
  updated_at: string;
};

export const newId = () => crypto.randomUUID();

const EMPTY_PERSONAL: CvPersonal = { name: '', headline: '', email: '', phone: '', location: '', website: '', linkedin: '', github: '', photoUrl: '' };

/** A blank item for each list section. */
export const EMPTY_ITEM: { [K in CvListKey]: () => CvData[K][number] } = {
  experience: () => ({ id: newId(), role: '', company: '', location: '', start: '', end: '', current: false, details: '' }),
  education: () => ({ id: newId(), degree: '', school: '', location: '', start: '', end: '', details: '' }),
  projects: () => ({ id: newId(), name: '', link: '', tech: '', details: '' }),
  skills: () => ({ id: newId(), name: '', items: '' }),
  certifications: () => ({ id: newId(), name: '', issuer: '', date: '' }),
  languages: () => ({ id: newId(), name: '', level: '' }),
};

export const emptyCv = (): CvData => ({
  personal: { ...EMPTY_PERSONAL },
  summary: '',
  experience: [], education: [], projects: [], skills: [], certifications: [], languages: [],
  order: [...CV_SECTIONS],
  hidden: [],
});

const arr = <T,>(v: unknown, make: () => T): T[] =>
  Array.isArray(v) ? v.map(x => ({ ...make(), ...(x as object) })) : [];

/** Any stored document → a complete CvData. */
export function normalizeCv(raw: unknown): CvData {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Partial<CvData>;
  const order = (Array.isArray(d.order) ? d.order : []).filter((k): k is CvSectionKey => CV_SECTIONS.includes(k));
  return {
    personal: { ...EMPTY_PERSONAL, ...(d.personal ?? {}) },
    summary: typeof d.summary === 'string' ? d.summary : '',
    experience: arr(d.experience, EMPTY_ITEM.experience),
    education: arr(d.education, EMPTY_ITEM.education),
    projects: arr(d.projects, EMPTY_ITEM.projects),
    skills: arr(d.skills, EMPTY_ITEM.skills),
    certifications: arr(d.certifications, EMPTY_ITEM.certifications),
    languages: arr(d.languages, EMPTY_ITEM.languages),
    // Keep the saved order, then add any section it does not know yet.
    order: [...new Set([...order, ...CV_SECTIONS])],
    hidden: (Array.isArray(d.hidden) ? d.hidden : []).filter(k => CV_SECTIONS.includes(k)),
  };
}

const toResume = (row: Record<string, unknown>): CvResume => ({ ...(row as unknown as CvResume), data: normalizeCv(row.data) });

/** The signed-in user's CVs, newest edit first. */
export function useCvList() {
  const userId = useAuth().user?.userId ?? null;
  const [resumes, setResumes] = useState<CvResume[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase.from('cv_resumes').select('*').eq('user_id', userId).order('updated_at', { ascending: false });
    setError(error);
    if (!error) setResumes((data ?? []).map(toResume));
    setLoading(false);
  }, [userId]);

  useEffect(() => { void reload(); }, [reload]);
  return { userId, resumes, loading, error, reload };
}

export async function loadCv(id: string, userId: string): Promise<CvResume | null> {
  const { data, error } = await supabase.from('cv_resumes').select('*').eq('id', id).eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data ? toResume(data) : null;
}

export async function createCv(userId: string, fields: { title: string; template?: CvTemplate; accent?: string; data: CvData }): Promise<string> {
  const { data, error } = await supabase.from('cv_resumes').insert([{ user_id: userId, ...fields }]).select('id').single();
  if (error) throw error;
  return data.id as string;
}

export async function saveCv(cv: Pick<CvResume, 'id' | 'user_id' | 'title' | 'template' | 'accent' | 'data'>) {
  const { error } = await supabase.from('cv_resumes')
    .update({ title: cv.title, template: cv.template, accent: cv.accent, data: cv.data, updated_at: new Date().toISOString() })
    .eq('id', cv.id).eq('user_id', cv.user_id);
  if (error) throw error;
}

export async function deleteCv(id: string, userId: string) {
  const { error } = await supabase.from('cv_resumes').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

// --- Import from the Portfolio module (pf_ tables, English text) ---

type Row = Record<string, unknown>;
const s = (v: unknown) => (typeof v === 'string' ? v : '');
const lines = (v: unknown) => (Array.isArray(v) ? v.filter(x => typeof x === 'string' && x.trim()).join('\n') : '');
/** "2019 - 2021" / "Jan 2022 – Present" → start / end. */
const splitRange = (v: unknown): [string, string] => {
  const [start, ...rest] = s(v).split(/\s+[-–—]\s+|\s+to\s+/i);
  return [start?.trim() ?? '', rest.join(' - ').trim()];
};

async function pfRows(table: string, userId: string): Promise<Row[]> {
  const { data, error } = await supabase.from(table).select('*').eq('user_id', userId).eq('is_visible', true).order('sort_order');
  if (error) throw error;
  return data ?? [];
}

/** A CV filled from the user's portfolio: profile, experience, education, projects and tech stack. */
export async function cvFromPortfolio(userId: string): Promise<CvData> {
  const { data: profile, error } = await supabase.from('pf_profile').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  const [experiences, education, projects, tech] = await Promise.all([
    pfRows('pf_experiences', userId), pfRows('pf_education', userId), pfRows('pf_projects', userId), pfRows('pf_tech_categories', userId),
  ]);
  const p = (profile ?? {}) as Row;
  const cv = emptyCv();
  cv.personal = {
    ...cv.personal,
    name: s(p.name_en), headline: s(p.title_en), email: s(p.email), phone: s(p.phone_en),
    linkedin: s(p.linkedin), github: s(p.github),
  };
  cv.summary = s(p.objective_en);
  cv.experience = experiences.map(r => {
    const [start, end] = splitRange(r.duration_en);
    return {
      ...EMPTY_ITEM.experience(), role: s(r.position_en), company: s(r.company_en), location: s(r.location_en),
      start, end: r.is_current ? '' : end, current: !!r.is_current, details: lines(r.responsibilities_en),
    };
  });
  cv.education = education.map(r => {
    const [start, end] = splitRange(r.year_en);
    return { ...EMPTY_ITEM.education(), degree: s(r.degree_en), school: s(r.institution_en), location: s(r.location_en), start, end };
  });
  cv.projects = projects.map(r => ({
    ...EMPTY_ITEM.projects(), name: s(r.title_en), link: s(r.link),
    tech: Array.isArray(r.tech_stack) ? r.tech_stack.join(', ') : '',
    details: lines(r.responsibilities_en) || s(r.description_en),
  }));
  cv.skills = tech.map(r => ({ ...EMPTY_ITEM.skills(), name: s(r.title_en), items: Array.isArray(r.skills) ? r.skills.join(', ') : '' }));
  return cv;
}
