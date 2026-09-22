import { useState, useEffect } from 'react';
import { useLanguage } from '../../../lib/LanguageContext';
import type { ToDoTask, TaskTag } from '../../../types/taskManager';

interface CreateFormProps {
  editingTask?: ToDoTask | null;
  tags: TaskTag[];
  onSave: (task: Partial<ToDoTask>) => void;
  onCancel?: () => void;
}

export function CreateForm({ editingTask, tags, onSave, onCancel }: CreateFormProps) {
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'one_time' | 'always' | 'progress'>('one_time');
  const [tagId, setTagId] = useState('');
  const [note, setNote] = useState<string>('');
  const { t } = useLanguage();

  useEffect(() => {
    if (editingTask) {
      setDescription(editingTask.description);
      setType(editingTask.to_do_type as 'one_time' | 'always' | 'progress');
      setTagId(editingTask.task_tag || '');
      setNote(editingTask.note || '');
    } else {
      setDescription('');
      setType('one_time');
      setTagId('');
      setNote('');
    }
  }, [editingTask]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    onSave({
      ...(editingTask || {}),
      description,
      to_do_type: type,
      task_tag: tagId || null,
      note,
    });

    setDescription('');
    setType('one_time');
    setTagId('');
    setNote('');
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
      <h2 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white">
        {editingTask ? t('taskStore.editTask') : t('taskStore.createTask')}
      </h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
            {t('taskManager.taskDescription')}
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            rows={1}
            required
            placeholder={t('taskManager.taskDescription')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
            {t('taskStore.note')}
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            rows={5}
            required
            placeholder={t('taskStore.note')}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              {t('taskStore.type')}
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            >
              <option value="one_time">{t('taskStore.oneTime')}</option>
              <option value="always">{t('taskStore.always')}</option>
              <option value="progress">{t('taskStore.progress')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              {t('taskStore.tags')}
            </label>
            <select
              value={tagId}
              onChange={(e) => setTagId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            >
              <option value="">{t('taskStore.selectTag')}</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end space-x-2 pt-2">
          {editingTask && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            >
              {t('taskStore.cancel')}
            </button>
          )}
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            {t('taskStore.save')}
          </button>
        </div>
      </div>
    </form>
  );
}
