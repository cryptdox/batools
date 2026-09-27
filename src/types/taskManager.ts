export type TaskPeriod = 'morning' | 'day' | 'night';

export interface TaskManagerUser {
  id: string;
  user_name: string;
  is_admin: boolean;
  password: string;
  created_at: string;
}

export interface TaskType {
  id: string;
  name: string;
  color: string;
  user_id: string;
  created_at: string;
}

export interface TaskTag {
  id: string;
  name: string;
  color: string;
  user_id: string;
  created_at: string;
}

export interface Task {
  id: string;
  task: string;
  task_tag: string | null;
  task_period: TaskPeriod;
  date: string;
  user_id: string;
  created_at: string;
}

export interface TaskTagTaskType {
  task_tag_id: string;
  task_type_id: string;
}

export type ToDoTaskType = 'always' | 'one_time' | 'progress';

export interface ToDoTask {
  id: string;
  to_do_type: ToDoTaskType;
  parent_task: string | null;
  description: string;
  created_on: string; // ISO date string
  task_tag: string | null;
  archived: boolean;
  user_id: string; // Supabase auth user ID
  note: string | null;
}

export type PartOfSpeech = 'noun' | 'verb' | 'adjective' | 'adverb' | 'preposition' | 'conjunction' | 'pronoun' | 'interjection' | 'article' | 'determiner' | 'numeral' | 'exclamation' | 'other';
export type LanguageCode = 'en' | 'bn';
export type RelationType = 'translation' | 'semantic' | 'contextual' | 'synonym' | 'antonym';

export interface Vocabulary {
  id: number;
  language_code: LanguageCode;
  text: string;
  phonetic: string | null;
  sentences: any[] | null;
  note: string | null;
  part_of_speech: PartOfSpeech | null;
  is_draft: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface VocabularyMap {
  id: number;
  source_id: number;
  target_id: number;
  relation_type: RelationType;
  is_primary: boolean;
  created_by: string;
  created_at: string;
}
