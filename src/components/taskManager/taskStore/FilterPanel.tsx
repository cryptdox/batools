import { useLanguage } from '../../../lib/LanguageContext';
import type { TaskTag } from '../../../types/taskManager';

interface FilterPanelProps {
  tags: TaskTag[];
  selectedTag: string;
  onTagChange: (tagId: string) => void;
  archived: boolean;
  setArchived: (archive: boolean) => void;
}

export function FilterPanel({ tags, selectedTag, onTagChange, archived, setArchived }: FilterPanelProps) {
  const { t } = useLanguage();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
      <h2 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white">{t('taskStore.filters')}</h2>

      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">{t('taskStore.tags')}</h3>
          <div className="space-y-2">
            <label className="flex items-center cursor-pointer hover:text-blue-600">
              <input
                type="radio"
                name="tag"
                value="all"
                checked={selectedTag === 'all'}
                onChange={(e) => onTagChange(e.target.value)}
                className="mr-3"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">{t('taskStore.all')}</span>
            </label>
            {tags.map((tag) => (
              <label key={tag.id} className="flex items-center cursor-pointer hover:text-blue-600">
                <input
                  type="radio"
                  name="tag"
                  value={tag.id}
                  checked={selectedTag === tag.id}
                  onChange={(e) => onTagChange(e.target.value)}
                  className="mr-3"
                />
                <span
                  className="inline-block w-4 h-4 rounded-full mr-2"
                  style={{ backgroundColor: tag.color }}
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{tag.name}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
      <br/>
      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">{t('taskStore.archive')}</h3>
          <div className="space-y-2">
            <label className="flex items-center cursor-pointer hover:text-blue-600">
              <input
                type="checkbox"
                name="archive"
                value={archived? "Archived": "Not Archived"}
                checked={archived}
                onChange={() => setArchived(!archived)}
                className="mr-3"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">{t('taskStore.all')}</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
