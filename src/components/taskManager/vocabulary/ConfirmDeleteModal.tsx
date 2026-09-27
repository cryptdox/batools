import { X } from 'lucide-react';
import { useLanguage } from '../../../lib/LanguageContext';

interface ConfirmDeleteModalProps {
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDeleteModal({ onConfirm, onClose }: ConfirmDeleteModalProps) {
  const { t } = useLanguage();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Delete</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <p className="mb-6 text-gray-700 dark:text-gray-300">
          {t('vocabulary.deleteConfirmation')}
        </p>

        <div className="flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
          >
            {t('vocabulary.cancel')}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
          >
            {t('vocabulary.delete')}
          </button>
        </div>
      </div>
    </div>
  );
}
