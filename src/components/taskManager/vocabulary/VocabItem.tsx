import { Edit, Plus, Trash2 } from 'lucide-react';
import type { Vocabulary } from '../../../types/taskManager';

interface VocabItemProps {
  vocab: Vocabulary;
  addVocabulary: (vocab: Vocabulary) => void;
  onEdit: (vocab: Vocabulary) => void;
  onDelete: (vocab: Vocabulary) => void;
}

export function VocabItem({ vocab, addVocabulary, onEdit, onDelete }: VocabItemProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-md hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white break-words">
              {vocab.text}
            </h3>
            {vocab.is_draft && (
              <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 text-xs rounded">
                Draft
              </span>
            )}
            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded-full uppercase">
              {vocab.language_code}
            </span>
          </div>

          {vocab.phonetic && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 italic">
              {vocab.phonetic}
            </p>
          )}

          {vocab.part_of_speech && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              <span className="font-medium">Part of Speech:</span> {vocab.part_of_speech}
            </p>
          )}

          {vocab.sentences && vocab.sentences.length > 0 && (
            <div className="mt-2 space-y-1">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Examples:</p>
              {vocab.sentences.slice(0, 2).map((sentence, idx) => (
                <p key={idx} className="text-sm text-gray-600 dark:text-gray-400 italic">
                  • {sentence}
                </p>
              ))}
              {vocab.sentences.length > 2 && (
                <p className="text-xs text-gray-500">+{vocab.sentences.length - 2} more</p>
              )}
            </div>
          )}

          {vocab.note && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 border-l-2 border-gray-300 pl-2">
              {vocab.note}
            </p>
          )}

          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            {new Date(vocab.created_at).toLocaleDateString()}
          </p>
        </div>

        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => onEdit(vocab)}
            className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900 rounded-full transition"
            title="Edit"
          >
            <Edit className="w-5 h-5" />
          </button>
          <button
            onClick={() => addVocabulary(vocab)}
            className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900 rounded-full transition"
            title="Add"
          >
            <Plus className="w-5 h-5" />
          </button>
          <button
            onClick={() => onDelete(vocab)}
            className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900 rounded-full transition"
            title="Delete"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
