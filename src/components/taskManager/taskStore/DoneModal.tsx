import { useState } from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '../../../lib/LanguageContext';
import type { ToDoTask } from '../../../types/taskManager';

interface DoneModalProps {
  task: ToDoTask;
  onSubmit: (data: {
    date: string;
    period: 'morning' | 'day' | 'night';
    submit_type: 'complete' | 'complete_full';
    note?: string;
  }) => void;
  onClose: () => void;
}

export function DoneModal({ task, onSubmit, onClose }: DoneModalProps) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [period, setPeriod] = useState<'morning' | 'day' | 'night'>('morning');
  const [note, setNote] = useState<string>('');
  const { t } = useLanguage();

  const handleSubmit = (submit_type: 'complete' | 'complete_full') => {
    onSubmit({ date, period, submit_type, note });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('taskStore.markDone')}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              {t('taskStore.description')}
            </label>
            <p className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white break-words">
              {task.description}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              {t('taskStore.note')}
            </label>
            <input className="w-full p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white break-words"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              {t('taskStore.date')}
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              {t('taskStore.period')}
            </label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            >
              <option value="morning">{t('taskManager.morning')}</option>
              <option value="day">{t('taskManager.day')}</option>
              <option value="night">{t('taskManager.night')}</option>
            </select>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            >
              {t('taskStore.cancel')}
            </button>
            <button
              type="submit"
              onClick={(e) => { e.preventDefault(); handleSubmit('complete') }}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              {t('taskStore.complete')}
            </button>
            {
              task.to_do_type == 'progress' &&
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); handleSubmit('complete_full') }}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
              >
                {t('taskStore.complete_full')}
              </button>
            }
          </div>
        </form>
      </div>
    </div>
  );
}
