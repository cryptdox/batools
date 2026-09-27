import { useState } from 'react';
import { useLanguage } from '../../../lib/LanguageContext';
import type { LanguageCode } from '../../../types/taskManager';

interface VocabFilterPanelProps {
  searchText: string;
  onSearchChange: (text: string) => void;
  fromLanguage: LanguageCode;
  onFromLanguageChange: (lang: LanguageCode) => void;
  toLanguage: LanguageCode | null;
  onToLanguageChange: (lang: LanguageCode | null) => void;
  dateRange: 'all' | 'week' | 'month' | 'date';
  onDateRangeChange: (range: 'all' | 'week' | 'month' | 'date') => void;
  selectedDate: string;
  onSelectedDateChange: (date: string) => void;
  sortBy: 'alphabetical' | 'date';
  onSortByChange: (sort: 'alphabetical' | 'date') => void;
}

export function VocabFilterPanel({
  searchText,
  onSearchChange,
  fromLanguage,
  onFromLanguageChange,
  toLanguage,
  onToLanguageChange,
  dateRange,
  onDateRangeChange,
  selectedDate,
  onSelectedDateChange,
  sortBy,
  onSortByChange,
}: VocabFilterPanelProps) {
  const { t } = useLanguage();
  const [, setShowDatePicker] = useState(false);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg space-y-6">
      <div>
        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
          {t('vocabulary.search')}
        </label>
        <input
          type="text"
          value={searchText}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('vocabulary.search')}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
          {t('vocabulary.from')}
        </label>
        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="radio"
              name="from_lang"
              value="en"
              checked={fromLanguage === 'en'}
              onChange={() => onFromLanguageChange('en')}
              className="mr-2"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">English</span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="from_lang"
              value="bn"
              checked={fromLanguage === 'bn'}
              onChange={() => onFromLanguageChange('bn')}
              className="mr-2"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Bangla</span>
          </label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
          {t('vocabulary.to')} ({t('vocabulary.optional')})
        </label>
        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="radio"
              name="to_lang"
              value="all"
              checked={toLanguage === null}
              onChange={() => onToLanguageChange(null)}
              className="mr-2"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">{t('vocabulary.all')}</span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="to_lang"
              value="en"
              checked={toLanguage === 'en'}
              onChange={() => onToLanguageChange('en')}
              className="mr-2"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">English</span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="to_lang"
              value="bn"
              checked={toLanguage === 'bn'}
              onChange={() => onToLanguageChange('bn')}
              className="mr-2"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Bangla</span>
          </label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
          {t('vocabulary.dateRange')}
        </label>
        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="radio"
              name="date_range"
              value="all"
              checked={dateRange === 'all'}
              onChange={() => onDateRangeChange('all')}
              className="mr-2"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">{t('vocabulary.all')}</span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="date_range"
              value="week"
              checked={dateRange === 'week'}
              onChange={() => onDateRangeChange('week')}
              className="mr-2"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">{t('vocabulary.week')}</span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="date_range"
              value="month"
              checked={dateRange === 'month'}
              onChange={() => onDateRangeChange('month')}
              className="mr-2"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">{t('vocabulary.month')}</span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="date_range"
              value="date"
              checked={dateRange === 'date'}
              onChange={() => {
                onDateRangeChange('date');
                setShowDatePicker(true);
              }}
              className="mr-2"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">{t('vocabulary.selectDate')}</span>
          </label>
        </div>

        {dateRange === 'date' && (
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => onSelectedDateChange(e.target.value)}
            className="mt-2 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          />
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
          {t('taskManager.type')}
        </label>
        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="radio"
              name="sort_by"
              value="alphabetical"
              checked={sortBy === 'alphabetical'}
              onChange={() => onSortByChange('alphabetical')}
              className="mr-2"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">{t('vocabulary.alphabetical')}</span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="sort_by"
              value="date"
              checked={sortBy === 'date'}
              onChange={() => onSortByChange('date')}
              className="mr-2"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">{t('taskManager.date')}</span>
          </label>
        </div>
      </div>
    </div>
  );
}
