import { useState, useEffect, useMemo } from 'react';
import { tmUser } from '../../lib/taskManagerUser';
import { useLanguage } from '../../lib/LanguageContext';
import { supabase } from '../../lib/supabase';
import type { Vocabulary, LanguageCode } from '../../types/taskManager';
import { VocabFilterPanel } from '../../components/taskManager/vocabulary/VocabFilterPanel';
import { VocabForm } from '../../components/taskManager/vocabulary/VocabForm';
import { VocabItem } from '../../components/taskManager/vocabulary/VocabItem';
import { ConfirmDeleteModal } from '../../components/taskManager/vocabulary/ConfirmDeleteModal';

export function VocabularyPage() {
  const user = tmUser;
  const { t } = useLanguage();

  const [vocabs, setVocabs] = useState<Vocabulary[]>([]);
  const [searchText, setSearchText] = useState('');
  const [fromLanguage, setFromLanguage] = useState<LanguageCode>('en');
  const [toLanguage, setToLanguage] = useState<LanguageCode | null>(null);
  const [dateRange, setDateRange] = useState<'all' | 'week' | 'month' | 'date'>('all');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [sortBy, setSortBy] = useState<'alphabetical' | 'date'>('alphabetical');
  const [editingVocab, setEditingVocab] = useState<Vocabulary | null>(null);
  const [deletingVocab, setDeletingVocab] = useState<Vocabulary | null>(null);
  const [addingVocabulary, setAddingVocabulary] = useState<Vocabulary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadVocabs();
    }
  }, [user]);

  const loadVocabs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tm_vocabulary')
        .select('*')
        .eq('created_by', user!.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setVocabs(data);
      }
    } catch (error) {
      console.error('Error loading vocabulary:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDateRange = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (dateRange) {
      case 'week': {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return { start: weekAgo, end: now };
      }
      case 'month': {
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return { start: monthAgo, end: now };
      }
      case 'date':
        return {
          start: new Date(selectedDate + 'T00:00:00'),
          end: new Date(selectedDate + 'T23:59:59'),
        };
      default:
        return null;
    }
  };

  const filteredAndSortedVocabs = useMemo(() => {
    let filtered = vocabs.filter(vocab => {
      const matchesSearch = vocab.text.toLowerCase().includes(searchText.toLowerCase());
      const matchesFromLanguage = vocab.language_code === fromLanguage;
      const dateRangeObj = getDateRange();

      let matchesDate = true;
      if (dateRangeObj) {
        const vocabDate = new Date(vocab.created_at);
        matchesDate = vocabDate >= dateRangeObj.start && vocabDate <= dateRangeObj.end;
      }

      return matchesSearch && matchesFromLanguage && matchesDate;
    });

    if (sortBy === 'alphabetical') {
      filtered.sort((a, b) => a.text.localeCompare(b.text));
    } else {
      filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return filtered;
  }, [vocabs, searchText, fromLanguage, dateRange, selectedDate, sortBy]);

  const handleSaveVocab = async (vocab: Partial<Vocabulary>) => {
    if (!user) return;
    setLoading(true);

    console.log("vocab: ", vocab)

    try {
      if (editingVocab) {
        const { data, error } = await supabase
          .from('tm_vocabulary')
          .update(vocab)
          .eq('id', editingVocab.id);
        if (error) throw error;
        console.log(data)
        // id = data?.id
      } else {
        if(!addingVocabulary){
        const { data, error } = await supabase
          .from('tm_vocabulary')
          .insert([{ ...vocab, created_by: user.id }]);
        if (error) throw error;
        console.log(data)


        // id = data?.id
        }
      }
      await loadVocabs();
      setEditingVocab(null);
      // return data
    } catch (error) {
      console.error('Error saving vocabulary:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVocab = async () => {
    if (!deletingVocab) return;
    setLoading(true);

    try {
      const { error } = await supabase
        .from('tm_vocabulary')
        .delete()
        .eq('id', deletingVocab.id);
      if (error) throw error;
      await loadVocabs();
      setDeletingVocab(null);
    } catch (error) {
      console.error('Error deleting vocabulary:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">{t('vocabulary.title')}</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{t('vocabulary.subtitle')}</p>
        </div>
      </div>
      <div>
        {/* <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">
          {t('vocabulary.title')}
        </h1> */}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <VocabFilterPanel
              searchText={searchText}
              onSearchChange={setSearchText}
              fromLanguage={fromLanguage}
              onFromLanguageChange={setFromLanguage}
              toLanguage={toLanguage}
              onToLanguageChange={setToLanguage}
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              selectedDate={selectedDate}
              onSelectedDateChange={setSelectedDate}
              sortBy={sortBy}
              onSortByChange={setSortBy}
            />
          </div>

          <div className="lg:col-span-3 space-y-6">
            <VocabForm
              editingVocab={editingVocab}
              addingVocabulary={addingVocabulary}
              onSave={handleSaveVocab}
              onCancel={() => {
                setEditingVocab(null)
                setAddingVocabulary(null)
              }}
              loading={loading}
            />

            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
              <h2 className="text-2xl font-semibold mb-6 text-gray-900 dark:text-white">
                {t('vocabulary.title')}
              </h2>

              {filteredAndSortedVocabs.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 dark:text-gray-400">
                    {vocabs.length === 0 ? t('vocabulary.noResults') : t('vocabulary.noResults')}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredAndSortedVocabs.map(vocab => (
                    <VocabItem
                      key={vocab.id}
                      vocab={vocab}
                      onEdit={(vocab: Vocabulary) => {setEditingVocab(vocab); setAddingVocabulary(null)}}
                      addVocabulary={(vocab: Vocabulary) => {setEditingVocab(null); setAddingVocabulary(vocab)}}
                      onDelete={(v: Vocabulary) => setDeletingVocab(v)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {deletingVocab && (
        <ConfirmDeleteModal
          onConfirm={handleDeleteVocab}
          onClose={() => setDeletingVocab(null)}
        />
      )}
    </div>
  );
}
